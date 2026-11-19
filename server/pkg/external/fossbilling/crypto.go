package fossbilling

import (
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"github.com/ente/museum/pkg/utils/auth"
	"github.com/ente/museum/pkg/utils/crypto"
	"github.com/ente/stacktrace"
	"github.com/patrickmn/go-cache"
)

// Channel provides symmetric authenticated encryption (NaCl secretbox)
// compatible with PHP's sodium_crypto_secretbox, including replay and drift protection.
type Channel struct {
	AppID           string
	SecretKey       []byte
	ReplayCache     *cache.Cache
	MaxDriftSeconds int64
}

// NewChannel creates a new encrypted channel for the given app ID and shared secret.
func NewChannel(appID string, secret string) (*Channel, error) {
	key, err := NormalizeKey(secret)
	if err != nil {
		return nil, stacktrace.Propagate(err, "failed to normalize channel secret key")
	}
	resolvedAppID := strings.TrimSpace(appID)
	if resolvedAppID == "" {
		resolvedAppID = DefaultAppID
	}
	return &Channel{
		AppID:           resolvedAppID,
		SecretKey:       key,
		ReplayCache:     cache.New(ReplayCacheExpiration, ReplayCacheCleanupInterval),
		MaxDriftSeconds: DefaultMaxDriftSeconds,
	}, nil
}

// NormalizeKey accepts a 32-byte raw string, a 64-char hex string, or a base64 string decoding to 32 bytes.
func NormalizeKey(secret string) ([]byte, error) {
	trimmed := strings.TrimSpace(secret)
	if len(trimmed) == HexSecretKeyLength {
		if decoded, err := hex.DecodeString(trimmed); err == nil && len(decoded) == SecretBoxKeyLength {
			return decoded, nil
		}
	}
	if decoded, err := decodeBase64Key(trimmed); err == nil && len(decoded) == SecretBoxKeyLength {
		return decoded, nil
	}
	if len(trimmed) == SecretBoxKeyLength {
		return []byte(trimmed), nil
	}
	return nil, stacktrace.NewError("secret key must be 32 raw bytes, 64 hex chars, or base64 for 32 bytes")
}

func decodeBase64Key(encoded string) ([]byte, error) {
	if decoded, err := base64.StdEncoding.DecodeString(encoded); err == nil {
		return decoded, nil
	}
	return base64.RawStdEncoding.DecodeString(encoded)
}

// Seal encrypts a payload map into a wire-compatible secretbox Envelope.
func (c *Channel) Seal(payload map[string]any) (Envelope, error) {
	enriched := make(map[string]any, len(payload)+3)
	for k, v := range payload {
		enriched[k] = v
	}
	enriched["app_id"] = c.AppID
	if _, hasTimestamp := enriched["timestamp"]; !hasTimestamp {
		enriched["timestamp"] = time.Now().Unix()
	}
	if _, hasReqID := enriched["request_id"]; !hasReqID {
		enriched["request_id"] = hex.EncodeToString(auth.GenerateRandomBytes(RequestIDByteLength))
	}

	rawJSON, err := json.Marshal(enriched)
	if err != nil {
		return Envelope{}, stacktrace.Propagate(err, "failed to marshal envelope payload")
	}
	encResult, err := crypto.Encrypt(string(rawJSON), c.SecretKey)
	if err != nil {
		return Envelope{}, stacktrace.Propagate(err, "failed to encrypt envelope payload")
	}

	return Envelope{
		Version: EnvelopeVersion,
		AppID:   c.AppID,
		Nonce:   base64.StdEncoding.EncodeToString(encResult.Nonce),
		Payload: base64.StdEncoding.EncodeToString(encResult.Cipher),
	}, nil
}

// SealStruct converts a struct into a map and seals it into an Envelope.
func (c *Channel) SealStruct(payload any) (Envelope, error) {
	rawBytes, err := json.Marshal(payload)
	if err != nil {
		return Envelope{}, stacktrace.Propagate(err, "failed to marshal struct")
	}
	var payloadMap map[string]any
	if err := json.Unmarshal(rawBytes, &payloadMap); err != nil {
		return Envelope{}, stacktrace.Propagate(err, "failed to unmarshal struct into map")
	}
	return c.Seal(payloadMap)
}

