package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/ente/escrow/internal/envelope"
	"github.com/ente/escrow/internal/museum"
	"github.com/ente/escrow/internal/store"
)

type stubMuseumServer struct {
	server *httptest.Server
	mu     sync.Mutex
	emails []museum.NotificationEmailRequest
}

func newStubMuseumServer(t *testing.T) *stubMuseumServer {
	t.Helper()
	stub := &stubMuseumServer{}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /users/details/v2", func(w http.ResponseWriter, r *http.Request) {
		switch r.Header.Get("X-Auth-Token") {
		case "valid-user-1001":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"details": map[string]any{"id": 1001, "email": "user1001@levitation.web.id"},
			})
		default:
			w.WriteHeader(http.StatusUnauthorized)
		}
	})
	mux.HandleFunc("GET /admin/users", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Auth-Token") != "valid-admin-token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"users": []any{}})
	})
	mux.HandleFunc("GET /admin/user", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Auth-Token") != "valid-admin-token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"user": map[string]any{"id": 1001, "email": "user1001@levitation.web.id"}})
	})
	mux.HandleFunc("POST /admin/mail", func(w http.ResponseWriter, r *http.Request) {
		var mail museum.NotificationEmailRequest
		_ = json.NewDecoder(r.Body).Decode(&mail)
		stub.mu.Lock()
		stub.emails = append(stub.emails, mail)
		stub.mu.Unlock()
		w.WriteHeader(http.StatusOK)
	})
	stub.server = httptest.NewServer(mux)
	t.Cleanup(stub.server.Close)
	return stub
}

func (s *stubMuseumServer) sentEmailCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.emails)
}

func setupTestEscrowServer(t *testing.T) (*httptest.Server, *store.MemoryStore, *stubMuseumServer, []byte) {
	t.Helper()
	_, custodyPub, err := envelope.GenerateKeyPair()
	if err != nil {
		t.Fatalf("GenerateKeyPair: %v", err)
	}
	memStore := store.NewMemoryStore()
	stubMuseum := newStubMuseumServer(t)
	srv := NewServer(ServerConfig{
		Store:            memStore,
		Museum:           museum.NewHTTPClient(stubMuseum.server.URL),
		CustodyPublicKey: custodyPub,
		KEKVersion:       "v1",
	})
	ts := httptest.NewServer(srv)
	t.Cleanup(ts.Close)
	return ts, memStore, stubMuseum, custodyPub
}

