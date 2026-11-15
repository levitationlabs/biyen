package museum

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const defaultHTTPTimeout = 10 * time.Second

var (
	ErrUnauthorized = errors.New("museum: unauthorized token")
	ErrUpstream     = errors.New("museum: upstream error")
)

type UserDetails struct {
	ID    int64  `json:"id"`
	Email string `json:"email"`
}

type AdminPrincipal struct {
	ActorID string
}

type NotificationEmailRequest struct {
	AdminToken string `json:"-"`
	ToEmail    string `json:"email"`
	Subject    string `json:"subject"`
	Body       string `json:"body"`
}

type Client interface {
	ValidateUserToken(ctx context.Context, authToken string) (UserDetails, error)
	ValidateAdminToken(ctx context.Context, adminToken string) (AdminPrincipal, error)
	GetAdminUser(ctx context.Context, adminToken string, userID int64) (UserDetails, error)
	SendNotificationEmail(ctx context.Context, req NotificationEmailRequest) error
}

type HTTPClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewHTTPClient(baseURL string) *HTTPClient {
	trimmed := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if trimmed == "" {
		trimmed = "http://127.0.0.1:8080"
	}
	return &HTTPClient{
		baseURL:    trimmed,
		httpClient: &http.Client{Timeout: defaultHTTPTimeout},
	}
}

func (c *HTTPClient) ValidateUserToken(ctx context.Context, authToken string) (UserDetails, error) {
	token := extractToken(authToken)
	if token == "" {
		return UserDetails{}, ErrUnauthorized
	}
	url := c.baseURL + "/users/details/v2?memoryCount=false"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return UserDetails{}, err
	}
	req.Header.Set("X-Auth-Token", token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return UserDetails{}, fmt.Errorf("%w: %v", ErrUpstream, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return UserDetails{}, ErrUnauthorized
	}
	if resp.StatusCode != http.StatusOK {
		return UserDetails{}, fmt.Errorf("%w: status %d", ErrUpstream, resp.StatusCode)
	}

	var payload struct {
		ID      int64        `json:"id"`
		Email   string       `json:"email"`
		Details *UserDetails `json:"details"`
		User    *UserDetails `json:"user"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return UserDetails{}, fmt.Errorf("decode user details: %w", err)
	}
	if payload.Details != nil && payload.Details.ID > 0 {
		return *payload.Details, nil
	}
	if payload.User != nil && payload.User.ID > 0 {
		return *payload.User, nil
	}
	if payload.ID <= 0 {
		return UserDetails{}, ErrUnauthorized
	}
	return UserDetails{ID: payload.ID, Email: payload.Email}, nil
}

func (c *HTTPClient) ValidateAdminToken(ctx context.Context, adminToken string) (AdminPrincipal, error) {
	token := extractToken(adminToken)
	if token == "" {
		return AdminPrincipal{}, ErrUnauthorized
	}
	url := c.baseURL + "/admin/users?sinceTime=0"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return AdminPrincipal{}, err
	}
	req.Header.Set("X-Auth-Token", token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return AdminPrincipal{}, fmt.Errorf("%w: %v", ErrUpstream, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return AdminPrincipal{}, ErrUnauthorized
	}
	if resp.StatusCode != http.StatusOK {
		return AdminPrincipal{}, fmt.Errorf("%w: status %d", ErrUpstream, resp.StatusCode)
	}
	actorID := "admin"
	if len(token) >= 8 {
		actorID = "admin:" + token[:8]
	}
	return AdminPrincipal{ActorID: actorID}, nil
}

func (c *HTTPClient) GetAdminUser(ctx context.Context, adminToken string, userID int64) (UserDetails, error) {
	token := extractToken(adminToken)
	if token == "" {
		return UserDetails{}, ErrUnauthorized
	}
	url := fmt.Sprintf("%s/admin/user?id=%d", c.baseURL, userID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return UserDetails{}, err
	}
	req.Header.Set("X-Auth-Token", token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return UserDetails{}, fmt.Errorf("%w: %v", ErrUpstream, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return UserDetails{}, ErrUnauthorized
	}
	if resp.StatusCode != http.StatusOK {
		return UserDetails{ID: userID}, nil
	}
	var payload struct {
		ID    int64        `json:"id"`
		Email string       `json:"email"`
		User  *UserDetails `json:"user"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return UserDetails{ID: userID}, nil
	}
	if payload.User != nil && payload.User.ID > 0 {
		return *payload.User, nil
	}
	return UserDetails{ID: payload.ID, Email: payload.Email}, nil
}

func (c *HTTPClient) SendNotificationEmail(ctx context.Context, mailReq NotificationEmailRequest) error {
	if strings.TrimSpace(mailReq.ToEmail) == "" {
		return nil
	}
	bodyMap := map[string]string{
		"email":   mailReq.ToEmail,
		"to":      mailReq.ToEmail,
		"subject": mailReq.Subject,
		"body":    mailReq.Body,
	}
	rawJSON, err := json.Marshal(bodyMap)
	if err != nil {
		return err
	}
	url := c.baseURL + "/admin/mail"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(rawJSON))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if mailReq.AdminToken != "" {
		req.Header.Set("X-Auth-Token", extractToken(mailReq.AdminToken))
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUpstream, err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf("%w: mail status %d", ErrUpstream, resp.StatusCode)
	}
	return nil
}

func extractToken(header string) string {
	trimmed := strings.TrimSpace(header)
	if strings.HasPrefix(strings.ToLower(trimmed), "bearer ") {
		return strings.TrimSpace(trimmed[7:])
	}
	return trimmed
}
