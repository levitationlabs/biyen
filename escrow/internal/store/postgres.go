package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/ente/escrow/internal/envelope"
	_ "github.com/lib/pq"
)

type PostgresStore struct {
	db      *sql.DB
	auditMu sync.Mutex
	nowFunc func() time.Time
}

func NewPostgresStore(dsn string, migrationSQL string) (*PostgresStore, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}
	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	if migrationSQL != "" {
		if _, err := db.Exec(migrationSQL); err != nil {
			_ = db.Close()
			return nil, fmt.Errorf("run escrow migrations: %w", err)
		}
	}
	return &PostgresStore{
		db:      db,
		nowFunc: func() time.Time { return time.Now().UTC() },
	}, nil
}

func (p *PostgresStore) Close() error {
	return p.db.Close()
}

func (p *PostgresStore) SetClock(nowFunc func() time.Time) {
	p.auditMu.Lock()
	defer p.auditMu.Unlock()
	p.nowFunc = nowFunc
}

func (p *PostgresStore) SaveDeposit(ctx context.Context, params SaveDepositParams) (Deposit, error) {
	now := p.currentNow()
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return Deposit{}, err
	}
	defer func() { _ = tx.Rollback() }()

	var depID int64
	err = tx.QueryRowContext(
		ctx,
		`INSERT INTO escrow.deposits (user_id, kek_version, cipher_suite, custody_blob, recovery_key_commitment, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		params.UserID, params.KEKVersion, params.CipherSuite, params.CustodyBlob, params.RecoveryKeyCommitment[:], now,
	).Scan(&depID)
	if err != nil {
		return Deposit{}, fmt.Errorf("insert deposit: %w", err)
	}

	_, err = tx.ExecContext(
		ctx,
		`DELETE FROM escrow.deposits
		 WHERE user_id = $1 AND id NOT IN (
		     SELECT id FROM escrow.deposits WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2
		 )`,
		params.UserID, MaxDepositsPerUser,
	)
	if err != nil {
		return Deposit{}, fmt.Errorf("prune old deposits: %w", err)
	}

	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO escrow.accounts (user_id, mode, delete_scheduled_at, updated_at)
		 VALUES ($1, $2, NULL, $3)
		 ON CONFLICT (user_id) DO UPDATE SET mode = EXCLUDED.mode, delete_scheduled_at = NULL, updated_at = EXCLUDED.updated_at`,
		params.UserID, ModeManaged, now,
	)
	if err != nil {
		return Deposit{}, fmt.Errorf("upsert account: %w", err)
	}

	if err := p.appendAuditTx(ctx, tx, AppendAuditParams{
		UserID:    params.UserID,
		ActorType: "user",
		ActorID:   strconv.FormatInt(params.UserID, 10),
		Action:    "deposit_stored",
	}); err != nil {
		return Deposit{}, err
	}
	if err := tx.Commit(); err != nil {
		return Deposit{}, err
	}
	return Deposit{
		ID:                    depID,
		UserID:                params.UserID,
		KEKVersion:            params.KEKVersion,
		CipherSuite:           params.CipherSuite,
		CustodyBlob:           append([]byte(nil), params.CustodyBlob...),
		RecoveryKeyCommitment: params.RecoveryKeyCommitment,
		CommitmentBytes:       append([]byte(nil), params.RecoveryKeyCommitment[:]...),
		CreatedAt:             now,
	}, nil
}

