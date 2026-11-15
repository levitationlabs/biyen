package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/ente/escrow/internal/store"
)

const httpAdminTimeout = 15 * time.Second

type adminClient struct {
	serverURL  string
	adminToken string
	httpClient *http.Client
}

type userDepositsResponse struct {
	UserID   int64           `json:"user_id"`
	Mode     string          `json:"mode"`
	Deposits []store.Deposit `json:"deposits"`
}

func newAdminClient(serverURL string, adminToken string) *adminClient {
	trimmed := strings.TrimRight(strings.TrimSpace(serverURL), "/")
	if trimmed == "" {
		trimmed = defaultEscrowServerURL
	}
	return &adminClient{
		serverURL:  trimmed,
		adminToken: strings.TrimSpace(adminToken),
		httpClient: &http.Client{Timeout: httpAdminTimeout},
	}
}

func (c *adminClient) fetchRecoveryRequest(code string) (store.RecoveryRequest, error) {
	var out store.RecoveryRequest
	err := c.doGet("/escrow/v1/admin/recovery-requests/"+store.NormalizeRequestCode(code), &out)
	return out, err
}

func (c *adminClient) fetchUserDeposits(userID int64) (userDepositsResponse, error) {
	var out userDepositsResponse
	err := c.doGet(fmt.Sprintf("/escrow/v1/admin/users/%d/deposits", userID), &out)
	return out, err
}

func (c *adminClient) fetchAuditLog() ([]store.AuditEntry, error) {
	var wrapper struct {
		Entries []store.AuditEntry `json:"entries"`
	}
	err := c.doGet("/escrow/v1/admin/audit", &wrapper)
	return wrapper.Entries, err
}

func (c *adminClient) postApprove(requestID string, payload map[string]any) (store.RecoveryRequest, error) {
	var out store.RecoveryRequest
	err := c.doPost("/escrow/v1/admin/recovery-requests/"+requestID+"/approve", payload, &out)
	return out, err
}

func (c *adminClient) postReject(requestID string, supportRef string) error {
	return c.doPost("/escrow/v1/admin/recovery-requests/"+requestID+"/reject", map[string]string{"support_ref": supportRef}, nil)
}

func (c *adminClient) doGet(path string, target any) error {
	req, err := http.NewRequest(http.MethodGet, c.serverURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("X-Auth-Token", c.adminToken)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("GET %s failed (%d): %s", path, resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return json.NewDecoder(resp.Body).Decode(target)
}

func (c *adminClient) doPost(path string, body any, target any) error {
	raw, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, c.serverURL+path, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Auth-Token", c.adminToken)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("POST %s failed (%d): %s", path, resp.StatusCode, strings.TrimSpace(string(errBody)))
	}
	if target != nil {
		return json.NewDecoder(resp.Body).Decode(target)
	}
	return nil
}

func envOrFallback(key string, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}
