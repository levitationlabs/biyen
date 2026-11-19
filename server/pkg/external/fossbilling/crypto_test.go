package fossbilling

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/nacl/secretbox"
)

func TestNormalizeKey_ValidFormats_Returns32ByteKey(t *testing.T) {
	// Arrange
	rawKey := []byte("0123456789abcdef0123456789abcdef")
	cases := []struct {
		name  string
		input string
		want  []byte
	}{
		{name: "32-byte raw string", input: string(rawKey), want: rawKey},
		{name: "64-char hex", input: hex.EncodeToString(rawKey), want: rawKey},
		{name: "standard padded base64", input: base64.StdEncoding.EncodeToString(rawKey), want: rawKey},
		{name: "raw unpadded base64", input: base64.RawStdEncoding.EncodeToString(rawKey), want: rawKey},
		{name: "whitespace trimmed", input: "  " + hex.EncodeToString(rawKey) + "\n", want: rawKey},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// Act
			got, err := NormalizeKey(tc.input)

			// Assert
			require.NoError(t, err)
			require.Len(t, got, SecretBoxKeyLength)
			require.Equal(t, tc.want, got)
		})
	}
}

func TestNormalizeKey_InvalidLengthsAndEncodings_ReturnsError(t *testing.T) {
	// Arrange
	cases := []struct {
		name  string
		input string
	}{
		{name: "empty", input: ""},
		{name: "short string", input: "too-short"},
		{name: "31-byte raw string", input: "0123456789abcdef0123456789abcde"},
		{name: "33-byte raw string", input: "0123456789abcdef0123456789abcdef0"},
		{name: "64-char non-hex", input: "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"},
		{name: "base64 decoding to 16 bytes", input: base64.StdEncoding.EncodeToString(make([]byte, 16))},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// Act
			_, err := NormalizeKey(tc.input)

			// Assert
			require.Error(t, err)
		})
	}
}

func TestChannel_SealAndOpen_RoundTripsPayloadAndClaims(t *testing.T) {
	// Arrange
	sender := newTestChannel(t, DefaultAppID)
	receiver := newTestChannel(t, DefaultAppID)
	req := CheckoutSessionRequest{
		ExternalUserID: 42,
		Email:          "alice@example.com",
		PlanID:         "50gb_monthly_v4",
		Action:         ActionBuy,
		RedirectURL:    "https://photos.example.com/done",
	}

	// Act
	env, err := sender.SealStruct(req)
	require.NoError(t, err)
	openedMap, err := receiver.Open(env)
	require.NoError(t, err)

	// Seal again with a fresh request_id to verify OpenInto independently of ReplayCache.
	envForStruct, err := sender.SealStruct(req)
	require.NoError(t, err)
	var decoded CheckoutSessionRequest
	errInto := receiver.OpenInto(envForStruct, &decoded)

	// Assert
	require.NoError(t, errInto)
	require.Equal(t, DefaultAppID, openedMap["app_id"])
	require.NotEmpty(t, openedMap["request_id"])
	require.NotZero(t, openedMap["timestamp"])
	require.Equal(t, req, decoded)
}

func TestChannel_Open_RejectsAppIDMismatch(t *testing.T) {
	// Arrange
	sender := newTestChannel(t, "other-app")
	receiver := newTestChannel(t, DefaultAppID)
	env, err := sender.Seal(map[string]any{"action": WebhookActionActivate})
	require.NoError(t, err)

	// Act: outer app_id mismatch
	_, outerErr := receiver.Open(env)

	// Act: inner app_id mismatch with matching outer app_id
	env.AppID = DefaultAppID
	_, innerErr := receiver.Open(env)

	// Assert
	require.Error(t, outerErr)
	require.Contains(t, outerErr.Error(), "app_id mismatch")
	require.Error(t, innerErr)
	require.Contains(t, innerErr.Error(), "inner app_id mismatch")
}

func TestChannel_Open_RejectsVersionMismatch(t *testing.T) {
	// Arrange
	ch := newTestChannel(t, DefaultAppID)
	env, err := ch.Seal(map[string]any{"action": WebhookActionActivate})
	require.NoError(t, err)
	env.Version = EnvelopeVersion + 1

	// Act
	_, err = ch.Open(env)

	// Assert
	require.Error(t, err)
	require.Contains(t, err.Error(), "unsupported envelope version")
}

func TestChannel_Open_RejectsTamperedCiphertextAndNonce(t *testing.T) {
	// Arrange
	ch := newTestChannel(t, DefaultAppID)
	baseEnv, err := ch.Seal(map[string]any{"action": WebhookActionActivate})
	require.NoError(t, err)

	cipherBytes, err := base64.StdEncoding.DecodeString(baseEnv.Payload)
	require.NoError(t, err)
	cipherBytes[0] ^= 0xff
	tamperedCipherEnv := baseEnv
	tamperedCipherEnv.Payload = base64.StdEncoding.EncodeToString(cipherBytes)

	nonceBytes, err := base64.StdEncoding.DecodeString(baseEnv.Nonce)
	require.NoError(t, err)
	nonceBytes[0] ^= 0xff
	tamperedNonceEnv := baseEnv
	tamperedNonceEnv.Nonce = base64.StdEncoding.EncodeToString(nonceBytes)

	// Act & Assert
	_, errCipher := ch.Open(tamperedCipherEnv)
	require.Error(t, errCipher)

	_, errNonce := ch.Open(tamperedNonceEnv)
	require.Error(t, errNonce)
}

