package main

import (
	"bytes"
	"crypto/sha512"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/ente/escrow/internal/api"
	"github.com/ente/escrow/internal/envelope"
	"github.com/ente/escrow/internal/museum"
	"github.com/ente/escrow/internal/store"
)

func setupAdminTestEnv(t *testing.T, custodyPub []byte) (*httptest.Server, *store.MemoryStore) {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /users/details/v2", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Auth-Token") == "user-token-1001" {
			_ = json.NewEncoder(w).Encode(map[string]any{"details": map[string]any{"id": 1001, "email": "u1001@levitation.web.id"}})
			return
		}
		w.WriteHeader(http.StatusUnauthorized)
	})
	mux.HandleFunc("GET /admin/users", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Auth-Token") == "admin-sudo-token" {
			_ = json.NewEncoder(w).Encode(map[string]any{"users": []any{}})
			return
		}
		w.WriteHeader(http.StatusUnauthorized)
	})
	mux.HandleFunc("GET /admin/user", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"user": map[string]any{"id": 1001, "email": "u1001@levitation.web.id"}})
	})
	mux.HandleFunc("POST /admin/mail", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	museumSrv := httptest.NewServer(mux)
	t.Cleanup(museumSrv.Close)

	memStore := store.NewMemoryStore()
	escrowSrv := httptest.NewServer(api.NewServer(api.ServerConfig{
		Store:            memStore,
		Museum:           museum.NewHTTPClient(museumSrv.URL),
		CustodyPublicKey: custodyPub,
		KEKVersion:       "v1",
	}))
	t.Cleanup(escrowSrv.Close)
	return escrowSrv, memStore
}

func TestAdminApprove_Aborts_WhenServerSwapsDevicePublicKey(t *testing.T) {
	tmpDir := t.TempDir()
	var out bytes.Buffer
	err := runCLI([]string{
		"keygen",
		"--version", "v1",
		"--out-dir", tmpDir,
		"--passphrase", "admin-pass-12345",
	}, &out)
	if err != nil {
		t.Fatalf("keygen failed: %v", err)
	}

	custodyPub, err := os.ReadFile(filepath.Join(tmpDir, "custody-v1.pub"))
	if err != nil {
		t.Fatalf("read custody-v1.pub: %v", err)
	}
	escrowSrv, memStore := setupAdminTestEnv(t, custodyPub)

	recoveryKey := bytes.Repeat([]byte{0x77}, 32)
	custodyBlob, _ := envelope.SealCustody(custodyPub, envelope.CustodyContext{UserID: 1001, KEKVersion: "v1"}, recoveryKey)
	commit := envelope.ComputeCommitment(1001, recoveryKey)
	_, _ = memStore.SaveDeposit(t.Context(), store.SaveDepositParams{
		UserID:                1001,
		KEKVersion:            "v1",
		CipherSuite:           envelope.CipherSuiteID,
		CustodyBlob:           custodyBlob,
		RecoveryKeyCommitment: commit,
	})

	_, legitimateDevicePub, _ := envelope.GenerateKeyPair()
	pollHash := sha512.Sum512([]byte("poll-secret"))
	reqID := "550e8400-e29b-41d4-a716-446655440099"
	legitimateCode := envelope.ComputeRequestCode(reqID, legitimateDevicePub)
	_, err = memStore.CreateRecoveryRequest(t.Context(), store.CreateRecoveryRequestParams{
		RequestID:       reqID,
		DevicePublicKey: legitimateDevicePub,
		RequestCode:     legitimateCode,
		PollSecretHash:  pollHash,
		ClaimedEmail:    "u1001@levitation.web.id",
	})
	if err != nil {
		t.Fatalf("CreateRecoveryRequest: %v", err)
	}

	_, attackerDevicePub, _ := envelope.GenerateKeyPair()
	if err := memStore.ReplaceDevicePublicKey(reqID, attackerDevicePub); err != nil {
		t.Fatalf("ReplaceDevicePublicKey: %v", err)
	}

	approveErr := runCLI([]string{
		"approve",
		"--code", legitimateCode,
		"--user-id", "1001",
		"--support-ref", "SUP-MITM-TEST",
		"--key-file", filepath.Join(tmpDir, "custody-v1.key"),
		"--passphrase", "admin-pass-12345",
		"--cooldown-hours", "0",
		"--server", escrowSrv.URL,
		"--admin-token", "admin-sudo-token",
	}, &out)
	if !errors.Is(approveErr, ErrDevicePublicKeySwapped) {
		t.Fatalf("expected ErrDevicePublicKeySwapped when server swaps device_public_key, got: %v", approveErr)
	}

	storedReq, _ := memStore.GetRecoveryRequestByID(t.Context(), reqID)
	if storedReq.Status != store.StatusPending || len(storedReq.DeviceBlob) != 0 {
		t.Fatalf("request must remain pending without device_blob after abort, got status=%s", storedReq.Status)
	}
}

