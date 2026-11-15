package store

import (
	"context"
	"encoding/hex"
	"strconv"
	"time"

	"github.com/ente/escrow/internal/envelope"
)

func (m *MemoryStore) PollRecoveryRequest(_ context.Context, requestID string, pollSecret string) (RecoveryRequest, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := m.nowFunc()
	req, err := m.getAndRefreshRequestLocked(requestID)
	if err != nil {
		return RecoveryRequest{}, err
	}
	if !VerifyPollSecretConstantTime(pollSecret, req.PollSecretHash) {
		return RecoveryRequest{}, ErrInvalidPollSecret
	}
	if req.Status == StatusConsumed {
		return RecoveryRequest{}, ErrRequestConsumed
	}
	if req.Status == StatusExpired {
		return RecoveryRequest{}, ErrRequestExpired
	}
	if req.Status != StatusApproved || req.ReleaseAfter == nil || now.Before(*req.ReleaseAfter) {
		redacted := req
		redacted.DeviceBlob = nil
		return redacted, ErrRequestNotReady
	}

	req.Status = StatusConsumed
	req.ConsumedAt = &now
	m.requests[req.RequestID] = req

	uid := int64(0)
	if req.LinkedUserID != nil {
		uid = *req.LinkedUserID
	}
	m.appendAuditLocked(AppendAuditParams{
		UserID:     uid,
		ActorType:  "device",
		ActorID:    req.RequestID,
		Action:     "recovery_consumed",
		SupportRef: req.SupportRef,
	}, now)
	return req, nil
}

func (m *MemoryStore) ListAuditLog(_ context.Context) ([]AuditEntry, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	out := make([]AuditEntry, len(m.auditLog))
	copy(out, m.auditLog)
	return out, nil
}

func (m *MemoryStore) enforceScheduledDeletionLocked(userID int64, now time.Time) {
	acc, exists := m.accounts[userID]
	if !exists || acc.DeleteScheduledAt == nil {
		return
	}
	if !now.Before(*acc.DeleteScheduledAt) {
		delete(m.deposits, userID)
		acc.Mode = ModeZeroKnowledge
		acc.DeleteScheduledAt = nil
		acc.UpdatedAt = now
		m.accounts[userID] = acc
		m.appendAuditLocked(AppendAuditParams{
			UserID:    userID,
			ActorType: "system",
			ActorID:   strconv.FormatInt(userID, 10),
			Action:    "zero_knowledge_purged",
		}, now)
	}
}

func (m *MemoryStore) getAndRefreshRequestLocked(requestID string) (RecoveryRequest, error) {
	req, exists := m.requests[requestID]
	if !exists {
		return RecoveryRequest{}, ErrNotFound
	}
	now := m.nowFunc()
	if req.Status == StatusPending && !now.Before(req.ExpiresAt) {
		req.Status = StatusExpired
		m.requests[requestID] = req
	}
	return req, nil
}

func (m *MemoryStore) appendAuditLocked(params AppendAuditParams, now time.Time) {
	m.nextAuditID++
	var prevHash [envelope.CommitmentBytes]byte
	if len(m.auditLog) > 0 {
		prevHash = m.auditLog[len(m.auditLog)-1].EntryHash
	}
	chainInput := envelope.AuditChainInput{
		ID:                m.nextAuditID,
		UserID:            params.UserID,
		ActorType:         params.ActorType,
		ActorID:           params.ActorID,
		Action:            params.Action,
		SupportRef:        params.SupportRef,
		CreatedAtUnixNano: now.UnixNano(),
		PrevHash:          prevHash,
	}
	entryHash := envelope.ComputeAuditEntryHash(chainInput)
	entry := AuditEntry{
		ID:         m.nextAuditID,
		UserID:     params.UserID,
		ActorType:  params.ActorType,
		ActorID:    params.ActorID,
		Action:     params.Action,
		SupportRef: params.SupportRef,
		PrevHash:   prevHash,
		EntryHash:  entryHash,
		PrevHex:    hex.EncodeToString(prevHash[:]),
		EntryHex:   hex.EncodeToString(entryHash[:]),
		CreatedAt:  now,
	}
	m.auditLog = append(m.auditLog, entry)
}

func (m *MemoryStore) ReplaceDevicePublicKey(requestID string, newDevicePubKey []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	req, exists := m.requests[requestID]
	if !exists {
		return ErrNotFound
	}
	req.DevicePublicKey = append([]byte(nil), newDevicePubKey...)
	m.requests[requestID] = req
	return nil
}