func TestChannel_Open_RejectsTimestampDriftBeyond300Seconds(t *testing.T) {
	// Arrange
	ch := newTestChannel(t, DefaultAppID)
	now := time.Now().Unix()
	cases := []struct {
		name      string
		timestamp int64
		wantErr   bool
	}{
		{name: "past > 300s rejected", timestamp: now - 301, wantErr: true},
		{name: "future > 300s rejected", timestamp: now + 301, wantErr: true},
		{name: "within 300s accepted", timestamp: now - 250, wantErr: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			env, err := ch.Seal(map[string]any{"timestamp": tc.timestamp})
			require.NoError(t, err)

			// Act
			_, openErr := ch.Open(env)

			// Assert
			if tc.wantErr {
				require.Error(t, openErr)
				require.Contains(t, openErr.Error(), "drift")
			} else {
				require.NoError(t, openErr)
			}
		})
	}
}

func TestChannel_Open_RejectsReplayedRequestID(t *testing.T) {
	// Arrange
	ch := newTestChannel(t, DefaultAppID)
	env, err := ch.Seal(map[string]any{"request_id": "req-unique-123"})
	require.NoError(t, err)

	// Act
	_, firstErr := ch.Open(env)
	_, replayOpenErr := ch.Open(env)
	var target map[string]any
	replayIntoErr := ch.OpenInto(env, &target)

	// Assert
	require.NoError(t, firstErr)
	require.Error(t, replayOpenErr)
	require.Contains(t, replayOpenErr.Error(), "replayed request_id")
	require.Error(t, replayIntoErr)
	require.Contains(t, replayIntoErr.Error(), "replayed request_id")
}

func TestChannel_WireFormat_CompatibleWithPHPLibsodiumSecretbox(t *testing.T) {
	// Arrange: seal from Go and inspect exact wire JSON + raw secretbox decryption
	ch := newTestChannel(t, DefaultAppID)
	env, err := ch.Seal(map[string]any{"action": WebhookActionActivate, "order_id": 55})
	require.NoError(t, err)

	wireBytes, err := json.Marshal(env)
	require.NoError(t, err)
	var rawWire map[string]any
	require.NoError(t, json.Unmarshal(wireBytes, &rawWire))

	// Assert Go -> PHP wire keys and 24-byte secretbox format
	require.Equal(t, []string{"app_id", "nonce", "payload", "v"}, sortedMapKeys(rawWire))
	nonceBytes, err := base64.StdEncoding.DecodeString(rawWire["nonce"].(string))
	require.NoError(t, err)
	require.Len(t, nonceBytes, 24)
	cipherBytes, err := base64.StdEncoding.DecodeString(rawWire["payload"].(string))
	require.NoError(t, err)

	var keyArr [32]byte
	var nonceArr [24]byte
	copy(keyArr[:], ch.SecretKey)
	copy(nonceArr[:], nonceBytes)
	plaintext, ok := secretbox.Open(nil, cipherBytes, &nonceArr, &keyArr)
	require.True(t, ok)

	var inner map[string]any
	require.NoError(t, json.Unmarshal(plaintext, &inner))
	require.Equal(t, DefaultAppID, inner["app_id"])
	require.NotEmpty(t, inner["request_id"])
	require.NotZero(t, inner["timestamp"])

	// Act: PHP -> Go simulated sodium_crypto_secretbox envelope
	var phpNonce [24]byte
	_, err = rand.Read(phpNonce[:])
	require.NoError(t, err)
	phpPlain, err := json.Marshal(map[string]any{
		"app_id":     DefaultAppID,
		"timestamp":  time.Now().Unix(),
		"request_id": "php-req-001",
		"order_id":   900,
	})
	require.NoError(t, err)
	phpCipher := secretbox.Seal(nil, phpPlain, &phpNonce, &keyArr)
	phpEnvelope := Envelope{
		Version: EnvelopeVersion,
		AppID:   DefaultAppID,
		Nonce:   base64.StdEncoding.EncodeToString(phpNonce[:]),
		Payload: base64.StdEncoding.EncodeToString(phpCipher),
	}

	opened, err := ch.Open(phpEnvelope)

	// Assert
	require.NoError(t, err)
	require.Equal(t, float64(900), opened["order_id"])
	require.Equal(t, "php-req-001", opened["request_id"])
}

func sortedMapKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	for i := 0; i < len(keys); i++ {
		for j := i + 1; j < len(keys); j++ {
			if keys[j] < keys[i] {
				keys[i], keys[j] = keys[j], keys[i]
			}
		}
	}
	return keys
}
