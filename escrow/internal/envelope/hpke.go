package envelope

import (
	"crypto/hpke"
	"crypto/rand"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/base32"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
)

const (
	CipherSuiteID        = "biyen-escrow-v1:hpke-xwing-hkdfsha256-chacha20poly1305"
	PublicKeyBytes       = 1216
	SecretKeySeedBytes   = 32
	EncappedKeyBytes     = 1120
	HPKEOverheadBytes    = 1136
	CommitmentBytes      = 64
	RequestCodeRawChars  = 20
	RequestCodeGroupSize = 5

	CustodyInfoPrefix   = "biyen-escrow-v1/custody|"
	DeviceInfoPrefix    = "biyen-escrow-v1/device|"
	CommitDomainPrefix  = "biyen-escrow-v1/commit|"
	RequestDomainPrefix = "biyen-escrow-v1/request|"
)

var (
	ErrInvalidPublicKeyLength = errors.New("envelope: invalid X-Wing public key length")
	ErrCiphertextTooShort     = errors.New("envelope: ciphertext shorter than HPKE overhead")
	ErrInvalidContext         = errors.New("envelope: missing context parameters")
)

type CustodyContext struct {
	UserID     int64
	KEKVersion string
}

func GenerateKeyPair() ([SecretKeySeedBytes]byte, []byte, error) {
	var seed [SecretKeySeedBytes]byte
	if _, err := rand.Read(seed[:]); err != nil {
		return seed, nil, fmt.Errorf("read random seed: %w", err)
	}
	pubBytes, err := DerivePublicKey(seed)
	if err != nil {
		return [SecretKeySeedBytes]byte{}, nil, err
	}
	return seed, pubBytes, nil
}

func DerivePublicKey(seed [SecretKeySeedBytes]byte) ([]byte, error) {
	priv, err := hpke.MLKEM768X25519().NewPrivateKey(seed[:])
	if err != nil {
		return nil, fmt.Errorf("derive X-Wing private key: %w", err)
	}
	return priv.PublicKey().Bytes(), nil
}

func CustodyInfo(ctx CustodyContext) []byte {
	return fmt.Appendf(nil, "%s%d|%s", CustodyInfoPrefix, ctx.UserID, ctx.KEKVersion)
}

func DeviceInfo(requestID string) []byte {
	return fmt.Appendf(nil, "%s%s", DeviceInfoPrefix, requestID)
}

func SealCustody(pubKeyBytes []byte, ctx CustodyContext, recoveryKey []byte) ([]byte, error) {
	if ctx.UserID <= 0 || strings.TrimSpace(ctx.KEKVersion) == "" {
		return nil, ErrInvalidContext
	}
	return sealWithInfo(pubKeyBytes, CustodyInfo(ctx), recoveryKey)
}

func OpenCustody(seed [SecretKeySeedBytes]byte, ctx CustodyContext, custodyBlob []byte) ([]byte, error) {
	if ctx.UserID <= 0 || strings.TrimSpace(ctx.KEKVersion) == "" {
		return nil, ErrInvalidContext
	}
	return openWithInfo(seed, CustodyInfo(ctx), custodyBlob)
}

func SealDevice(devicePubKeyBytes []byte, requestID string, recoveryKey []byte) ([]byte, error) {
	if strings.TrimSpace(requestID) == "" {
		return nil, ErrInvalidContext
	}
	return sealWithInfo(devicePubKeyBytes, DeviceInfo(requestID), recoveryKey)
}

func OpenDevice(deviceSeed [SecretKeySeedBytes]byte, requestID string, deviceBlob []byte) ([]byte, error) {
	if strings.TrimSpace(requestID) == "" {
		return nil, ErrInvalidContext
	}
	return openWithInfo(deviceSeed, DeviceInfo(requestID), deviceBlob)
}

func ComputeCommitment(userID int64, recoveryKey []byte) [CommitmentBytes]byte {
	hasher := sha512.New()
	prefix := fmt.Appendf(nil, "%s%d|", CommitDomainPrefix, userID)
	_, _ = hasher.Write(prefix)
	_, _ = hasher.Write(recoveryKey)
	var out [CommitmentBytes]byte
	copy(out[:], hasher.Sum(nil))
	return out
}

func VerifyCommitment(userID int64, recoveryKey []byte, expected [CommitmentBytes]byte) bool {
	actual := ComputeCommitment(userID, recoveryKey)
	return subtle.ConstantTimeCompare(actual[:], expected[:]) == 1
}

func PublicKeyFingerprint(pubKey []byte) string {
	digest := sha512.Sum512(pubKey)
	return hex.EncodeToString(digest[:])
}

func ComputeRequestCode(requestID string, devicePubKey []byte) string {
	hasher := sha512.New()
	prefix := fmt.Appendf(nil, "%s%s|", RequestDomainPrefix, requestID)
	_, _ = hasher.Write(prefix)
	_, _ = hasher.Write(devicePubKey)
	digest := hasher.Sum(nil)

	encoded := base32.StdEncoding.EncodeToString(digest)[:RequestCodeRawChars]
	return fmt.Sprintf(
		"%s-%s-%s-%s",
		encoded[0:RequestCodeGroupSize],
		encoded[RequestCodeGroupSize:RequestCodeGroupSize*2],
		encoded[RequestCodeGroupSize*2:RequestCodeGroupSize*3],
		encoded[RequestCodeGroupSize*3:RequestCodeRawChars],
	)
}

func Zeroize(buf []byte) {
	for i := range buf {
		buf[i] = 0
	}
}

func sealWithInfo(pubKeyBytes []byte, info []byte, plaintext []byte) ([]byte, error) {
	if len(pubKeyBytes) != PublicKeyBytes {
		return nil, ErrInvalidPublicKeyLength
	}
	pub, err := hpke.MLKEM768X25519().NewPublicKey(pubKeyBytes)
	if err != nil {
		return nil, fmt.Errorf("parse X-Wing public key: %w", err)
	}
	sealed, err := hpke.Seal(pub, hpke.HKDFSHA256(), hpke.ChaCha20Poly1305(), info, plaintext)
	if err != nil {
		return nil, fmt.Errorf("hpke seal: %w", err)
	}
	return sealed, nil
}

func openWithInfo(seed [SecretKeySeedBytes]byte, info []byte, ciphertext []byte) ([]byte, error) {
	if len(ciphertext) < HPKEOverheadBytes {
		return nil, ErrCiphertextTooShort
	}
	priv, err := hpke.MLKEM768X25519().NewPrivateKey(seed[:])
	if err != nil {
		return nil, fmt.Errorf("parse X-Wing private key: %w", err)
	}
	opened, err := hpke.Open(priv, hpke.HKDFSHA256(), hpke.ChaCha20Poly1305(), info, ciphertext)
	if err != nil {
		return nil, fmt.Errorf("hpke open: %w", err)
	}
	return opened, nil
}
