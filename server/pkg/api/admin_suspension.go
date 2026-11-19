package api

import (
	"net/http"
	"strings"

	"github.com/ente/museum/ente"
	"github.com/ente/museum/pkg/utils/auth"
	"github.com/ente/museum/pkg/utils/handler"
	"github.com/ente/stacktrace"
	"github.com/gin-gonic/gin"
)

func (h *AdminHandler) SuspendUser(c *gin.Context) {
	h.setUserSuspended(c, true)
}

func (h *AdminHandler) UnsuspendUser(c *gin.Context) {
	h.setUserSuspended(c, false)
}

func (h *AdminHandler) setUserSuspended(c *gin.Context, suspended bool) {
	if err := h.isFreshAdminToken(c); err != nil {
		handler.Error(c, err)
		return
	}
	var req SuspendUserRequest
	if err := handler.BindJSON(c, &req); err != nil {
		handler.Error(c, err)
		return
	}
	userID := req.GetUserID()
	if userID <= 0 {
		handler.Error(c, ente.NewBadRequestWithMessage("valid userID is required"))
		return
	}
	adminID := auth.GetUserID(c.Request.Header)
	if suspended && userID == adminID {
		handler.Error(c, ente.NewBadRequestWithMessage("You cannot suspend your own account"))
		return
	}
	if err := h.UserController.SetSuspended(c, userID, suspended); err != nil {
		handler.Error(c, err)
		return
	}

	reason := strings.TrimSpace(req.Reason)
	if !suspended {
		reason = ""
	}
	if h.UserRepo != nil && h.UserRepo.DB != nil {
		if _, err := h.UserRepo.DB.ExecContext(c.Request.Context(), `UPDATE users SET suspend_reason = $1 WHERE user_id = $2`, reason, userID); err != nil {
			handler.Error(c, stacktrace.Propagate(err, "failed to update user suspend reason"))
			return
		}
	}

	action := "unsuspending"
	if suspended {
		action = "suspending"
		h.cacheUserSuspended(userID)
		if reason != "" {
			h.sendUserSuspendedEmail(userID, reason)
		}
	} else {
		h.invalidateUserSuspensionCache(userID)
	}
	h.notifyAdminAction(adminID, "%s account for %d", action, userID)
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
