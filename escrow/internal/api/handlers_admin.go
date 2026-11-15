package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/ente/escrow/internal/envelope"
	"github.com/ente/escrow/internal/museum"
	"github.com/ente/escrow/internal/store"
)

func (s *Server) handleAdminGetRecoveryRequest(w http.ResponseWriter, r *http.Request) {
	if _, _, err := s.authenticateAdmin(r); err != nil {
		writeError(w, http.StatusUnauthorized, "admin authentication required")
		return
	}
	code := strings.TrimSpace(r.PathValue("code"))
	rec, err := s.store.GetRecoveryRequestByCode(r.Context(), code)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "recovery request not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to fetch recovery request")
		return
	}
	writeJSON(w, http.StatusOK, rec)
}

func (s *Server) handleAdminGetUserDeposits(w http.ResponseWriter, r *http.Request) {
	if _, _, err := s.authenticateAdmin(r); err != nil {
		writeError(w, http.StatusUnauthorized, "admin authentication required")
		return
	}
	userID, err := strconv.ParseInt(strings.TrimSpace(r.PathValue("id")), 10, 64)
	if err != nil || userID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	acc, deps, err := s.store.ListUserDeposits(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list user deposits")
		return
	}
	allAudit, _ := s.store.ListAuditLog(r.Context())
	userAudit := make([]store.AuditEntry, 0)
	for _, entry := range allAudit {
		if entry.UserID == userID {
			userAudit = append(userAudit, entry)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"user_id":             acc.UserID,
		"mode":                acc.Mode,
		"delete_scheduled_at": acc.DeleteScheduledAt,
		"updated_at":          acc.UpdatedAt,
		"deposit_count":       len(deps),
		"deposits":            deps,
		"audit_log":           userAudit,
	})
}

func (s *Server) handleAdminApproveRecoveryRequest(w http.ResponseWriter, r *http.Request) {
	principal, adminToken, err := s.authenticateAdmin(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "admin authentication required")
		return
	}
	reqID := strings.TrimSpace(r.PathValue("id"))

	var body struct {
		LinkedUserID  int64     `json:"linked_user_id"`
		SupportRef    string    `json:"support_ref"`
		DeviceBlob    FlexBytes `json:"device_blob"`
		CooldownHours int       `json:"cooldown_hours"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.LinkedUserID <= 0 || strings.TrimSpace(body.SupportRef) == "" {
		writeError(w, http.StatusBadRequest, "linked_user_id and support_ref are required")
		return
	}
	if len(body.DeviceBlob) < envelope.HPKEOverheadBytes {
		writeError(w, http.StatusBadRequest, "device_blob shorter than HPKE overhead")
		return
	}
	if body.CooldownHours < 0 {
		writeError(w, http.StatusBadRequest, "cooldown_hours must be non-negative")
		return
	}

	approved, err := s.store.ApproveRecoveryRequest(r.Context(), store.ApproveRecoveryParams{
		RequestID:     reqID,
		LinkedUserID:  body.LinkedUserID,
		SupportRef:    strings.TrimSpace(body.SupportRef),
		DeviceBlob:    body.DeviceBlob,
		CooldownHours: body.CooldownHours,
		AdminActorID:  principal.ActorID,
	})
	if err != nil {
		switch {
		case errors.Is(err, store.ErrZeroKnowledgeMode):
			writeError(w, http.StatusConflict, "account is in zero_knowledge mode or has no deposits")
		case errors.Is(err, store.ErrNotFound):
			writeError(w, http.StatusNotFound, "recovery request not found")
		case errors.Is(err, store.ErrRequestExpired):
			writeError(w, http.StatusGone, "recovery request expired")
		case errors.Is(err, store.ErrRequestNotPending):
			writeError(w, http.StatusConflict, "recovery request is not pending")
		default:
			writeError(w, http.StatusInternalServerError, "failed to approve recovery request")
		}
		return
	}

	s.sendApprovalNotifications(r, adminToken, approved)
	writeJSON(w, http.StatusOK, approved)
}

func (s *Server) sendApprovalNotifications(r *http.Request, adminToken string, approved store.RecoveryRequest) {
	userEmail := approved.ClaimedEmail
	if approved.LinkedUserID != nil {
		if u, err := s.museum.GetAdminUser(r.Context(), adminToken, *approved.LinkedUserID); err == nil && u.Email != "" {
			userEmail = u.Email
		}
	}
	if userEmail != "" {
		_ = s.museum.SendNotificationEmail(r.Context(), museum.NotificationEmailRequest{
			AdminToken: adminToken,
			ToEmail:    userEmail,
			Subject:    "Peringatan Keamanan Biyen: Permintaan Pemulihan Akun Disetujui",
			Body: fmt.Sprintf(
				"Permintaan pemulihan akun Anda (Ref: %s) telah disetujui dan dapat diunduh setelah masa jeda keamanan.",
				approved.SupportRef,
			),
		})
	}
	_ = s.museum.SendNotificationEmail(r.Context(), museum.NotificationEmailRequest{
		AdminToken: adminToken,
		ToEmail:    s.founderEmail,
		Subject:    "[ALERT FOUNDER] Escrow Recovery Approved",
		Body: fmt.Sprintf(
			"Recovery request %s (code %s, support_ref %s) approved for user_id=%v.",
			approved.RequestID, approved.RequestCode, approved.SupportRef, approved.LinkedUserID,
		),
	})
}

func (s *Server) handleAdminRejectRecoveryRequest(w http.ResponseWriter, r *http.Request) {
	principal, _, err := s.authenticateAdmin(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "admin authentication required")
		return
	}
	reqID := strings.TrimSpace(r.PathValue("id"))

	var body struct {
		SupportRef string `json:"support_ref"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if strings.TrimSpace(body.SupportRef) == "" {
		body.SupportRef = "rejected-by-admin"
	}

	rejected, err := s.store.RejectRecoveryRequest(r.Context(), store.RejectRecoveryParams{
		RequestID:    reqID,
		SupportRef:   strings.TrimSpace(body.SupportRef),
		AdminActorID: principal.ActorID,
	})
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "recovery request not found")
			return
		}
		if errors.Is(err, store.ErrRequestNotPending) {
			writeError(w, http.StatusConflict, "recovery request is not pending")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to reject recovery request")
		return
	}
	writeJSON(w, http.StatusOK, rejected)
}

func (s *Server) handleAdminGetAuditLog(w http.ResponseWriter, r *http.Request) {
	if _, _, err := s.authenticateAdmin(r); err != nil {
		writeError(w, http.StatusUnauthorized, "admin authentication required")
		return
	}
	entries, err := s.store.ListAuditLog(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read audit log")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": entries})
}
