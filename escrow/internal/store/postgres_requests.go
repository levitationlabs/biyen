package store

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

func (p *PostgresStore) CreateRecoveryRequest(ctx context.Context, params CreateRecoveryRequestParams) (RecoveryRequest, error) {
	now := p.currentNow()
	expiresAt := now.Add(RequestExpiryHours * time.Hour)
	normCode := NormalizeRequestCode(params.RequestCode)

	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return RecoveryRequest{}, err
	}
	defer func() { _ = tx.Rollback() }()

	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO escrow.recovery_requests
		 (request_id, device_public_key, request_code, poll_secret_hash, claimed_email, status, created_at, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		params.RequestID, params.DevicePublicKey, normCode, params.PollSecretHash[:], params.ClaimedEmail, StatusPending, now, expiresAt,
	)
	if err != nil {
		return RecoveryRequest{}, err
	}
	if err := p.appendAuditTx(ctx, tx, AppendAuditParams{
		UserID:     0,
		ActorType:  "device",
		ActorID:    params.RequestID,
		Action:     "recovery_requested",
		SupportRef: normCode,
	}); err != nil {
		return RecoveryRequest{}, err
	}
	if err := tx.Commit(); err != nil {
		return RecoveryRequest{}, err
	}
	return RecoveryRequest{
		RequestID:       params.RequestID,
		DevicePublicKey: append([]byte(nil), params.DevicePublicKey...),
		RequestCode:     normCode,
		PollSecretHash:  params.PollSecretHash,
		ClaimedEmail:    params.ClaimedEmail,
		Status:          StatusPending,
		CreatedAt:       now,
		ExpiresAt:       expiresAt,
	}, nil
}

func (p *PostgresStore) GetRecoveryRequestByCode(ctx context.Context, requestCode string) (RecoveryRequest, error) {
	normCode := NormalizeRequestCode(requestCode)
	return p.queryRecoveryRequest(ctx, `WHERE request_code = $1`, normCode)
}

func (p *PostgresStore) GetRecoveryRequestByID(ctx context.Context, requestID string) (RecoveryRequest, error) {
	return p.queryRecoveryRequest(ctx, `WHERE request_id::text = $1`, requestID)
}

func (p *PostgresStore) ApproveRecoveryRequest(ctx context.Context, params ApproveRecoveryParams) (RecoveryRequest, error) {
	now := p.currentNow()
	acc, deps, err := p.ListUserDeposits(ctx, params.LinkedUserID)
	if err != nil {
		return RecoveryRequest{}, err
	}
	if acc.Mode != ModeManaged || len(deps) == 0 {
		return RecoveryRequest{}, ErrZeroKnowledgeMode
	}

	req, err := p.GetRecoveryRequestByID(ctx, params.RequestID)
	if err != nil {
		return RecoveryRequest{}, err
	}
	if req.Status == StatusExpired {
		return RecoveryRequest{}, ErrRequestExpired
	}
	if req.Status != StatusPending {
		return RecoveryRequest{}, ErrRequestNotPending
	}

	release := now.Add(time.Duration(params.CooldownHours) * time.Hour)
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return RecoveryRequest{}, err
	}
	defer func() { _ = tx.Rollback() }()

	_, err = tx.ExecContext(
		ctx,
		`UPDATE escrow.recovery_requests
		 SET status = $2, linked_user_id = $3, support_ref = $4, device_blob = $5, approved_at = $6, release_after = $7
		 WHERE request_id::text = $1`,
		params.RequestID, StatusApproved, params.LinkedUserID, params.SupportRef, params.DeviceBlob, now, release,
	)
	if err != nil {
		return RecoveryRequest{}, err
	}
	if err := p.appendAuditTx(ctx, tx, AppendAuditParams{
		UserID:     params.LinkedUserID,
		ActorType:  "admin",
		ActorID:    params.AdminActorID,
		Action:     "recovery_approved",
		SupportRef: params.SupportRef,
	}); err != nil {
		return RecoveryRequest{}, err
	}
	if err := tx.Commit(); err != nil {
		return RecoveryRequest{}, err
	}
	return p.GetRecoveryRequestByID(ctx, params.RequestID)
}

