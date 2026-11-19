package fossbilling

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/ente/stacktrace"
)

// Client sends encrypted commands to FOSSBilling Guest API endpoints.
type Client struct {
	BaseURL    string
	Channel    *Channel
	HTTPClient *http.Client
}

type rpcEnvelopeWrapper struct {
	Result *Envelope       `json:"result"`
	Error  *rpcErrorDetail `json:"error"`
}

type rpcErrorDetail struct {
	Message string `json:"message"`
	Code    int    `json:"code"`
}

// NewClient constructs a FOSSBilling outbound API client.
func NewClient(baseURL string, channel *Channel) *Client {
	return &Client{
		BaseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		Channel: channel,
		HTTPClient: &http.Client{
			Timeout: DefaultHTTPTimeout,
		},
	}
}

// IsConfigured reports whether the client has both a base URL and an encryption channel.
func (c *Client) IsConfigured() bool {
	return c != nil && c.BaseURL != "" && c.Channel != nil
}

// CreateCheckoutSession requests a checkout URL from FOSSBilling.
func (c *Client) CreateCheckoutSession(ctx context.Context, req CheckoutSessionRequest) (CheckoutSessionResult, error) {
	var result CheckoutSessionResult
	err := c.postEncrypted(ctx, EndpointCheckoutSession, req, &result)
	if err != nil {
		return CheckoutSessionResult{}, stacktrace.Propagate(err, "failed to create FOSSBilling checkout session")
	}
	return result, nil
}

// ClaimEntitlement checks whether a newly registered email has a pending pre-purchased entitlement.
func (c *Client) ClaimEntitlement(ctx context.Context, req ClaimEntitlementRequest) (ClaimEntitlementResult, error) {
	var result ClaimEntitlementResult
	err := c.postEncrypted(ctx, EndpointClaimEntitlement, req, &result)
	if err != nil {
		return ClaimEntitlementResult{}, stacktrace.Propagate(err, "failed to claim FOSSBilling entitlement")
	}
	return result, nil
}

// SendAccountEvent notifies FOSSBilling of an email change or account deletion.
func (c *Client) SendAccountEvent(ctx context.Context, req AccountEventRequest) error {
	var ack map[string]any
	err := c.postEncrypted(ctx, EndpointAccountEvent, req, &ack)
	if err != nil {
		return stacktrace.Propagate(err, "failed to send FOSSBilling account event")
	}
	return nil
}

func (c *Client) postEncrypted(ctx context.Context, endpoint string, payload any, target any) error {
	if !c.IsConfigured() {
		return stacktrace.NewError("FOSSBilling client is not configured")
	}
	reqEnv, err := c.Channel.SealStruct(payload)
	if err != nil {
		return stacktrace.Propagate(err, "failed to seal request payload")
	}
	respBody, err := c.doPost(ctx, c.BaseURL+endpoint, reqEnv)
	if err != nil {
		return err
	}
	respEnv, err := unwrapEnvelopeResponse(respBody)
	if err != nil {
		return err
	}
	return c.Channel.OpenInto(respEnv, target)
}

func (c *Client) doPost(ctx context.Context, url string, env Envelope) ([]byte, error) {
	bodyBytes, err := json.Marshal(env)
	if err != nil {
		return nil, stacktrace.Propagate(err, "failed to marshal envelope")
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, stacktrace.Propagate(err, "failed to build HTTP request")
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	httpClient := c.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: DefaultHTTPTimeout}
	}
	resp, err := httpClient.Do(httpReq)
	if err != nil {
		return nil, stacktrace.Propagate(err, "HTTP request to FOSSBilling failed")
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, stacktrace.Propagate(err, "failed to read FOSSBilling response body")
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, stacktrace.NewError("FOSSBilling returned HTTP %d: %s", resp.StatusCode, string(respBody))
	}
	return respBody, nil
}

func unwrapEnvelopeResponse(respBody []byte) (Envelope, error) {
	var wrapper rpcEnvelopeWrapper
	if err := json.Unmarshal(respBody, &wrapper); err == nil {
		if wrapper.Error != nil && wrapper.Error.Message != "" {
			return Envelope{}, stacktrace.NewError("FOSSBilling API error (%d): %s", wrapper.Error.Code, wrapper.Error.Message)
		}
		if wrapper.Result != nil && wrapper.Result.Payload != "" {
			return *wrapper.Result, nil
		}
	}

	var direct Envelope
	if err := json.Unmarshal(respBody, &direct); err != nil {
		return Envelope{}, stacktrace.Propagate(err, "failed to parse FOSSBilling envelope response")
	}
	if direct.Payload == "" {
		return Envelope{}, stacktrace.NewError("empty envelope payload in FOSSBilling response")
	}
	return direct, nil
}
