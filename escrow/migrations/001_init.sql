CREATE SCHEMA IF NOT EXISTS escrow;

CREATE TABLE IF NOT EXISTS escrow.deposits (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    kek_version TEXT NOT NULL,
    cipher_suite TEXT NOT NULL,
    custody_blob BYTEA NOT NULL,
    recovery_key_commitment BYTEA NOT NULL CHECK (octet_length(recovery_key_commitment) = 64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_deposits_user_created
    ON escrow.deposits (user_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS escrow.accounts (
    user_id BIGINT PRIMARY KEY,
    mode TEXT NOT NULL CHECK (mode IN ('managed', 'zero_knowledge')),
    delete_scheduled_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escrow.recovery_requests (
    request_id UUID PRIMARY KEY,
    device_public_key BYTEA NOT NULL CHECK (octet_length(device_public_key) = 1216),
    request_code TEXT NOT NULL UNIQUE,
    poll_secret_hash BYTEA NOT NULL CHECK (octet_length(poll_secret_hash) = 64),
    claimed_email TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'consumed', 'expired', 'rejected')),
    linked_user_id BIGINT NULL,
    support_ref TEXT NOT NULL DEFAULT '',
    device_blob BYTEA NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ NULL,
    release_after TIMESTAMPTZ NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_escrow_recovery_requests_code
    ON escrow.recovery_requests (request_code);

CREATE TABLE IF NOT EXISTS escrow.audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL DEFAULT 0,
    actor_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    support_ref TEXT NOT NULL DEFAULT '',
    prev_hash BYTEA NOT NULL CHECK (octet_length(prev_hash) = 64),
    entry_hash BYTEA NOT NULL CHECK (octet_length(entry_hash) = 64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_audit_log_id
    ON escrow.audit_log (id ASC);
