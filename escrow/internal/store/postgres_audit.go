package store

import (
	"context"
	"database/sql"
	"encoding/hex"
	"errors"
	"strconv"
	"time"
)

func (p *PostgresStore) enforceScheduledDeletion(ctx context.Context, userID int64, now time.Time) error {
	var delAt sql.NullTime
	err := p.db.QueryRowContext(
		ctx,
		`SELECT delete_scheduled_at FROM escrow.accounts WHERE user_id = $1`,
		userID,
	).Scan(&delAt)
	if errors.Is(err, sql.ErrNoRows) || !delAt.Valid || now.Before(delAt.Time.UTC()) {
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		return err
	}

	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, `DELETE FROM escrow.deposits WHERE user_id = $1`, userID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(
		ctx,
		`UPDATE escrow.accounts SET mode = $2, delete_scheduled_at = NULL, updated_at = $3 WHERE user_id = $1`,
		userID, ModeZeroKnowledge, now,
	); err != nil {
		return err
	}
	if err := p.appendAuditTx(ctx, tx, AppendAuditParams{
		UserID:    userID,
		ActorType: "system",
		ActorID:   strconv.FormatInt(userID, 10),
		Action:    "zero_knowledge_purged",
	}); err != nil {
		return err
	}
	return tx.Commit()
}

func (p *PostgresStore) ListAuditLog(ctx context.Context) ([]AuditEntry, error) {
	rows, err := p.db.QueryContext(
		ctx,
		`SELECT id, user_id, actor_type, actor_id, action, support_ref, prev_hash, entry_hash, created_at
		 FROM escrow.audit_log ORDER BY id ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	entries := make([]AuditEntry, 0)
	for rows.Next() {
		var e AuditEntry
		var prevSlice, entrySlice []byte
		if err := rows.Scan(&e.ID, &e.UserID, &e.ActorType, &e.ActorID, &e.Action, &e.SupportRef, &prevSlice, &entrySlice, &e.CreatedAt); err != nil {
			return nil, err
		}
		copy(e.PrevHash[:], prevSlice)
		copy(e.EntryHash[:], entrySlice)
		e.PrevHex = hex.EncodeToString(e.PrevHash[:])
		e.EntryHex = hex.EncodeToString(e.EntryHash[:])
		e.CreatedAt = e.CreatedAt.UTC()
		entries = append(entries, e)
	}
	return entries, rows.Err()
}