func (p *PostgresStore) RejectRecoveryRequest(ctx context.Context, params RejectRecoveryParams) (RecoveryRequest, error) {
	req, err := p.GetRecoveryRequestByID(ctx, params.RequestID)
	if err != nil {
		return RecoveryRequest{}, err
	}
	if req.Status != StatusPending {
		return RecoveryRequest{}, ErrRequestNotPending
	}

	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return RecoveryRequest{}, err
	}
	defer func() { _ = tx.Rollback() }()

	_, err = tx.ExecContext(
		ctx,
		`UPDATE escrow.recovery_requests SET status = $2, support_ref = $3 WHERE request_id::text = $1`,
		params.RequestID, StatusRejected, params.SupportRef,
	)
	if err != nil {
		return RecoveryRequest{}, err
	}
	if err := p.appendAuditTx(ctx, tx, AppendAuditParams{
		UserID:     0,
		ActorType:  "admin",
		ActorID:    params.AdminActorID,
		Action:     "recovery_rejected",
		SupportRef: params.SupportRef,
	}); err != nil {
		return RecoveryRequest{}, err
	}
	if err := tx.Commit(); err != nil {
		return RecoveryRequest{}, err
	}
	return p.GetRecoveryRequestByID(ctx, params.RequestID)
}

func (p *PostgresStore) PollRecoveryRequest(ctx context.Context, requestID string, pollSecret string) (RecoveryRequest, error) {
	now := p.currentNow()
	req, err := p.GetRecoveryRequestByID(ctx, requestID)
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
		req.DeviceBlob = nil
		return req, ErrRequestNotReady
	}

	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return RecoveryRequest{}, err
	}
	defer func() { _ = tx.Rollback() }()

	_, err = tx.ExecContext(
		ctx,
		`UPDATE escrow.recovery_requests SET status = $2, consumed_at = $3 WHERE request_id::text = $1`,
		requestID, StatusConsumed, now,
	)
	if err != nil {
		return RecoveryRequest{}, err
	}
	uid := int64(0)
	if req.LinkedUserID != nil {
		uid = *req.LinkedUserID
	}
	if err := p.appendAuditTx(ctx, tx, AppendAuditParams{
		UserID:     uid,
		ActorType:  "device",
		ActorID:    requestID,
		Action:     "recovery_consumed",
		SupportRef: req.SupportRef,
	}); err != nil {
		return RecoveryRequest{}, err
	}
	if err := tx.Commit(); err != nil {
		return RecoveryRequest{}, err
	}
	req.Status = StatusConsumed
	req.ConsumedAt = &now
	return req, nil
}

func (p *PostgresStore) queryRecoveryRequest(ctx context.Context, whereClause string, arg string) (RecoveryRequest, error) {
	query := `SELECT request_id::text, device_public_key, request_code, poll_secret_hash, claimed_email,
	                 status, linked_user_id, support_ref, device_blob, created_at, approved_at, release_after, expires_at, consumed_at
	          FROM escrow.recovery_requests ` + whereClause
	var r RecoveryRequest
	var hashSlice []byte
	var linkedUID sql.NullInt64
	var appAt, relAt, conAt sql.NullTime
	err := p.db.QueryRowContext(ctx, query, arg).Scan(
		&r.RequestID, &r.DevicePublicKey, &r.RequestCode, &hashSlice, &r.ClaimedEmail,
		&r.Status, &linkedUID, &r.SupportRef, &r.DeviceBlob, &r.CreatedAt, &appAt, &relAt, &r.ExpiresAt, &conAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return RecoveryRequest{}, ErrNotFound
	}
	if err != nil {
		return RecoveryRequest{}, err
	}
	copy(r.PollSecretHash[:], hashSlice)
	r.CreatedAt = r.CreatedAt.UTC()
	r.ExpiresAt = r.ExpiresAt.UTC()
	if linkedUID.Valid {
		uid := linkedUID.Int64
		r.LinkedUserID = &uid
	}
	if appAt.Valid {
		t := appAt.Time.UTC()
		r.ApprovedAt = &t
	}
	if relAt.Valid {
		t := relAt.Time.UTC()
		r.ReleaseAfter = &t
	}
	if conAt.Valid {
		t := conAt.Time.UTC()
		r.ConsumedAt = &t
	}
	now := p.currentNow()
	if r.Status == StatusPending && !now.Before(r.ExpiresAt) {
		r.Status = StatusExpired
		_, _ = p.db.ExecContext(ctx, `UPDATE escrow.recovery_requests SET status = $2 WHERE request_id::text = $1`, r.RequestID, StatusExpired)
	}
	return r, nil
}
