package api

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"
)

const (
	defaultRateLimitWindow   = time.Minute
	defaultRateLimitMaxReqs  = 30
	uuidByteLength           = 16
	uuidVersion4Mask         = 0x40
	uuidVersionClearMask     = 0x0f
	uuidVariantRFC4122Mask   = 0x80
	uuidVariantClearMask     = 0x3f
)

var ErrInvalidByteEncoding = errors.New("api: invalid base64 or hex byte encoding")

type FlexBytes []byte

func (f *FlexBytes) UnmarshalJSON(data []byte) error {
	var raw string
	if err := json.Unmarshal(data, &raw); err != nil {
		var byteArr []byte
		if arrErr := json.Unmarshal(data, &byteArr); arrErr == nil {
			*f = byteArr
			return nil
		}
		return err
	}
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		*f = nil
		return nil
	}
	if isLikelyHex(trimmed) {
		if decoded, err := hex.DecodeString(trimmed); err == nil {
			*f = decoded
			return nil
		}
	}
	for _, enc := range []*base64.Encoding{
		base64.StdEncoding,
		base64.RawStdEncoding,
		base64.URLEncoding,
		base64.RawURLEncoding,
	} {
		if decoded, err := enc.DecodeString(trimmed); err == nil {
			*f = decoded
			return nil
		}
	}
	if decoded, err := hex.DecodeString(trimmed); err == nil {
		*f = decoded
		return nil
	}
	return ErrInvalidByteEncoding
}

func isLikelyHex(s string) bool {
	if len(s)%2 != 0 {
		return false
	}
	for i := range len(s) {
		c := s[i]
		isDigit := c >= '0' && c <= '9'
		isLowerHex := c >= 'a' && c <= 'f'
		isUpperHex := c >= 'A' && c <= 'F'
		if !isDigit && !isLowerHex && !isUpperHex {
			return false
		}
	}
	return len(s) == 128 || len(s) == 2432 || len(s) >= 2272
}

func generateUUIDv4() (string, error) {
	var b [uuidByteLength]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	b[6] = (b[6] & uuidVersionClearMask) | uuidVersion4Mask
	b[8] = (b[8] & uuidVariantClearMask) | uuidVariantRFC4122Mask
	return fmt.Sprintf(
		"%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16],
	), nil
}

type RateLimiter struct {
	mu      sync.Mutex
	window  time.Duration
	maxReqs int
	hits    map[string][]time.Time
}

func NewRateLimiter(window time.Duration, maxReqs int) *RateLimiter {
	if window <= 0 {
		window = defaultRateLimitWindow
	}
	if maxReqs <= 0 {
		maxReqs = defaultRateLimitMaxReqs
	}
	return &RateLimiter{
		window:  window,
		maxReqs: maxReqs,
		hits:    make(map[string][]time.Time),
	}
}

func (rl *RateLimiter) Allow(remoteAddr string) bool {
	host, _, err := net.SplitHostPort(strings.TrimSpace(remoteAddr))
	if err != nil || host == "" {
		host = strings.TrimSpace(remoteAddr)
	}
	now := time.Now().UTC()
	cutoff := now.Add(-rl.window)

	rl.mu.Lock()
	defer rl.mu.Unlock()

	recent := rl.hits[host][:0]
	for _, ts := range rl.hits[host] {
		if ts.After(cutoff) {
			recent = append(recent, ts)
		}
	}
	if len(recent) >= rl.maxReqs {
		rl.hits[host] = recent
		return false
	}
	rl.hits[host] = append(recent, now)
	return true
}