func putDepositHelper(t *testing.T, baseURL string, token string, custodyPub []byte) *http.Response {
	t.Helper()
	recoveryKey := bytes.Repeat([]byte{0x42}, 32)
	blob, err := envelope.SealCustody(custodyPub, envelope.CustodyContext{UserID: 1001, KEKVersion: "v1"}, recoveryKey)
	if err != nil {
		t.Fatalf("SealCustody: %v", err)
	}
	commit := envelope.ComputeCommitment(1001, recoveryKey)
	payload, _ := json.Marshal(map[string]any{
		"kek_version":             "v1",
		"cipher_suite":            envelope.CipherSuiteID,
		"custody_blob":            blob,
		"recovery_key_commitment": commit[:],
	})
	req, _ := http.NewRequest(http.MethodPut, baseURL+"/escrow/v1/deposit", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("X-Auth-Token", token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("do deposit request: %v", err)
	}
	return resp
}

func TestDeposit_StoresUpTo5VersionsAndSetsManagedMode(t *testing.T) {
	ts, _, _, custodyPub := setupTestEscrowServer(t)
	for i := 1; i <= 7; i++ {
		resp := putDepositHelper(t, ts.URL, "valid-user-1001", custodyPub)
		_ = resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("deposit %d status=%d, want 200", i, resp.StatusCode)
		}
	}
	req, _ := http.NewRequest(http.MethodGet, ts.URL+"/escrow/v1/admin/users/1001/deposits", nil)
	req.Header.Set("X-Auth-Token", "valid-admin-token")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("admin deposits: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()
	var data struct {
		Mode     string          `json:"mode"`
		Deposits []store.Deposit `json:"deposits"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&data)
	if data.Mode != store.ModeManaged || len(data.Deposits) != store.MaxDepositsPerUser {
		t.Fatalf("mode=%s len=%d", data.Mode, len(data.Deposits))
	}
	if data.Deposits[0].ID != 7 || data.Deposits[4].ID != 3 {
		t.Fatalf("unexpected retained deposit IDs: newest=%d oldest=%d", data.Deposits[0].ID, data.Deposits[4].ID)
	}
}

func TestDeposit_RejectsUnauthorizedToken(t *testing.T) {
	ts, _, _, custodyPub := setupTestEscrowServer(t)
	resp := putDepositHelper(t, ts.URL, "invalid-token", custodyPub)
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
}

func TestScheduleZeroKnowledge_Enforces7DayGracePeriodAndEmailsUser(t *testing.T) {
	ts, memStore, stubMuseum, custodyPub := setupTestEscrowServer(t)
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	memStore.SetClock(func() time.Time { return now })
	_ = putDepositHelper(t, ts.URL, "valid-user-1001", custodyPub).Body.Close()

	zkReq, _ := http.NewRequest(http.MethodPost, ts.URL+"/escrow/v1/zero-knowledge", nil)
	zkReq.Header.Set("X-Auth-Token", "valid-user-1001")
	zkResp, _ := http.DefaultClient.Do(zkReq)
	_ = zkResp.Body.Close()
	if zkResp.StatusCode != http.StatusOK || stubMuseum.sentEmailCount() != 1 {
		t.Fatalf("status=%d emails=%d", zkResp.StatusCode, stubMuseum.sentEmailCount())
	}

	memStore.SetClock(func() time.Time { return now.Add(6 * 24 * time.Hour) })
	statusBefore, _ := memStore.GetAccountStatus(t.Context(), 1001)
	if statusBefore.Mode != store.ModeManaged || statusBefore.DepositCount != 1 {
		t.Fatalf("expected managed mode with 1 deposit at day 6, got mode=%s count=%d", statusBefore.Mode, statusBefore.DepositCount)
	}

	memStore.SetClock(func() time.Time { return now.Add(7*24*time.Hour + time.Second) })
	statusAfter, _ := memStore.GetAccountStatus(t.Context(), 1001)
	if statusAfter.Mode != store.ModeZeroKnowledge || statusAfter.DepositCount != 0 {
		t.Fatalf("expected zero_knowledge with 0 deposits after 7 days, got mode=%s count=%d", statusAfter.Mode, statusAfter.DepositCount)
	}
}

func TestCancelZeroKnowledge_RestoresManagedMode(t *testing.T) {
	ts, memStore, _, custodyPub := setupTestEscrowServer(t)
	_ = putDepositHelper(t, ts.URL, "valid-user-1001", custodyPub).Body.Close()

	zkReq, _ := http.NewRequest(http.MethodPost, ts.URL+"/escrow/v1/zero-knowledge", nil)
	zkReq.Header.Set("X-Auth-Token", "valid-user-1001")
	zkResp, _ := http.DefaultClient.Do(zkReq)
	_ = zkResp.Body.Close()

	cancelReq, _ := http.NewRequest(http.MethodPost, ts.URL+"/escrow/v1/zero-knowledge/cancel", nil)
	cancelReq.Header.Set("X-Auth-Token", "valid-user-1001")
	cancelResp, _ := http.DefaultClient.Do(cancelReq)
	_ = cancelResp.Body.Close()
	if cancelResp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", cancelResp.StatusCode)
	}
	status, _ := memStore.GetAccountStatus(t.Context(), 1001)
	if status.Mode != store.ModeManaged || status.DeleteScheduledAt != nil {
		t.Fatalf("expected managed mode with nil delete_scheduled_at, got %+v", status)
	}
}
