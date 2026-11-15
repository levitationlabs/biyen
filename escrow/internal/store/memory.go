package store

import (
	"context"
	"strconv"
	"sync"
	"time"
)

type MemoryStore struct {
	mu          sync.Mutex
	nowFunc     func() time.Time
	nextDepID   int64
	nextAuditID int64
	deposits    map[int64][]Deposit
	accounts    map[int64]Account
	requests    map[string]RecoveryRequest
	codeToID    map[string]string
	auditLog    []AuditEntry
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		nowFunc:  func() time.Time { return time.Now().UTC() },
		deposits: make(map[int64][]Deposit),
		accounts: make(map[int64]Account),
		requests: make(map[string]RecoveryRequest),
		codeToID: make(map[string]string),
		auditLog: make([]AuditEntry, 0),
	}
}

func (m *MemoryStore) SetClock(nowFunc func() time.Time) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.nowFunc = nowFunc
}

func (m *MemoryStore) SaveDeposit(_ context.Context, params SaveDepositParams) (Deposit, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := m.nowFunc()
	m.nextDepID++
	blobCopy := append([]byte(nil), params.CustodyBlob...)
	dep := Deposit{
		ID:                    m.nextDepID,
		UserID:                params.UserID,
		KEKVersion:            params.KEKVersion,
		CipherSuite:           params.CipherSuite,
		CustodyBlob:           blobCopy,
		RecoveryKeyCommitment: params.RecoveryKeyCommitment,
		CommitmentBytes:       append([]byte(nil), params.RecoveryKeyCommitment[:]...),
		CreatedAt:             now,
	}

	existing := append([]Deposit{dep}, m.deposits[params.UserID]...)
	if len(existing) > MaxDepositsPerUser {
		existing = existing[:MaxDepositsPerUser]
	}
	m.deposits[params.UserID] = existing
	m.accounts[params.UserID] = Account{
		UserID:            params.UserID,
		Mode:              ModeManaged,
		DeleteScheduledAt: nil,
		UpdatedAt:         now,
	}
	m.appendAuditLocked(AppendAuditParams{
		UserID:    params.UserID,
		ActorType: "user",
		ActorID:   strconv.FormatInt(params.UserID, 10),
		Action:    "deposit_stored",
	}, now)
	return dep, nil
}

func (m *MemoryStore) GetAccountStatus(_ context.Context, userID int64) (AccountStatus, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := m.nowFunc()
	m.enforceScheduledDeletionLocked(userID, now)
	acc, exists := m.accounts[userID]
	if !exists {
		return AccountStatus{Mode: ModeZeroKnowledge, DepositCount: 0}, nil
	}
	deps := m.deposits[userID]
	status := AccountStatus{
		Mode:              acc.Mode,
		DeleteScheduledAt: acc.DeleteScheduledAt,
		DepositCount:      len(deps),
	}
	if len(deps) > 0 {
		status.KEKVersion = deps[0].KEKVersion
		status.RecoveryKeyCommitment = append([]byte(nil), deps[0].RecoveryKeyCommitment[:]...)
	}
	return status, nil
}

func (m *MemoryStore) ListUserDeposits(_ context.Context, userID int64) (Account, []Deposit, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := m.nowFunc()
	m.enforceScheduledDeletionLocked(userID, now)
	acc, exists := m.accounts[userID]
	if !exists {
		acc = Account{UserID: userID, Mode: ModeZeroKnowledge, UpdatedAt: now}
	}
	deps := m.deposits[userID]
	out := make([]Deposit, len(deps))
	copy(out, deps)
	return acc, out, nil
}

func (m *MemoryStore) ScheduleZeroKnowledge(_ context.Context, userID int64) (time.Time, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := m.nowFunc()
	scheduled := now.Add(DeleteGracePeriodDays * 24 * time.Hour)
	acc, exists := m.accounts[userID]
	if !exists {
		acc = Account{UserID: userID, Mode: ModeManaged}
	}
	acc.DeleteScheduledAt = &scheduled
	acc.UpdatedAt = now
	m.accounts[userID] = acc

	m.appendAuditLocked(AppendAuditParams{
		UserID:    userID,
		ActorType: "user",
		ActorID:   strconv.FormatInt(userID, 10),
		Action:    "zero_knowledge_scheduled",
	}, now)
	return scheduled, nil
}