func (p *PostgresStore) GetAccountStatus(ctx context.Context, userID int64) (AccountStatus, error) {
	acc, deps, err := p.ListUserDeposits(ctx, userID)
	if err != nil {
		return AccountStatus{}, err
	}
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

func (p *PostgresStore) ListUserDeposits(ctx context.Context, userID int64) (Account, []Deposit, error) {
	now := p.currentNow()
	if err := p.enforceScheduledDeletion(ctx, userID, now); err != nil {
		return Account{}, nil, err
	}
	var acc Account
	var delAt sql.NullTime
	err := p.db.QueryRowContext(
		ctx,
		`SELECT user_id, mode, delete_scheduled_at, updated_at FROM escrow.accounts WHERE user_id = $1`,
		userID,
	).Scan(&acc.UserID, &acc.Mode, &delAt, &acc.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Account{UserID: userID, Mode: ModeZeroKnowledge, UpdatedAt: now}, []Deposit{}, nil
	}
	if err != nil {
		return Account{}, nil, err
	}
	if delAt.Valid {
		t := delAt.Time.UTC()
		acc.DeleteScheduledAt = &t
	}

	rows, err := p.db.QueryContext(
		ctx,
		`SELECT id, user_id, kek_version, cipher_suite, custody_blob, recovery_key_commitment, created_at
		 FROM escrow.deposits WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
		userID, MaxDepositsPerUser,
	)
	if err != nil {
		return Account{}, nil, err
	}
	defer func() { _ = rows.Close() }()

	deps := make([]Deposit, 0)
	for rows.Next() {
		var d Deposit
		var commitSlice []byte
		if err := rows.Scan(&d.ID, &d.UserID, &d.KEKVersion, &d.CipherSuite, &d.CustodyBlob, &commitSlice, &d.CreatedAt); err != nil {
			return Account{}, nil, err
		}
		copy(d.RecoveryKeyCommitment[:], commitSlice)
		d.CommitmentBytes = append([]byte(nil), commitSlice...)
		d.CreatedAt = d.CreatedAt.UTC()
		deps = append(deps, d)
	}
	return acc, deps, rows.Err()
}

func (p *PostgresStore) ScheduleZeroKnowledge(ctx context.Context, userID int64) (time.Time, error) {
	now := p.currentNow()
	scheduled := now.Add(DeleteGracePeriodDays * 24 * time.Hour)
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return time.Time{}, err
	}
	defer func() { _ = tx.Rollback() }()

	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO escrow.accounts (user_id, mode, delete_scheduled_at, updated_at)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id) DO UPDATE SET delete_scheduled_at = EXCLUDED.delete_scheduled_at, updated_at = EXCLUDED.updated_at`,
		userID, ModeManaged, scheduled, now,
	)
	if err != nil {
		return time.Time{}, err
	}
	if err := p.appendAuditTx(ctx, tx, AppendAuditParams{
		UserID:    userID,
		ActorType: "user",
		ActorID:   strconv.FormatInt(userID, 10),
		Action:    "zero_knowledge_scheduled",
	}); err != nil {
		return time.Time{}, err
	}
	return scheduled, tx.Commit()
}

func (p *PostgresStore) CancelZeroKnowledge(ctx context.Context, userID int64) error {
	now := p.currentNow()
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	res, err := tx.ExecContext(
		ctx,
		`UPDATE escrow.accounts SET delete_scheduled_at = NULL, mode = $2, updated_at = $3 WHERE user_id = $1`,
		userID, ModeManaged, now,
	)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return ErrNotFound
	}
	if err := p.appendAuditTx(ctx, tx, AppendAuditParams{
		UserID:    userID,
		ActorType: "user",
		ActorID:   strconv.FormatInt(userID, 10),
		Action:    "zero_knowledge_cancelled",
	}); err != nil {
		return err
	}
	return tx.Commit()
}

func (p *PostgresStore) currentNow() time.Time {
	p.auditMu.Lock()
	defer p.auditMu.Unlock()
	return p.nowFunc().UTC().Truncate(time.Microsecond)
}

func (p *PostgresStore) appendAuditTx(ctx context.Context, tx *sql.Tx, params AppendAuditParams) error {
	p.auditMu.Lock()
	defer p.auditMu.Unlock()

	now := p.nowFunc().UTC().Truncate(time.Microsecond)
	var prevSlice []byte
	var lastID int64
	err := tx.QueryRowContext(
		ctx,
		`SELECT id, entry_hash FROM escrow.audit_log ORDER BY id DESC LIMIT 1`,
	).Scan(&lastID, &prevSlice)
	var prevHash [envelope.CommitmentBytes]byte
	if err == nil {
		copy(prevHash[:], prevSlice)
	} else if !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	var newID int64
	err = tx.QueryRowContext(
		ctx,
		`INSERT INTO escrow.audit_log (user_id, actor_type, actor_id, action, support_ref, prev_hash, entry_hash, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $6, $7) RETURNING id`,
		params.UserID, params.ActorType, params.ActorID, params.Action, params.SupportRef, prevHash[:], now,
	).Scan(&newID)
	if err != nil {
		return err
	}
	entryHash := envelope.ComputeAuditEntryHash(envelope.AuditChainInput{
		ID:                newID,
		UserID:            params.UserID,
		ActorType:         params.ActorType,
		ActorID:           params.ActorID,
		Action:            params.Action,
		SupportRef:        params.SupportRef,
		CreatedAtUnixNano: now.UnixNano(),
		PrevHash:          prevHash,
	})
	_, err = tx.ExecContext(ctx, `UPDATE escrow.audit_log SET entry_hash = $2 WHERE id = $1`, newID, entryHash[:])
	return err
}

