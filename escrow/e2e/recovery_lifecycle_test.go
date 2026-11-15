package e2e

import (
	"bytes"
	"crypto/sha512"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ente/escrow/internal/api"
	"github.com/ente/escrow/internal/envelope"
	"github.com/ente/escrow/internal/museum"
	"github.com/ente/escrow/internal/store"
)

const (
	defaultPostgresDSN     = "postgres://pguser:pgpass@localhost:5432/ente_db?sslmode=disable&search_path=escrow"
	managedUserID          = 2001
	zeroKnowledgeUserID    = 2002
	managedUserToken       = "token-managed-2001"
	zeroKnowledgeUserToken = "token-zk-2002"
	sudoAdminToken         = "sudo-admin-token"
	custodyPassphrase      = "e2e-custody-passphrase"
	defaultKEKVersion      = "v1"
	recoveryKeyByteLength  = 32
	recoveryKeyFillByte    = 0xfe
	deterministicReqID     = "550e8400-e29b-41d4-a716-446655440000"
	expectedVectorCode     = "TUU2H-5AQV7-ASMSS-AD747"
)

type e2eEnvironment struct {
	adminBin    string
	keyFilePath string
	escrowURL   string
	custodyPub  []byte
}

func initE2EStore(t *testing.T) store.Store {
	t.Helper()
	dsn := os.Getenv("ESCROW_E2E_PG_DSN")
	if dsn == "" {
		dsn = defaultPostgresDSN
	}
	migrationRaw, _ := os.ReadFile(filepath.Join("..", "migrations", "001_init.sql"))
	pgStore, err := store.NewPostgresStore(dsn, string(migrationRaw))
	if err == nil {
		t.Cleanup(func() { _ = pgStore.Close() })
		return pgStore
	}
	return store.NewMemoryStore()
}