func (m *MemoryStore) CancelZeroKnowledge(_ context.Context, userID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := m.nowFunc()
	acc, exists := m.accounts[userID]
	if !exists {
		return ErrNotFound
	}
	acc.DeleteScheduledAt = nil
	acc.Mode = ModeManaged
	acc.UpdatedAt = now
	m.accounts[userID] = acc

	m.appendAuditLocked(AppendAuditParams{
		UserID:    userID,
		ActorType: "user",
		ActorID:   strconv.FormatInt(userID, 10),
		Action:    "zero_knowledge_cancelled",
	}, now)
	return nil
}

func (m *MemoryStore) CreateRecoveryRequest(_ context.Context, params CreateRecoveryRequestParams) (RecoveryRequest, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := m.nowFunc()
	normCode := NormalizeRequestCode(params.RequestCode)
	req := RecoveryRequest{
		RequestID:       params.RequestID,
		DevicePublicKey: append([]byte(nil), params.DevicePublicKey...),
		RequestCode:     normCode,
		PollSecretHash:  params.PollSecretHash,
		ClaimedEmail:    params.ClaimedEmail,
		Status:          StatusPending,
		CreatedAt:       now,
		ExpiresAt:       now.Add(RequestExpiryHours * time.Hour),
	}
	m.requests[req.RequestID] = req
	m.codeToID[normCode] = req.RequestID

	m.appendAuditLocked(AppendAuditParams{
		UserID:     0,
		ActorType:  "device",
		ActorID:    req.RequestID,
		Action:     "recovery_requested",
		SupportRef: normCode,
	}, now)
	return req, nil
}

func (m *MemoryStore) GetRecoveryRequestByCode(_ context.Context, requestCode string) (RecoveryRequest, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	normCode := NormalizeRequestCode(requestCode)
	reqID, ok := m.codeToID[normCode]
	if !ok {
		return RecoveryRequest{}, ErrNotFound
	}
	return m.getAndRefreshRequestLocked(reqID)
}

func (m *MemoryStore) GetRecoveryRequestByID(_ context.Context, requestID string) (RecoveryRequest, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.getAndRefreshRequestLocked(requestID)
}

func (m *MemoryStore) ApproveRecoveryRequest(_ context.Context, params ApproveRecoveryParams) (RecoveryRequest, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := m.nowFunc()
	m.enforceScheduledDeletionLocked(params.LinkedUserID, now)
	acc, exists := m.accounts[params.LinkedUserID]
	if !exists || acc.Mode != ModeManaged || len(m.deposits[params.LinkedUserID]) == 0 {
		return RecoveryRequest{}, ErrZeroKnowledgeMode
	}

	req, err := m.getAndRefreshRequestLocked(params.RequestID)
	if err != nil {
		return RecoveryRequest{}, err
	}
	if req.Status == StatusExpired {
		return RecoveryRequest{}, ErrRequestExpired
	}
	if req.Status != StatusPending {
		return RecoveryRequest{}, ErrRequestNotPending
	}

	userID := params.LinkedUserID
	release := now.Add(time.Duration(params.CooldownHours) * time.Hour)
	req.Status = StatusApproved
	req.LinkedUserID = &userID
	req.SupportRef = params.SupportRef
	req.DeviceBlob = append([]byte(nil), params.DeviceBlob...)
	req.ApprovedAt = &now
	req.ReleaseAfter = &release
	m.requests[req.RequestID] = req

	m.appendAuditLocked(AppendAuditParams{
		UserID:     params.LinkedUserID,
		ActorType:  "admin",
		ActorID:    params.AdminActorID,
		Action:     "recovery_approved",
		SupportRef: params.SupportRef,
	}, now)
	return req, nil
}

func (m *MemoryStore) RejectRecoveryRequest(_ context.Context, params RejectRecoveryParams) (RecoveryRequest, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := m.nowFunc()
	req, err := m.getAndRefreshRequestLocked(params.RequestID)
	if err != nil {
		return RecoveryRequest{}, err
	}
	if req.Status != StatusPending {
		return RecoveryRequest{}, ErrRequestNotPending
	}
	req.Status = StatusRejected
	req.SupportRef = params.SupportRef
	m.requests[req.RequestID] = req

	m.appendAuditLocked(AppendAuditParams{
		UserID:     0,
		ActorType:  "admin",
		ActorID:    params.AdminActorID,
		Action:     "recovery_rejected",
		SupportRef: params.SupportRef,
	}, now)
	return req, nil
}

