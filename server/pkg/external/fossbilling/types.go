package fossbilling

import (
	"strconv"
	"strings"
	"time"
)

const (
	EnvelopeVersion            = 1
	DefaultAppID               = "biyen"
	DefaultMaxDriftSeconds     = int64(300)
	ReplayCacheExpiration      = 10 * time.Minute
	ReplayCacheCleanupInterval = 15 * time.Minute
	RequestIDByteLength        = 16
	SecretBoxKeyLength         = 32
	HexSecretKeyLength         = 64
	DefaultHTTPTimeout         = 15 * time.Second

	TransactionPrefix = "fb:"

	ActionBuy    = "buy"
	ActionUpdate = "update"

	WebhookActionActivate  = "activate"
	WebhookActionRenew     = "renew"
	WebhookActionSuspend   = "suspend"
	WebhookActionCancel    = "cancel"
	WebhookActionUnsuspend = "unsuspend"

	AccountEventEmailChanged   = "email_changed"
	AccountEventAccountDeleted = "account_deleted"

	StatusPendingRegistration = "pending_registration"
	StatusProvisioned         = "provisioned"
	StatusDowngraded          = "downgraded"

	EndpointCheckoutSession  = "/api/guest/servicesaas/checkout_session"
	EndpointClaimEntitlement = "/api/guest/servicesaas/claim_entitlement"
	EndpointAccountEvent     = "/api/guest/servicesaas/account_event"
)

// Envelope represents the wire-compatiblelibsodium secretbox JSON payload
// exchanged between FOSSBilling and Biyen Museum.
type Envelope struct {
	Version int    `json:"v"`
	AppID   string `json:"app_id"`
	Nonce   string `json:"nonce"`
	Payload string `json:"payload"`
}

// FlexInt64 unmarshals JSON integers, numeric strings, empty strings, and null into int64.
type FlexInt64 int64

// UnmarshalJSON parses a JSON number, quoted integer string, empty string, or null.
func (f *FlexInt64) UnmarshalJSON(data []byte) error {
	trimmed := strings.TrimSpace(string(data))
	if trimmed == "" || trimmed == "null" {
		*f = 0
		return nil
	}
	if len(trimmed) >= 2 && trimmed[0] == '"' && trimmed[len(trimmed)-1] == '"' {
		unquoted, err := strconv.Unquote(trimmed)
		if err != nil {
			return err
		}
		trimmed = strings.TrimSpace(unquoted)
		if trimmed == "" {
			*f = 0
			return nil
		}
	}
	parsed, err := strconv.ParseInt(trimmed, 10, 64)
	if err != nil {
		return err
	}
	*f = FlexInt64(parsed)
	return nil
}

// PlanMetadata holds plan quota details sent by FOSSBilling.
type PlanMetadata struct {
	StorageBytes FlexInt64 `json:"storage_bytes"`
}

// WebhookCommand represents a decrypted provisioning command from FOSSBilling.
type WebhookCommand struct {
	Action         string       `json:"action"`
	OrderID        FlexInt64    `json:"order_id"`
	ClientID       FlexInt64    `json:"client_id"`
	Email          string       `json:"email"`
	ExternalUserID FlexInt64    `json:"external_user_id"`
	PlanID         string       `json:"plan_id"`
	PlanMetadata   PlanMetadata `json:"plan_metadata"`
	StorageBytes   FlexInt64    `json:"storage_bytes"`
	ExpiresAtMicro FlexInt64    `json:"expires_at_micro"`
}

// EffectiveStorageBytes returns the storage quota from PlanMetadata or the top-level field.
func (c WebhookCommand) EffectiveStorageBytes() int64 {
	if c.PlanMetadata.StorageBytes > 0 {
		return int64(c.PlanMetadata.StorageBytes)
	}
	return int64(c.StorageBytes)
}

// CreateCheckoutParams holds parameters for creating a FOSSBilling checkout session.
type CreateCheckoutParams struct {
	UserID      int64  `json:"userID"`
	ProductID   string `json:"productID"`
	Action      string `json:"action"`
	RedirectURL string `json:"redirectURL"`
}

// CheckoutSessionRequest is the encrypted payload sent to FOSSBilling checkout_session.
type CheckoutSessionRequest struct {
	ExternalUserID FlexInt64 `json:"external_user_id"`
	Email          string    `json:"email"`
	PlanID         string    `json:"plan_id"`
	Action         string    `json:"action"`
	RedirectURL    string    `json:"redirect_url"`
}

// CheckoutSessionResult is the decrypted response from FOSSBilling checkout_session.
type CheckoutSessionResult struct {
	CheckoutURL string    `json:"checkout_url"`
	OrderID     FlexInt64 `json:"order_id"`
	InvoiceHash string    `json:"invoice_hash"`
}

// ClaimEntitlementRequest is the encrypted payload sent to FOSSBilling claim_entitlement.
type ClaimEntitlementRequest struct {
	ExternalUserID FlexInt64 `json:"external_user_id"`
	Email          string    `json:"email"`
}

// ClaimEntitlementResult is the decrypted response from FOSSBilling claim_entitlement.
type ClaimEntitlementResult struct {
	Matched        bool         `json:"matched"`
	OrderID        FlexInt64    `json:"order_id"`
	ClientID       FlexInt64    `json:"client_id"`
	PlanID         string       `json:"plan_id"`
	PlanMetadata   PlanMetadata `json:"plan_metadata"`
	StorageBytes   FlexInt64    `json:"storage_bytes"`
	ExpiresAtMicro FlexInt64    `json:"expires_at_micro"`
}

// EffectiveStorageBytes returns the storage quota from PlanMetadata or the top-level field.
func (r ClaimEntitlementResult) EffectiveStorageBytes() int64 {
	if r.PlanMetadata.StorageBytes > 0 {
		return int64(r.PlanMetadata.StorageBytes)
	}
	return int64(r.StorageBytes)
}

// AccountEventRequest is the encrypted payload sent to FOSSBilling account_event.
type AccountEventRequest struct {
	Event          string    `json:"event"`
	ExternalUserID FlexInt64 `json:"external_user_id"`
	Email          string    `json:"email,omitempty"`
}