func startStubMuseum(t *testing.T) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /users/details/v2", func(w http.ResponseWriter, r *http.Request) {
		switch r.Header.Get("X-Auth-Token") {
		case managedUserToken:
			_ = json.NewEncoder(w).Encode(map[string]any{"details": map[string]any{"id": managedUserID, "email": "managed@levitation.web.id"}})
		case zeroKnowledgeUserToken:
			_ = json.NewEncoder(w).Encode(map[string]any{"details": map[string]any{"id": zeroKnowledgeUserID, "email": "zk@levitation.web.id"}})
		default:
			w.WriteHeader(http.StatusUnauthorized)
		}
	})
	mux.HandleFunc("GET /admin/users", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Auth-Token") == sudoAdminToken {
			_ = json.NewEncoder(w).Encode(map[string]any{"users": []any{}})
			return
		}
		w.WriteHeader(http.StatusUnauthorized)
	})
	mux.HandleFunc("GET /admin/user", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"user": map[string]any{"id": managedUserID, "email": "managed@levitation.web.id"}})
	})
	mux.HandleFunc("POST /admin/mail", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func setupE2EEnvironment(t *testing.T) e2eEnvironment {
	t.Helper()
	tmpDir := t.TempDir()
	adminBin := filepath.Join(tmpDir, "escrow-admin")
	if out, err := exec.Command("go", "build", "-o", adminBin, "../cmd/escrow-admin").CombinedOutput(); err != nil {
		t.Fatalf("build escrow-admin: %v\n%s", err, string(out))
	}
	keygenCmd := exec.Command(adminBin, "keygen", "--version", defaultKEKVersion, "--out-dir", tmpDir, "--passphrase", custodyPassphrase)
	if out, err := keygenCmd.CombinedOutput(); err != nil {
		t.Fatalf("escrow-admin keygen failed: %v\n%s", err, string(out))
	}
	custodyPub, err := os.ReadFile(filepath.Join(tmpDir, "custody-v1.pub"))
	if err != nil {
		t.Fatalf("read custody-v1.pub: %v", err)
	}
	museumSrv := startStubMuseum(t)
	escrowSrv := httptest.NewServer(api.NewServer(api.ServerConfig{
		Store:            initE2EStore(t),
		Museum:           museum.NewHTTPClient(museumSrv.URL),
		CustodyPublicKey: custodyPub,
		KEKVersion:       defaultKEKVersion,
	}))
	t.Cleanup(escrowSrv.Close)
	return e2eEnvironment{
		adminBin:    adminBin,
		keyFilePath: filepath.Join(tmpDir, "custody-v1.key"),
		escrowURL:   escrowSrv.URL,
		custodyPub:  custodyPub,
	}
}

func depositManagedRecoveryKey(t *testing.T, env e2eEnvironment, recoveryKey []byte) {
	t.Helper()
	pubResp, err := http.Get(env.escrowURL + "/escrow/v1/public-key")
	if err != nil {
		t.Fatalf("GET public-key: %v", err)
	}
	var pubData struct {
		KEKVersion string `json:"kek_version"`
		PublicKey  string `json:"public_key"`
	}
	_ = json.NewDecoder(pubResp.Body).Decode(&pubData)
	_ = pubResp.Body.Close()

	serverPubBytes, _ := base64.StdEncoding.DecodeString(pubData.PublicKey)
	if envelope.PublicKeyFingerprint(serverPubBytes) != envelope.PublicKeyFingerprint(env.custodyPub) {
		t.Fatal("server public key fingerprint did not match pinned fingerprint")
	}
	custodyBlob, err := envelope.SealCustody(serverPubBytes, envelope.CustodyContext{UserID: managedUserID, KEKVersion: pubData.KEKVersion}, recoveryKey)
	if err != nil {
		t.Fatalf("SealCustody: %v", err)
	}
	commitment := envelope.ComputeCommitment(managedUserID, recoveryKey)
	depBody, _ := json.Marshal(map[string]any{
		"kek_version":             pubData.KEKVersion,
		"cipher_suite":            envelope.CipherSuiteID,
		"custody_blob":            custodyBlob,
		"recovery_key_commitment": commitment[:],
	})
	depReq, _ := http.NewRequest(http.MethodPut, env.escrowURL+"/escrow/v1/deposit", bytes.NewReader(depBody))
	depReq.Header.Set("X-Auth-Token", managedUserToken)
	depResp, err := http.DefaultClient.Do(depReq)
	if err != nil || depResp.StatusCode != http.StatusOK {
		t.Fatalf("PUT deposit failed: %v", err)
	}
	_ = depResp.Body.Close()
}

func submitDeviceRecoveryRequest(t *testing.T, escrowURL string, devicePub []byte) (string, string, string) {
	t.Helper()
	pollSecret := "e2e-poll-secret-token"
	pollHash := sha512.Sum512([]byte(pollSecret))
	reqBody, _ := json.Marshal(map[string]any{
		"device_public_key": devicePub,
		"poll_secret_hash":  pollHash[:],
		"claimed_email":     "managed@levitation.web.id",
	})
	recResp, err := http.Post(escrowURL+"/escrow/v1/recovery-requests", "application/json", bytes.NewReader(reqBody))
	if err != nil {
		t.Fatalf("POST recovery-requests: %v", err)
	}
	var created struct {
		RequestID string `json:"request_id"`
	}
	_ = json.NewDecoder(recResp.Body).Decode(&created)
	_ = recResp.Body.Close()
	return created.RequestID, envelope.ComputeRequestCode(created.RequestID, devicePub), pollSecret
}

func runAdminApproveCLI(env e2eEnvironment, requestCode string, userID int64) ([]byte, error) {
	return exec.Command(
		env.adminBin, "approve",
		"--code", requestCode,
		"--user-id", fmt.Sprintf("%d", userID),
		"--support-ref", "E2E-SUP-001",
		"--key-file", env.keyFilePath,
		"--passphrase", custodyPassphrase,
		"--cooldown-hours", "0",
		"--server", env.escrowURL,
		"--admin-token", sudoAdminToken,
	).CombinedOutput()
}

func TestFullRecoveryLifecycle_EndToEnd(t *testing.T) {
	env := setupE2EEnvironment(t)
	originalRecoveryKey := bytes.Repeat([]byte{recoveryKeyFillByte}, recoveryKeyByteLength)
	depositManagedRecoveryKey(t, env, originalRecoveryKey)

	deviceSeed, devicePub, err := envelope.GenerateKeyPair()
	if err != nil {
		t.Fatalf("GenerateKeyPair: %v", err)
	}
	requestID, requestCode, pollSecret := submitDeviceRecoveryRequest(t, env.escrowURL, devicePub)
	if out, err := runAdminApproveCLI(env, requestCode, managedUserID); err != nil {
		t.Fatalf("escrow-admin approve failed: %v\n%s", err, string(out))
	}

	pollReq, _ := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/escrow/v1/recovery-requests/%s", env.escrowURL, requestID), nil)
	pollReq.Header.Set("X-Poll-Secret", pollSecret)
	pollResp, err := http.DefaultClient.Do(pollReq)
	if err != nil || pollResp.StatusCode != http.StatusOK {
		t.Fatalf("poll recovery request failed: %v status=%v", err, pollResp)
	}
	var pollPayload struct {
		DeviceBlob string `json:"device_blob"`
	}
	_ = json.NewDecoder(pollResp.Body).Decode(&pollPayload)
	_ = pollResp.Body.Close()

	rawDeviceBlob, _ := base64.StdEncoding.DecodeString(pollPayload.DeviceBlob)
	decryptedKey, err := envelope.OpenDevice(deviceSeed, requestID, rawDeviceBlob)
	if err != nil {
		t.Fatalf("OpenDevice failed: %v", err)
	}
	if !bytes.Equal(decryptedKey, originalRecoveryKey) {
		t.Fatalf("decrypted recoveryKey != originalRecoveryKey")
	}

	auditCmd := exec.Command(env.adminBin, "audit-verify", "--server", env.escrowURL, "--admin-token", sudoAdminToken)
	if out, err := auditCmd.CombinedOutput(); err != nil {
		t.Fatalf("escrow-admin audit-verify failed: %v\n%s", err, string(out))
	}
}

func TestRecoveryLifecycle_RejectsZeroKnowledgeAndTamperedPublicKey(t *testing.T) {
	env := setupE2EEnvironment(t)
	depositManagedRecoveryKey(t, env, bytes.Repeat([]byte{recoveryKeyFillByte}, recoveryKeyByteLength))

	_, zkDevPub, _ := envelope.GenerateKeyPair()
	_, zkCode, _ := submitDeviceRecoveryRequest(t, env.escrowURL, zkDevPub)
	if _, err := runAdminApproveCLI(env, zkCode, zeroKnowledgeUserID); err == nil {
		t.Fatal("expected escrow-admin approve to fail for zero_knowledge user 2002")
	}

	_, honestDevPub, _ := envelope.GenerateKeyPair()
	_, attackerDevPub, _ := envelope.GenerateKeyPair()
	reqID, honestCode, _ := submitDeviceRecoveryRequest(t, env.escrowURL, honestDevPub)

	tamperedSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/escrow/v1/admin/recovery-requests/") && r.Method == http.MethodGet {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"request_id": reqID, "request_code": honestCode, "device_public_key": attackerDevPub, "status": "pending",
			})
			return
		}
		http.Error(w, "unexpected route", http.StatusBadRequest)
	}))
	t.Cleanup(tamperedSrv.Close)

	tamperedEnv := env
	tamperedEnv.escrowURL = tamperedSrv.URL
	if _, err := runAdminApproveCLI(tamperedEnv, honestCode, managedUserID); err == nil {
		t.Fatal("expected escrow-admin approve to abort when server swaps device_public_key")
	}

	var detSeed [envelope.SecretKeySeedBytes]byte
	for idx := range detSeed {
		detSeed[idx] = byte(idx)
	}
	detPub, _ := envelope.DerivePublicKey(detSeed)
	if got := envelope.ComputeRequestCode(deterministicReqID, detPub); got != expectedVectorCode {
		t.Fatalf("deterministic request_code mismatch: got %s, want %s", got, expectedVectorCode)
	}
}