// Open verifies, decrypts, and validates replay/timestamp constraints on an Envelope.
func (c *Channel) Open(env Envelope) (map[string]any, error) {
	decryptedJSON, err := c.decryptEnvelopeBytes(env)
	if err != nil {
		return nil, err
	}
	var data map[string]any
	if err := json.Unmarshal(decryptedJSON, &data); err != nil {
		return nil, stacktrace.Propagate(err, "failed to parse decrypted envelope JSON")
	}
	if err := c.validateEnvelopeClaims(data); err != nil {
		return nil, err
	}
	return data, nil
}

// OpenInto decrypts and validates an Envelope, then unmarshals the payload into target.
func (c *Channel) OpenInto(env Envelope, target any) error {
	decryptedJSON, err := c.decryptEnvelopeBytes(env)
	if err != nil {
		return err
	}
	var data map[string]any
	if err := json.Unmarshal(decryptedJSON, &data); err != nil {
		return stacktrace.Propagate(err, "failed to parse decrypted envelope JSON")
	}
	if err := c.validateEnvelopeClaims(data); err != nil {
		return err
	}
	if err := json.Unmarshal(decryptedJSON, target); err != nil {
		return stacktrace.Propagate(err, "failed to decode envelope into target struct")
	}
	return nil
}

func (c *Channel) decryptEnvelopeBytes(env Envelope) ([]byte, error) {
	if env.Version != EnvelopeVersion {
		return nil, stacktrace.NewError("unsupported envelope version: %d", env.Version)
	}
	if env.AppID != c.AppID {
		return nil, stacktrace.NewError("envelope app_id mismatch: %s", env.AppID)
	}
	nonceBytes, err := base64.StdEncoding.DecodeString(env.Nonce)
	if err != nil {
		return nil, stacktrace.Propagate(err, "invalid base64 nonce")
	}
	cipherBytes, err := base64.StdEncoding.DecodeString(env.Payload)
	if err != nil {
		return nil, stacktrace.Propagate(err, "invalid base64 payload")
	}
	plaintext, err := crypto.Decrypt(cipherBytes, c.SecretKey, nonceBytes)
	if err != nil {
		return nil, stacktrace.Propagate(err, "envelope decryption failed")
	}
	return []byte(plaintext), nil
}

func (c *Channel) validateEnvelopeClaims(data map[string]any) error {
	if innerAppID, ok := data["app_id"].(string); ok && innerAppID != "" && innerAppID != c.AppID {
		return stacktrace.NewError("inner app_id mismatch: %s", innerAppID)
	}
	timestamp, err := extractTimestamp(data["timestamp"])
	if err != nil {
		return err
	}
	maxDrift := c.MaxDriftSeconds
	if maxDrift <= 0 {
		maxDrift = DefaultMaxDriftSeconds
	}
	drift := time.Now().Unix() - timestamp
	if drift < -maxDrift || drift > maxDrift {
		return stacktrace.NewError("envelope timestamp outside allowed drift window")
	}

	reqID, _ := data["request_id"].(string)
	if strings.TrimSpace(reqID) == "" {
		return stacktrace.NewError("missing request_id in envelope payload")
	}
	if c.ReplayCache == nil {
		c.ReplayCache = cache.New(ReplayCacheExpiration, ReplayCacheCleanupInterval)
	}
	if _, found := c.ReplayCache.Get(reqID); found {
		return stacktrace.NewError("replayed request_id rejected: %s", reqID)
	}
	c.ReplayCache.Set(reqID, true, ReplayCacheExpiration)
	return nil
}

func extractTimestamp(raw any) (int64, error) {
	switch v := raw.(type) {
	case float64:
		return int64(v), nil
	case int64:
		return v, nil
	case int:
		return int64(v), nil
	case json.Number:
		return v.Int64()
	case string:
		return strconv.ParseInt(v, 10, 64)
	default:
		return 0, stacktrace.NewError("missing or invalid timestamp in envelope payload")
	}
}
