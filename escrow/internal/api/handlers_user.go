package api

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/ente/escrow/internal/envelope"
	"github.com/ente/escrow/internal/museum"
	"github.com/ente/escrow/internal/store"
)

func (s *Server) handleGetPublicKey(w http.ResponseWriter, r *http.Request) {
	if extractAuthHeader(r) != "" {
		if _, err := s.authenticateUser(r); err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
	}
	if len(s.custodyPublicKey) != envelope.PublicKeyBytes {
		writeError(w, http.StatusServiceUnavailable, "custody public key not configured")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"kek_version":    s.kekVersion,
		"cipher_suite":   envelope.CipherSuiteID,
		"public_key":     s.custodyPublicKey,
		"public_key_hex": hex.EncodeToString(s.custodyPublicKey),
		"fingerprint":    envelope.PublicKeyFingerprint(s.custodyPublicKey),
	})
}

func (s *Server) handlePutDeposit(w http.ResponseWriter, r *http.Request) {
	user, err := s.authenticateUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req struct {
		KEKVersion            string    `json:"kek_version"`
		CipherSuite           string    `json:"cipher_suite"`
		CustodyBlob           FlexBytes `json:"custody_blob"`
		RecoveryKeyCommitment FlexBytes `json:"recovery_key_commitment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.KEKVersion == "" {
		req.KEKVersion = s.kekVersion
	}
	if req.CipherSuite == "" {
		req.CipherSuite = envelope.CipherSuiteID
	}
	if req.CipherSuite != envelope.CipherSuiteID {
		writeError(w, http.StatusBadRequest, "unsupported cipher_suite")
		return
	}
	if len(req.CustodyBlob) < envelope.HPKEOverheadBytes {
		writeError(w, http.StatusBadRequest, "custody_blob shorter than minimum HPKE overhead")
		return
	}
	if len(req.RecoveryKeyCommitment) != envelope.CommitmentBytes {
		writeError(w, http.StatusBadRequest, "recovery_key_commitment must be 64 bytes")
		return
	}

	var commitment [envelope.CommitmentBytes]byte
	copy(commitment[:], req.RecoveryKeyCommitment)

	dep, err := s.store.SaveDeposit(r.Context(), store.SaveDepositParams{
		UserID:                user.ID,
		KEKVersion:            req.KEKVersion,
		CipherSuite:           req.CipherSuite,
		CustodyBlob:           req.CustodyBlob,
		RecoveryKeyCommitment: commitment,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to store deposit")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"id":                      dep.ID,
		"mode":                    store.ModeManaged,
		"kek_version":             dep.KEKVersion,
		"cipher_suite":            dep.CipherSuite,
		"recovery_key_commitment": dep.CommitmentBytes,
		"created_at":              dep.CreatedAt,
	})
}

func (s *Server) handleGetStatus(w http.ResponseWriter, r *http.Request) {
	user, err := s.authenticateUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	status, err := s.store.GetAccountStatus(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get escrow status")
		return
	}
	writeJSON(w, http.StatusOK, status)
}

func (s *Server) handleScheduleZeroKnowledge(w http.ResponseWriter, r *http.Request) {
	user, err := s.authenticateUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	scheduledAt, err := s.store.ScheduleZeroKnowledge(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to schedule zero-knowledge transition")
		return
	}
	_ = s.museum.SendNotificationEmail(r.Context(), museum.NotificationEmailRequest{
		ToEmail: user.Email,
		Subject: "Peringatan Keamanan Biyen: Penghapusan Cadangan Pemulihan Dijadwalkan",
		Body: fmt.Sprintf(
			"Permintaan pindah ke mode Zero-Knowledge diterima. Cadangan pemulihan Anda akan dihapus permanen pada %s (7 hari). Jika bukan Anda, segera batalkan di aplikasi.",
			scheduledAt.Format("2006-01-02 15:04:05 MST"),
		),
	})
	writeJSON(w, http.StatusOK, map[string]any{
		"mode":                store.ModeManaged,
		"delete_scheduled_at": scheduledAt,
	})
}

func (s *Server) handleCancelZeroKnowledge(w http.ResponseWriter, r *http.Request) {
	user, err := s.authenticateUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if err := s.store.CancelZeroKnowledge(r.Context(), user.ID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "escrow account not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to cancel scheduled deletion")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"mode":                store.ModeManaged,
		"delete_scheduled_at": nil,
	})
}

func (s *Server) handleCreateRecoveryRequest(w http.ResponseWriter, r *http.Request) {
	if !s.rateLimiter.Allow(r.RemoteAddr) {
		writeError(w, http.StatusTooManyRequests, "rate limit exceeded")
		return
	}
	var req struct {
		DevicePublicKey FlexBytes `json:"device_public_key"`
		PollSecretHash  FlexBytes `json:"poll_secret_hash"`
		ClaimedEmail    string    `json:"claimed_email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if !isValidXWingPublicKey(req.DevicePublicKey) {
		writeError(w, http.StatusBadRequest, "invalid X-Wing device_public_key (expected 1216 bytes)")
		return
	}
	if len(req.PollSecretHash) != envelope.CommitmentBytes {
		writeError(w, http.StatusBadRequest, "poll_secret_hash must be 64 bytes")
		return
	}

	reqID, err := generateUUIDv4()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate request_id")
		return
	}
	var pollHash [envelope.CommitmentBytes]byte
	copy(pollHash[:], req.PollSecretHash)
	reqCode := envelope.ComputeRequestCode(reqID, req.DevicePublicKey)

	created, err := s.store.CreateRecoveryRequest(r.Context(), store.CreateRecoveryRequestParams{
		RequestID:       reqID,
		DevicePublicKey: req.DevicePublicKey,
		RequestCode:     reqCode,
		PollSecretHash:  pollHash,
		ClaimedEmail:    strings.TrimSpace(req.ClaimedEmail),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create recovery request")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"request_id": created.RequestID,
		"expires_at": created.ExpiresAt,
	})
}

func (s *Server) handlePollRecoveryRequest(w http.ResponseWriter, r *http.Request) {
	reqID := strings.TrimSpace(r.PathValue("id"))
	pollSecret := r.Header.Get("X-Poll-Secret")
	if reqID == "" || strings.TrimSpace(pollSecret) == "" {
		writeError(w, http.StatusUnauthorized, "missing X-Poll-Secret")
		return
	}

	rec, err := s.store.PollRecoveryRequest(r.Context(), reqID, pollSecret)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrInvalidPollSecret):
			writeError(w, http.StatusUnauthorized, "invalid poll secret")
		case errors.Is(err, store.ErrNotFound):
			writeError(w, http.StatusNotFound, "recovery request not found")
		case errors.Is(err, store.ErrRequestConsumed):
			writeError(w, http.StatusGone, "recovery request already consumed")
		case errors.Is(err, store.ErrRequestExpired):
			writeError(w, http.StatusGone, "recovery request expired")
		case errors.Is(err, store.ErrRequestNotReady):
			writeJSON(w, http.StatusTooEarly, map[string]any{
				"request_id":    rec.RequestID,
				"status":        rec.Status,
				"release_after": rec.ReleaseAfter,
				"expires_at":    rec.ExpiresAt,
			})
		default:
			writeError(w, http.StatusInternalServerError, "failed to poll recovery request")
		}
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"request_id":    rec.RequestID,
		"status":        rec.Status,
		"device_blob":   rec.DeviceBlob,
		"approved_at":   rec.ApprovedAt,
		"release_after": rec.ReleaseAfter,
		"consumed_at":   rec.ConsumedAt,
	})
}
