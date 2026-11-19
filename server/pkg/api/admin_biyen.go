package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/ente/museum/ente"
	"github.com/ente/museum/pkg/utils/auth"
	emailUtil "github.com/ente/museum/pkg/utils/email"
	"github.com/ente/museum/pkg/utils/handler"
	"github.com/ente/stacktrace"
	"github.com/gin-gonic/gin"
	"github.com/patrickmn/go-cache"
	"github.com/sirupsen/logrus"
)

type SuspendUserRequest struct {
	UserID      int64  `json:"userID"`
	UserIDSnake int64  `json:"user_id"`
	Reason      string `json:"reason"`
}

func (r SuspendUserRequest) GetUserID() int64 {
	if r.UserID != 0 {
		return r.UserID
	}
	return r.UserIDSnake
}

type UnsuspendUserRequest struct {
	UserID      int64 `json:"userID"`
	UserIDSnake int64 `json:"user_id"`
}

func (r UnsuspendUserRequest) GetUserID() int64 {
	if r.UserID != 0 {
		return r.UserID
	}
	return r.UserIDSnake
}

type DisableSharedCollectionRequest struct {
	ShareID      int64 `json:"shareID"`
	ShareIDSnake int64 `json:"share_id"`
}

func (r DisableSharedCollectionRequest) GetShareID() int64 {
	if r.ShareID != 0 {
		return r.ShareID
	}
	return r.ShareIDSnake
}

type AbuseReportItem struct {
	ID         int64           `json:"id"`
	ShareID    int64           `json:"share_id"`
	URL        string          `json:"url"`
	Reason     string          `json:"reason"`
	Details    json.RawMessage `json:"details"`
	IP         string          `json:"ip"`
	UserAgent  string          `json:"user_agent"`
	CreatedAt  int64           `json:"created_at"`
	IsDisabled bool            `json:"is_disabled"`
}

// GetAbuseReports returns all abuse reports joined with public collection share tokens.
func (h *AdminHandler) GetAbuseReports(c *gin.Context) {
	query := `SELECT 
			COALESCE(t.id, r.share_id) AS id,
			r.share_id,
			r.url,
			r.reason,
			COALESCE(r.details::text, '{}'),
			r.ip,
			r.user_agent,
			r.created_at,
			COALESCE(t.is_disabled, FALSE)
		FROM public_abuse_report r
		LEFT JOIN public_collection_tokens t ON r.share_id = t.id
		ORDER BY r.created_at DESC`

	rows, err := h.UserRepo.DB.QueryContext(c.Request.Context(), query)
	if err != nil {
		handler.Error(c, stacktrace.Propagate(err, "failed to query abuse reports"))
		return
	}
	defer rows.Close()

	reports := make([]AbuseReportItem, 0)
	for rows.Next() {
		var item AbuseReportItem
		var rawDetails string
		if err := rows.Scan(
			&item.ID,
			&item.ShareID,
			&item.URL,
			&item.Reason,
			&rawDetails,
			&item.IP,
			&item.UserAgent,
			&item.CreatedAt,
			&item.IsDisabled,
		); err != nil {
			handler.Error(c, stacktrace.Propagate(err, "failed to scan abuse report"))
			return
		}
		item.Details = json.RawMessage(rawDetails)
		reports = append(reports, item)
	}

	if err := rows.Err(); err != nil {
		handler.Error(c, stacktrace.Propagate(err, "error during abuse report iteration"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"reports": reports})
}

// DisableSharedCollection disables a public collection share token by share ID.
func (h *AdminHandler) DisableSharedCollection(c *gin.Context) {
	var req DisableSharedCollectionRequest
	if err := handler.BindJSON(c, &req); err != nil {
		handler.Error(c, stacktrace.Propagate(err, "Bad request"))
		return
	}

	shareID := req.GetShareID()
	if shareID <= 0 {
		handler.Error(c, stacktrace.Propagate(ente.ErrBadRequest, "valid shareID is required"))
		return
	}

	query := `UPDATE public_collection_tokens SET is_disabled = TRUE WHERE id = $1`
	res, err := h.UserRepo.DB.ExecContext(c.Request.Context(), query, shareID)
	if err != nil {
		handler.Error(c, stacktrace.Propagate(err, "failed to disable shared collection"))
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		handler.Error(c, stacktrace.Propagate(ente.ErrBadRequest, "shared collection not found"))
		return
	}

	adminID := auth.GetUserID(c.Request.Header)
	h.notifyAdminAction(adminID, "disabled shared collection %d", shareID)

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *AdminHandler) cacheUserSuspended(userID int64) {
	if h.UserController != nil && h.UserController.Cache != nil {
		cacheKey := ente.SuspendedUserCachePrefix + strconv.FormatInt(userID, 10)
		h.UserController.Cache.Set(cacheKey, true, cache.DefaultExpiration)
	}
}

func (h *AdminHandler) invalidateUserSuspensionCache(userID int64) {
	if h.UserController != nil && h.UserController.Cache != nil {
		cacheKey := ente.SuspendedUserCachePrefix + strconv.FormatInt(userID, 10)
		h.UserController.Cache.Delete(cacheKey)
	}
}

func (h *AdminHandler) sendUserSuspendedEmail(userID int64, reason string) {
	user, err := h.UserRepo.Get(userID)
	if err != nil || user.Email == "" {
		logrus.WithError(err).WithField("user_id", userID).Warn("Could not fetch user email for suspension notification")
		return
	}

	templateData := map[string]interface{}{
		"Reason": reason,
	}
	emailErr := emailUtil.SendTemplatedEmail(
		[]string{user.Email},
		"Biyen Support",
		"support@biyen.levitation.web.id",
		"Pemberitahuan Penangguhan Akun Biyen Photo",
		"user_suspended.html",
		templateData,
		nil,
	)
	if emailErr != nil {
		logrus.WithError(emailErr).WithField("user_id", userID).Warn("Failed to send suspension email to user")
	}
}
