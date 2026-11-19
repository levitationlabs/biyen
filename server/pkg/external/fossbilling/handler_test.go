package fossbilling

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/spf13/viper"
	"github.com/stretchr/testify/require"
)

func newTestRouter(mod *Module) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	mod.RegisterRoutes(router, router, router)
	return router
}

func performJSONRequest(t *testing.T, router *gin.Engine, req *http.Request) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func TestHandler_CreateCheckoutSession_ValidRequest_Returns200WithCheckoutURL(t *testing.T) {
	// Arrange
	srv := newMockFOSSBillingServer(testSecretKey, func(path string, req map[string]any) map[string]any {
		return map[string]any{
			"checkout_url": "https://billing.example.com/invoice/abc",
			"order_id":     105,
			"invoice_hash": "abc",
		}
	})
	defer srv.Close()

	state, mod, _ := newTestModule(t, srv.URL)
	seedFreeUser(t, state, 700)
	router := newTestRouter(mod)

	body, err := json.Marshal(map[string]any{
		"productID":   "50gb_monthly_v4",
		"action":      "update",
		"redirectURL": "https://photos.example.com/gallery",
	})
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, RouteCheckoutSession, bytes.NewReader(body))
	req.Header.Set("X-Auth-User-ID", "700")
	req.Header.Set("Content-Type", "application/json")

	// Act
	rec := performJSONRequest(t, router, req)

	// Assert
	require.Equal(t, http.StatusOK, rec.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Equal(t, "https://billing.example.com/invoice/abc", resp["checkoutURL"])
	require.Equal(t, float64(105), resp["orderID"])
	require.Equal(t, "abc", resp["invoiceHash"])
}

func TestHandler_CreateCheckoutSession_BadRequest_Returns400(t *testing.T) {
	// Arrange
	_, mod, _ := newTestModule(t, "https://billing.example.com")
	router := newTestRouter(mod)
	cases := []struct {
		name string
		body string
	}{
		{name: "malformed json", body: `{"productID":`},
		{name: "javascript redirectURL", body: `{"productID":"50gb","redirectURL":"javascript:alert(1)"}`},
		{name: "missing redirectURL host", body: `{"productID":"50gb","redirectURL":"https:///only-path"}`},
		{name: "empty productID", body: `{"productID":"","redirectURL":"https://photos.example.com/done"}`},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, RouteCheckoutSession, bytes.NewBufferString(tc.body))
			req.Header.Set("X-Auth-User-ID", "700")
			req.Header.Set("Content-Type", "application/json")

			// Act
			rec := performJSONRequest(t, router, req)

			// Assert
			require.Equal(t, http.StatusBadRequest, rec.Code)
		})
	}
}

func TestHandler_HandleWebhook_ValidEnvelope_Returns200SealedResponse(t *testing.T) {
	// Arrange
	state, mod, peerChan := newTestModule(t, "")
	seedFreeUser(t, state, 501)
	router := newTestRouter(mod)

	env, err := peerChan.Seal(map[string]any{
		"action":           WebhookActionActivate,
		"order_id":         77,
		"client_id":        9,
		"external_user_id": 501,
		"plan_id":          "50gb_monthly_v4",
		"storage_bytes":    testQuota50GB,
		"expires_at_micro": int64(1900000000000000),
	})
	require.NoError(t, err)
	body, err := json.Marshal(env)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, RouteWebhook, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	// Act
	rec := performJSONRequest(t, router, req)

	// Assert
	require.Equal(t, http.StatusOK, rec.Code)
	var respEnv Envelope
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &respEnv))
	ack, err := peerChan.Open(respEnv)
	require.NoError(t, err)
	require.Equal(t, StatusProvisioned, ack["status"])
	require.Equal(t, "fb:77", state.subs[501].OriginalTransactionID)
}

