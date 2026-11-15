package store

import (
	"context"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/ente/escrow/internal/envelope"
)

const (
	ModeManaged       = "managed"
	ModeZeroKnowledge = "zero_knowledge"

	StatusPending  = "pending"
	StatusApproved = "approved"
	StatusConsumed = "consumed"
	StatusExpired  = "expired"
	StatusRejected = "rejected"

	MaxDepositsPerUser    = 5
	DeleteGracePeriodDays = 7
	RequestExpiryHours    = 72
)

var (
	ErrNotFound          = errors.New("store: record not found")
	ErrZeroKnowledgeMode = errors.New("store: account is in zero_knowledge mode")
	ErrInvalidPollSecret = errors.New("store: invalid poll secret")
	ErrRequestNotReady   = errors.New("store: recovery request not ready for download")
	ErrRequestConsumed   = errors.New("store: recovery request already consumed")
	ErrRequestExpired    = errors.New("store: recovery request expired")
	ErrRequestNotPending = errors.New("store: recovery request is not in pending state")
)

type Deposit struct {
	ID                    int64                            `json:"id"`
	UserID                int64                            `json:"user_id"`
	KEKVersion            string                           `json:"kek_version"`
	CipherSuite           string                           `json:"cipher_suite"`
	CustodyBlob           []byte                           `json:"custody_blob"`
	RecoveryKeyCommitment [envelope.CommitmentBytes]byte   `json:"-"`
	CommitmentBytes       []byte                           `json:"recovery_key_commitment"`
	CreatedAt             time.Time                        `json:"created_at"`
}

type Account struct {
	UserID            int64      `json:"user_id"`
	Mode              string     `json:"mode"`
	DeleteScheduledAt *time.Time `json:"delete_scheduled_at,omitempty"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type AccountStatus struct {
	Mode                  string     `json:"mode"`
	KEKVersion            string     `json:"kek_version,omitempty"`
	RecoveryKeyCommitment []byte     `json:"recovery_key_commitment,omitempty"`
	DeleteScheduledAt     *time.Time `json:"delete_scheduled_at,omitempty"`
	DepositCount          int        `json:"deposit_count"`
}

type RecoveryRequest struct {
	RequestID       string                         `json:"request_id"`
	DevicePublicKey []byte                         `json:"device_public_key"`
	RequestCode     string                         `json:"request_code"`
	PollSecretHash  [envelope.CommitmentBytes]byte `json:"-"`
	ClaimedEmail    string                         `json:"claimed_email,omitempty"`
	Status          string                         `json:"status"`
	LinkedUserID    *int64                         `json:"linked_user_id,omitempty"`
	SupportRef      string                         `json:"support_ref,omitempty"`
	DeviceBlob      []byte                         `json:"device_blob,omitempty"`
	CreatedAt       time.Time                      `json:"created_at"`
	ApprovedAt      *time.Time                     `json:"approved_at,omitempty"`
	ReleaseAfter    *time.Time                     `json:"release_after,omitempty"`
	ExpiresAt       time.Time                      `json:"expires_at"`
	ConsumedAt      *time.Time                     `json:"consumed_at,omitempty"`
}

type AuditEntry struct {
	ID         int64                          `json:"id"`
	UserID     int64                          `json:"user_id"`
	ActorType  string                         `json:"actor_type"`
	ActorID    string                         `json:"actor_id"`
	Action     string                         `json:"action"`
	SupportRef string                         `json:"support_ref,omitempty"`
	PrevHash   [envelope.CommitmentBytes]byte `json:"-"`
	EntryHash  [envelope.CommitmentBytes]byte `json:"-"`
	PrevHex    string                         `json:"prev_hash"`
	EntryHex   string                         `json:"entry_hash"`
	CreatedAt  time.Time                      `json:"created_at"`
}

type SaveDepositParams struct {
	UserID                int64
	KEKVersion            string
	CipherSuite           string
	CustodyBlob           []byte
	RecoveryKeyCommitment [envelope.CommitmentBytes]byte
}

type CreateRecoveryRequestParams struct {
	RequestID       string
	DevicePublicKey []byte
	RequestCode     string
	PollSecretHash  [envelope.CommitmentBytes]byte
	ClaimedEmail    string
}

type ApproveRecoveryParams struct {
	RequestID     string
	LinkedUserID  int64
	SupportRef    string
	DeviceBlob    []byte
	CooldownHours int
	AdminActorID  string
}

type RejectRecoveryParams struct {
	RequestID    string
	SupportRef   string
	AdminActorID string
}

type AppendAuditParams struct {
	UserID     int64
	ActorType  string
	ActorID    string
	Action     string
	SupportRef string
}

type Store interface {
	SaveDeposit(ctx context.Context, params SaveDepositParams) (Deposit, error)
	GetAccountStatus(ctx context.Context, userID int64) (AccountStatus, error)
	ListUserDeposits(ctx context.Context, userID int64) (Account, []Deposit, error)
	ScheduleZeroKnowledge(ctx context.Context, userID int64) (time.Time, error)
	CancelZeroKnowledge(ctx context.Context, userID int64) error
	CreateRecoveryRequest(ctx context.Context, params CreateRecoveryRequestParams) (RecoveryRequest, error)
	GetRecoveryRequestByCode(ctx context.Context, requestCode string) (RecoveryRequest, error)
	GetRecoveryRequestByID(ctx context.Context, requestID string) (RecoveryRequest, error)
	ApproveRecoveryRequest(ctx context.Context, params ApproveRecoveryParams) (RecoveryRequest, error)
	RejectRecoveryRequest(ctx context.Context, params RejectRecoveryParams) (RecoveryRequest, error)
	PollRecoveryRequest(ctx context.Context, requestID string, pollSecret string) (RecoveryRequest, error)
	ListAuditLog(ctx context.Context) ([]AuditEntry, error)
}

func VerifyPollSecretConstantTime(pollSecret string, expectedHash [envelope.CommitmentBytes]byte) bool {
	trimmed := strings.TrimSpace(pollSecret)
	if trimmed == "" {
		return false
	}
	rawDigest := sha512.Sum512([]byte(trimmed))
	matched := subtle.ConstantTimeCompare(rawDigest[:], expectedHash[:]) == 1

	if decodedHex, err := hex.DecodeString(trimmed); err == nil && len(decodedHex) > 0 {
		hexDigest := sha512.Sum512(decodedHex)
		if subtle.ConstantTimeCompare(hexDigest[:], expectedHash[:]) == 1 {
			matched = true
		}
	}
	for _, enc := range []*base64.Encoding{base64.StdEncoding, base64.RawStdEncoding, base64.URLEncoding, base64.RawURLEncoding} {
		if decodedB64, err := enc.DecodeString(trimmed); err == nil && len(decodedB64) > 0 {
			b64Digest := sha512.Sum512(decodedB64)
			if subtle.ConstantTimeCompare(b64Digest[:], expectedHash[:]) == 1 {
				matched = true
			}
		}
	}
	return matched
}

func NormalizeRequestCode(code string) string {
	upper := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(code), "-", ""))
	if len(upper) != envelope.RequestCodeRawChars {
		return strings.ToUpper(strings.TrimSpace(code))
	}
	return upper[0:5] + "-" + upper[5:10] + "-" + upper[10:15] + "-" + upper[15:20]
}
