package api

import (
	"bytes"
	"crypto/sha512"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/ente/escrow/internal/envelope"
)

func TestCreateRecoveryRequest_ReturnsIdenticalResponse_RegardlessOfEmail(t *testing.T) {
	ts, memStore, _, _ := setupTestEscrowServer(t)
	fixedNow := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	memStore.SetClock(func() time.Time { return fixedNow })

	_, devPub, _ := envelope.GenerateKeyPair()
	secretHash := sha512.Sum512([]byte("poll-secret-1"))

	createReq := func(email string) map[string]any {
		body, _ := json.Marshal(map[string]any{
			"device_public_key": devPub,
			"poll_secret_hash":  secretHash[:],
			"claimed_email":     email,
		})
		resp, err := http.Post(ts.URL+"/escrow/v1/recovery-requests", "application/json", bytes.NewReader(body))
		if err != nil {
			t.Fatalf("post recovery request: %v", err)
		}
		defer func() { _ = resp.Body.Close() }()
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("status = %d, want 200", resp.StatusCode)
		}
		var out map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&out)
		return out
	}

	resRegistered := createReq("user1001@levitation.web.id")
	resUnknown := createReq("nonexistent@example.com")
	if len(resRegistered) != 2 || len(resUnknown) != 2 {
		t.Fatalf("expected exactly 2 keys (request_id, expires_at), got %v and %v", resRegistered, resUnknown)
	}
	if fmt.Sprint(resRegistered["expires_at"]) != fmt.Sprint(resUnknown["expires_at"]) {
		t.Fatalf("expires_at differed between registered and unregistered email")
	}
}

func TestPollRecoveryRequest_BlocksUntilCooldownExpiresAndSecretMatches(t *testing.T) {
	ts, memStore, _, custodyPub := setupTestEscrowServer(t)
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	memStore.SetClock(func() time.Time { return now })

	_ = putDepositHelper(t, ts.URL, "valid-user-1001", custodyPub).Body.Close()

	devSeed, devPub, _ := envelope.GenerateKeyPair()
	pollSecret := "my-secret-poll-token-256bit"
	pollHash := sha512.Sum512([]byte(pollSecret))
	createBody, _ := json.Marshal(map[string]any{
		"device_public_key": devPub,
		"poll_secret_hash":  pollHash[:],
	})
	createResp, _ := http.Post(ts.URL+"/escrow/v1/recovery-requests", "application/json", bytes.NewReader(createBody))
	var created struct {
		RequestID string `json:"request_id"`
	}
	_ = json.NewDecoder(createResp.Body).Decode(&created)
	_ = createResp.Body.Close()

	deviceBlob, _ := envelope.SealDevice(devPub, created.RequestID, bytes.Repeat([]byte{0x44}, 32))
	approveBody, _ := json.Marshal(map[string]any{
		"linked_user_id": 1001,
		"support_ref":    "SUP-101",
		"device_blob":    deviceBlob,
		"cooldown_hours": 24,
	})
	appReq, _ := http.NewRequest(http.MethodPost, ts.URL+"/escrow/v1/admin/recovery-requests/"+created.RequestID+"/approve", bytes.NewReader(approveBody))
	appReq.Header.Set("X-Auth-Token", "valid-admin-token")
	appResp, _ := http.DefaultClient.Do(appReq)
	_ = appResp.Body.Close()

	poll := func(secret string) *http.Response {
		r, _ := http.NewRequest(http.MethodGet, ts.URL+"/escrow/v1/recovery-requests/"+created.RequestID, nil)
		r.Header.Set("X-Poll-Secret", secret)
		res, _ := http.DefaultClient.Do(r)
		return res
	}

	wrongResp := poll("wrong-secret")
	_ = wrongResp.Body.Close()
	if wrongResp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for wrong poll secret, got %d", wrongResp.StatusCode)
	}

	earlyResp := poll(pollSecret)
	_ = earlyResp.Body.Close()
	if earlyResp.StatusCode != http.StatusTooEarly {
		t.Fatalf("expected 425 Too Early before cooldown expires, got %d", earlyResp.StatusCode)
	}

	memStore.SetClock(func() time.Time { return now.Add(24*time.Hour + time.Minute) })
	readyResp := poll(pollSecret)
	defer func() { _ = readyResp.Body.Close() }()
	if readyResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 after cooldown expires, got %d", readyResp.StatusCode)
	}
	var pollData struct {
		DeviceBlob string `json:"device_blob"`
	}
	_ = json.NewDecoder(readyResp.Body).Decode(&pollData)
	rawBlob, _ := base64.StdEncoding.DecodeString(pollData.DeviceBlob)
	opened, err := envelope.OpenDevice(devSeed, created.RequestID, rawBlob)
	if err != nil || !bytes.Equal(opened, bytes.Repeat([]byte{0x44}, 32)) {
		t.Fatalf("OpenDevice failed or mismatched recoveryKey: %v", err)
	}
}

func TestPollRecoveryRequest_MarksConsumedAfterFirstDownload(t *testing.T) {
	ts, memStore, _, custodyPub := setupTestEscrowServer(t)
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	memStore.SetClock(func() time.Time { return now })

	_ = putDepositHelper(t, ts.URL, "valid-user-1001", custodyPub).Body.Close()
	_, devPub, _ := envelope.GenerateKeyPair()
	pollSecret := "one-time-poll-secret"
	pollHash := sha512.Sum512([]byte(pollSecret))
	createBody, _ := json.Marshal(map[string]any{
		"device_public_key": devPub,
		"poll_secret_hash":  pollHash[:],
	})
	createResp, _ := http.Post(ts.URL+"/escrow/v1/recovery-requests", "application/json", bytes.NewReader(createBody))
	var created struct {
		RequestID string `json:"request_id"`
	}
	_ = json.NewDecoder(createResp.Body).Decode(&created)
	_ = createResp.Body.Close()

	deviceBlob, _ := envelope.SealDevice(devPub, created.RequestID, bytes.Repeat([]byte{0x55}, 32))
	approveBody, _ := json.Marshal(map[string]any{
		"linked_user_id": 1001,
		"support_ref":    "SUP-102",
		"device_blob":    deviceBlob,
		"cooldown_hours": 0,
	})
	appReq, _ := http.NewRequest(http.MethodPost, ts.URL+"/escrow/v1/admin/recovery-requests/"+created.RequestID+"/approve", bytes.NewReader(approveBody))
	appReq.Header.Set("X-Auth-Token", "valid-admin-token")
	appResp, _ := http.DefaultClient.Do(appReq)
	_ = appResp.Body.Close()

	req1, _ := http.NewRequest(http.MethodGet, ts.URL+"/escrow/v1/recovery-requests/"+created.RequestID, nil)
	req1.Header.Set("X-Poll-Secret", pollSecret)
	resp1, _ := http.DefaultClient.Do(req1)
	_ = resp1.Body.Close()
	if resp1.StatusCode != http.StatusOK {
		t.Fatalf("first download status = %d, want 200", resp1.StatusCode)
	}

	req2, _ := http.NewRequest(http.MethodGet, ts.URL+"/escrow/v1/recovery-requests/"+created.RequestID, nil)
	req2.Header.Set("X-Poll-Secret", pollSecret)
	resp2, _ := http.DefaultClient.Do(req2)
	_ = resp2.Body.Close()
	if resp2.StatusCode != http.StatusGone {
		t.Fatalf("second download status = %d, want 410 Gone", resp2.StatusCode)
	}
}