func TestHandler_HandleWebhook_InvalidEnvelopeOrSignature_ReturnsError(t *testing.T) {
	// Arrange
	_, mod, peerChan := newTestModule(t, "")
	router := newTestRouter(mod)

	wrongKeyChan, err := NewChannel(DefaultAppID, "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
	require.NoError(t, err)
	badSigEnv, err := wrongKeyChan.Seal(map[string]any{"action": WebhookActionActivate})
	require.NoError(t, err)
	badSigBody, err := json.Marshal(badSigEnv)
	require.NoError(t, err)

	validEnv, err := peerChan.Seal(map[string]any{"action": WebhookActionCancel, "order_id": 1})
	require.NoError(t, err)
	validBody, err := json.Marshal(validEnv)
	require.NoError(t, err)

	// Act: malformed JSON -> 400
	malformedReq := httptest.NewRequest(http.MethodPost, RouteWebhook, bytes.NewBufferString("{bad"))
	malformedRec := performJSONRequest(t, router, malformedReq)

	// Act: bad signature -> 403 (ErrPermissionDenied)
	badSigReq := httptest.NewRequest(http.MethodPost, RouteWebhook, bytes.NewReader(badSigBody))
	badSigRec := performJSONRequest(t, router, badSigReq)

	// Act: replay -> first 200, second 403
	firstReq := httptest.NewRequest(http.MethodPost, RouteWebhook, bytes.NewReader(validBody))
	firstRec := performJSONRequest(t, router, firstReq)
	replayReq := httptest.NewRequest(http.MethodPost, RouteWebhook, bytes.NewReader(validBody))
	replayRec := performJSONRequest(t, router, replayReq)

	// Assert
	require.Equal(t, http.StatusBadRequest, malformedRec.Code)
	require.Equal(t, http.StatusForbidden, badSigRec.Code)
	require.Equal(t, http.StatusOK, firstRec.Code)
	require.Equal(t, http.StatusForbidden, replayRec.Code)
}

func TestHandler_CustomerPortal_ReturnsConfiguredPortalURL(t *testing.T) {
	// Arrange: default portal URL derived from BaseURL
	_, mod, _ := newTestModule(t, "https://billing.example.com/")
	router := newTestRouter(mod)

	req := httptest.NewRequest(http.MethodGet, RouteCustomerPortal, nil)
	req.Header.Set("X-Auth-User-ID", "700")

	// Act
	rec := performJSONRequest(t, router, req)

	// Assert
	require.Equal(t, http.StatusOK, rec.Code)
	var resp map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Equal(t, "https://billing.example.com/order/service", resp["url"])

	// Arrange: explicit PortalURL overrides BaseURL + DefaultPortalPath
	customMod, err := NewModule(ModuleDeps{}, ModuleConfig{
		BaseURL:      "https://billing.example.com",
		PortalURL:    "https://portal.example.com/account",
		SharedSecret: testSecretKey,
	})
	require.NoError(t, err)
	customRouter := newTestRouter(customMod)
	customReq := httptest.NewRequest(http.MethodGet, RouteCustomerPortal, nil)

	// Act
	customRec := performJSONRequest(t, customRouter, customReq)

	// Assert
	require.Equal(t, http.StatusOK, customRec.Code)
	require.Contains(t, customRec.Body.String(), "https://portal.example.com/account")
}

func TestModule_NewModuleFromViper_UnconfiguredDisabledAndConfiguredEnabled(t *testing.T) {
	// Arrange: preserve and restore Viper keys
	keys := []string{
		"fossbilling.base-url",
		"fossbilling.app-id",
		"fossbilling.shared-secret",
		"fossbilling.portal-url",
		"fossbilling.max-drift-seconds",
	}
	prev := make(map[string]any, len(keys))
	for _, k := range keys {
		prev[k] = viper.Get(k)
		viper.Set(k, nil)
	}
	t.Cleanup(func() {
		for _, k := range keys {
			viper.Set(k, prev[k])
		}
	})

	// Act: unconfigured module
	disabledMod, err := NewModuleFromViper(ModuleDeps{})

	// Assert: unconfigured state is safely disabled and routes return 501
	require.NoError(t, err)
	require.False(t, disabledMod.IsConfigured())
	disabledRouter := newTestRouter(disabledMod)

	portalRec := performJSONRequest(t, disabledRouter, httptest.NewRequest(http.MethodGet, RouteCustomerPortal, nil))
	require.Equal(t, http.StatusNotImplemented, portalRec.Code)
	require.NoError(t, disabledMod.Service.OnAccountDeleted(context.Background(), 1))

	// Act: configured via Viper
	viper.Set("fossbilling.base-url", "https://billing.viper.example")
	viper.Set("fossbilling.app-id", DefaultAppID)
	viper.Set("fossbilling.shared-secret", testSecretKey)
	viper.Set("fossbilling.portal-url", "https://billing.viper.example/portal")
	viper.Set("fossbilling.max-drift-seconds", 120)

	enabledMod, err := NewModuleFromViper(ModuleDeps{})

	// Assert
	require.NoError(t, err)
	require.True(t, enabledMod.IsConfigured())
	require.Equal(t, int64(120), enabledMod.Channel.MaxDriftSeconds)
	portalURL, err := enabledMod.Service.GetCustomerPortalURL(context.Background(), 1, "")
	require.NoError(t, err)
	require.Equal(t, "https://billing.viper.example/portal", portalURL)
}
