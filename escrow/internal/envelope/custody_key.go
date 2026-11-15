package envelope

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/chacha20poly1305"
)

const (
	CustodyKeyFileFormatVersion = 1
	CustodyKeyKDFName           = "argon2id-chacha20poly1305"
	Argon2TimeCost              = 3
	Argon2MemoryKiB             = 128 * 1024
	Argon2Threads               = 4
	Argon2KeyBytes              = 32
	Argon2SaltBytes             = 16

	ShamirTotalShares = 3
	ShamirThreshold   = 2
	gf256Poly         = 0x11b
	gf256HighBit      = 0x80
	gf256ByteMask     = 0xff
)

var (
	ErrEmptyPassphrase      = errors.New("envelope: passphrase must not be empty")
	ErrUnsupportedKeyFormat = errors.New("envelope: unsupported custody key format or low memory parameters")
	ErrInvalidCustodySeed   = errors.New("envelope: decrypted custody seed length invalid")
	ErrInvalidShamirShares  = errors.New("envelope: requires 2 distinct valid Shamir shares (indices 1..3)")
)

type EncryptedCustodyKeyFile struct {
	FormatVersion        int    `json:"format_version"`
	KEKVersion           string `json:"kek_version"`
	KDF                  string `json:"kdf"`
	MemoryKiB            uint32 `json:"memory_kib"`
	TimeCost             uint32 `json:"time_cost"`
	Threads              uint8  `json:"threads"`
	SaltHex              string `json:"salt_hex"`
	NonceHex             string `json:"nonce_hex"`
	CiphertextHex        string `json:"ciphertext_hex"`
	PublicKeyFingerprint string `json:"public_key_fingerprint"`
}

type ShamirShare struct {
	Index uint8
	Value [SecretKeySeedBytes]byte
}

func EncryptCustodySeed(seed [SecretKeySeedBytes]byte, passphrase []byte, kekVersion string) ([]byte, error) {
	if len(passphrase) == 0 {
		return nil, ErrEmptyPassphrase
	}
	pubBytes, err := DerivePublicKey(seed)
	if err != nil {
		return nil, err
	}

	salt := make([]byte, Argon2SaltBytes)
	if _, err := rand.Read(salt); err != nil {
		return nil, fmt.Errorf("read salt: %w", err)
	}
	derivedKey := argon2.IDKey(passphrase, salt, Argon2TimeCost, Argon2MemoryKiB, Argon2Threads, Argon2KeyBytes)
	defer Zeroize(derivedKey)

	aead, err := chacha20poly1305.New(derivedKey)
	if err != nil {
		return nil, fmt.Errorf("init chacha20poly1305: %w", err)
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("read nonce: %w", err)
	}

	aad := []byte(kekVersion)
	ciphertext := aead.Seal(nil, nonce, seed[:], aad)
	fileData := EncryptedCustodyKeyFile{
		FormatVersion:        CustodyKeyFileFormatVersion,
		KEKVersion:           kekVersion,
		KDF:                  CustodyKeyKDFName,
		MemoryKiB:            Argon2MemoryKiB,
		TimeCost:             Argon2TimeCost,
		Threads:              Argon2Threads,
		SaltHex:              hex.EncodeToString(salt),
		NonceHex:             hex.EncodeToString(nonce),
		CiphertextHex:        hex.EncodeToString(ciphertext),
		PublicKeyFingerprint: PublicKeyFingerprint(pubBytes),
	}
	return json.MarshalIndent(fileData, "", "  ")
}