func TestAdminKeygenApproveAndAuditVerify_FullFlow(t *testing.T) {
	tmpDir := t.TempDir()
	var out bytes.Buffer
	if err := runCLI([]string{
		"keygen",
		"--version", "v1",
		"--out-dir", tmpDir,
		"--passphrase", "vault-pass-999",
	}, &out); err != nil {
		t.Fatalf("keygen failed: %v", err)
	}

	custodyPub, _ := os.ReadFile(filepath.Join(tmpDir, "custody-v1.pub"))
	escrowSrv, _ := setupAdminTestEnv(t, custodyPub)

	originalRecoveryKey := bytes.Repeat([]byte{0x9a}, 32)
	custodyBlob, _ := envelope.SealCustody(custodyPub, envelope.CustodyContext{UserID: 1001, KEKVersion: "v1"}, originalRecoveryKey)
	commit := envelope.ComputeCommitment(1001, originalRecoveryKey)
	depBody, _ := json.Marshal(map[string]any{
		"kek_version":             "v1",
		"cipher_suite":            envelope.CipherSuiteID,
		"custody_blob":            custodyBlob,
		"recovery_key_commitment": commit[:],
	})
	depReq, _ := http.NewRequest(http.MethodPut, escrowSrv.URL+"/escrow/v1/deposit", bytes.NewReader(depBody))
	depReq.Header.Set("X-Auth-Token", "user-token-1001")
	depResp, err := http.DefaultClient.Do(depReq)
	if err != nil || depResp.StatusCode != http.StatusOK {
		t.Fatalf("deposit failed: err=%v status=%v", err, depResp)
	}
	_ = depResp.Body.Close()

	devSeed, devPub, _ := envelope.GenerateKeyPair()
	pollSecret := "device-poll-secret-xyz"
	pollHash := sha512.Sum512([]byte(pollSecret))
	reqBody, _ := json.Marshal(map[string]any{
		"device_public_key": devPub,
		"poll_secret_hash":  pollHash[:],
		"claimed_email":     "u1001@levitation.web.id",
	})
	createResp, err := http.Post(escrowSrv.URL+"/escrow/v1/recovery-requests", "application/json", bytes.NewReader(reqBody))
	if err != nil {
		t.Fatalf("create recovery request: %v", err)
	}
	var created struct {
		RequestID string `json:"request_id"`
	}
	_ = json.NewDecoder(createResp.Body).Decode(&created)
	_ = createResp.Body.Close()

	deviceComputedCode := envelope.ComputeRequestCode(created.RequestID, devPub)

	if err := runCLI([]string{
		"approve",
		"--code", deviceComputedCode,
		"--user-id", "1001",
		"--support-ref", "SUP-2026-777",
		"--key-file", filepath.Join(tmpDir, "custody-v1.key"),
		"--passphrase", "vault-pass-999",
		"--cooldown-hours", "0",
		"--server", escrowSrv.URL,
		"--admin-token", "admin-sudo-token",
	}, &out); err != nil {
		t.Fatalf("approve failed: %v", err)
	}

	pollReq, _ := http.NewRequest(http.MethodGet, escrowSrv.URL+"/escrow/v1/recovery-requests/"+created.RequestID, nil)
	pollReq.Header.Set("X-Poll-Secret", pollSecret)
	pollResp, err := http.DefaultClient.Do(pollReq)
	if err != nil || pollResp.StatusCode != http.StatusOK {
		t.Fatalf("poll failed: err=%v status=%v", err, pollResp)
	}
	var pollResult struct {
		DeviceBlob string `json:"device_blob"`
	}
	_ = json.NewDecoder(pollResp.Body).Decode(&pollResult)
	_ = pollResp.Body.Close()

	rawDeviceBlob, _ := base64.StdEncoding.DecodeString(pollResult.DeviceBlob)
	recoveredKey, err := envelope.OpenDevice(devSeed, created.RequestID, rawDeviceBlob)
	if err != nil {
		t.Fatalf("OpenDevice failed: %v", err)
	}
	if !bytes.Equal(recoveredKey, originalRecoveryKey) {
		t.Fatalf("recovered key mismatch: got %x, want %x", recoveredKey, originalRecoveryKey)
	}

	if err := runCLI([]string{
		"audit-verify",
		"--server", escrowSrv.URL,
		"--admin-token", "admin-sudo-token",
	}, &out); err != nil {
		t.Fatalf("audit-verify failed: %v", err)
	}
}