func DecryptCustodySeed(encryptedJSON []byte, passphrase []byte) ([SecretKeySeedBytes]byte, string, error) {
	var zero [SecretKeySeedBytes]byte
	if len(passphrase) == 0 {
		return zero, "", ErrEmptyPassphrase
	}
	var fileData EncryptedCustodyKeyFile
	if err := json.Unmarshal(encryptedJSON, &fileData); err != nil {
		return zero, "", fmt.Errorf("parse custody key file: %w", err)
	}
	if fileData.FormatVersion != CustodyKeyFileFormatVersion || fileData.MemoryKiB < Argon2MemoryKiB {
		return zero, "", ErrUnsupportedKeyFormat
	}

	salt, err := hex.DecodeString(fileData.SaltHex)
	if err != nil {
		return zero, "", fmt.Errorf("decode salt: %w", err)
	}
	nonce, err := hex.DecodeString(fileData.NonceHex)
	if err != nil {
		return zero, "", fmt.Errorf("decode nonce: %w", err)
	}
	ciphertext, err := hex.DecodeString(fileData.CiphertextHex)
	if err != nil {
		return zero, "", fmt.Errorf("decode ciphertext: %w", err)
	}

	derivedKey := argon2.IDKey(passphrase, salt, fileData.TimeCost, fileData.MemoryKiB, fileData.Threads, Argon2KeyBytes)
	defer Zeroize(derivedKey)

	aead, err := chacha20poly1305.New(derivedKey)
	if err != nil {
		return zero, "", fmt.Errorf("init chacha20poly1305: %w", err)
	}
	if len(nonce) != aead.NonceSize() {
		return zero, "", ErrUnsupportedKeyFormat
	}
	opened, err := aead.Open(nil, nonce, ciphertext, []byte(fileData.KEKVersion))
	if err != nil {
		return zero, "", fmt.Errorf("decrypt custody seed: %w", err)
	}
	defer Zeroize(opened)
	if len(opened) != SecretKeySeedBytes {
		return zero, "", ErrInvalidCustodySeed
	}
	var seed [SecretKeySeedBytes]byte
	copy(seed[:], opened)
	return seed, fileData.KEKVersion, nil
}

func SplitSeed2Of3(seed [SecretKeySeedBytes]byte) ([ShamirTotalShares]ShamirShare, error) {
	var shares [ShamirTotalShares]ShamirShare
	var slopes [SecretKeySeedBytes]byte
	if _, err := rand.Read(slopes[:]); err != nil {
		return shares, fmt.Errorf("read shamir slopes: %w", err)
	}
	defer Zeroize(slopes[:])

	for sIdx := range ShamirTotalShares {
		x := uint8(sIdx + 1)
		shares[sIdx].Index = x
		for bIdx := range SecretKeySeedBytes {
			slope := slopes[bIdx]
			if slope == 0 {
				slope = 1
			}
			shares[sIdx].Value[bIdx] = seed[bIdx] ^ gf256Mul(slope, x)
		}
	}
	return shares, nil
}

func CombineSeed2Of3(shareA ShamirShare, shareB ShamirShare) ([SecretKeySeedBytes]byte, error) {
	var seed [SecretKeySeedBytes]byte
	if !isValidShareIndex(shareA.Index) || !isValidShareIndex(shareB.Index) || shareA.Index == shareB.Index {
		return seed, ErrInvalidShamirShares
	}
	dx := shareA.Index ^ shareB.Index
	for bIdx := range SecretKeySeedBytes {
		dy := shareA.Value[bIdx] ^ shareB.Value[bIdx]
		slope := gf256Div(dy, dx)
		seed[bIdx] = shareA.Value[bIdx] ^ gf256Mul(slope, shareA.Index)
	}
	return seed, nil
}

func FormatShare(share ShamirShare) string {
	return fmt.Sprintf("shamir2of3:%d:%s", share.Index, hex.EncodeToString(share.Value[:]))
}

func ParseShare(encoded string) (ShamirShare, error) {
	parts := strings.Split(strings.TrimSpace(encoded), ":")
	if len(parts) != 3 || parts[0] != "shamir2of3" {
		return ShamirShare{}, ErrInvalidShamirShares
	}
	idx, err := strconv.ParseUint(parts[1], 10, 8)
	if err != nil || !isValidShareIndex(uint8(idx)) {
		return ShamirShare{}, ErrInvalidShamirShares
	}
	raw, err := hex.DecodeString(parts[2])
	if err != nil || len(raw) != SecretKeySeedBytes {
		return ShamirShare{}, ErrInvalidShamirShares
	}
	var share ShamirShare
	share.Index = uint8(idx)
	copy(share.Value[:], raw)
	return share, nil
}

func isValidShareIndex(index uint8) bool {
	return index >= 1 && index <= ShamirTotalShares
}

func gf256Mul(a uint8, b uint8) uint8 {
	var p uint8
	for range 8 {
		if (b & 1) != 0 {
			p ^= a
		}
		highBitSet := (a & gf256HighBit) != 0
		a <<= 1
		if highBitSet {
			a ^= uint8(gf256Poly & gf256ByteMask)
		}
		b >>= 1
	}
	return p
}

func gf256Inv(a uint8) uint8 {
	if a == 0 {
		return 0
	}
	result := uint8(1)
	base := a
	exp := uint8(254)
	for exp > 0 {
		if (exp & 1) != 0 {
			result = gf256Mul(result, base)
		}
		base = gf256Mul(base, base)
		exp >>= 1
	}
	return result
}

func gf256Div(a uint8, b uint8) uint8 {
	return gf256Mul(a, gf256Inv(b))
}
