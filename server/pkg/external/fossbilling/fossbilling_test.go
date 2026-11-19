package fossbilling

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ente/museum/ente"
	"github.com/ente/museum/pkg/controller"
	"github.com/stretchr/testify/require"
)

const (
	testSecretKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	testEncKey    = "0123456789abcdef0123456789abcdef"
	testHashKey   = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
	testQuota50GB = int64(53687091200)
)

func newTestModule(t *testing.T, serverURL string) (*memState, *Module, *Channel) {
	t.Helper()
	state, userRepo, billingRepo := openTestRepos([]byte(testEncKey), []byte(testHashKey))
	billingCtrl := &controller.BillingController{
		BillingPlansPerAccount: ente.BillingPlansPerAccount{
			ente.DefaultStripeAccountCountry: {
				"US": {{ID: "50gb_monthly_v4", StripeID: "50gb_monthly_v4", Storage: testQuota50GB}},
			},
		},
		BillingRepo: billingRepo,
		UserRepo:    userRepo,
	}
	mod, err := NewModule(ModuleDeps{
		UserRepo:    userRepo,
		BillingRepo: billingRepo,
		BillingCtrl: billingCtrl,
	}, ModuleConfig{
		BaseURL:      serverURL,
		AppID:        DefaultAppID,
		SharedSecret: testSecretKey,
	})
	require.NoError(t, err)
	peerChan := newTestChannel(t, DefaultAppID)
	return state, mod, peerChan
}

func newTestChannel(t *testing.T, appID string) *Channel {
	t.Helper()
	ch, err := NewChannel(appID, testSecretKey)
	require.NoError(t, err)
	return ch
}

func newDirectEnvelopeServer(t *testing.T, secret string, resp map[string]any) *httptest.Server {
	t.Helper()
	peerChan, err := NewChannel(DefaultAppID, secret)
	require.NoError(t, err)
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var env Envelope
		require.NoError(t, json.NewDecoder(r.Body).Decode(&env))
		_, err := peerChan.Open(env)
		require.NoError(t, err)
		respEnv, err := peerChan.Seal(resp)
		require.NoError(t, err)
		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(respEnv))
	}))
}

func seedFreeUser(t *testing.T, state *memState, userID int64) {
	t.Helper()
	require.NoError(t, state.seedUser(userID, "user@example.com", ente.Subscription{
		ID:                    userID * 10,
		ProductID:             ente.FreePlanProductID,
		OriginalTransactionID: ente.FreePlanTransactionID,
	}))
}

func mustSeal(t *testing.T, ch *Channel, payload map[string]any) Envelope {
	t.Helper()
	env, err := ch.Seal(payload)
	require.NoError(t, err)
	return env
}

func TestFlexInt64_UnmarshalJSON_ParsesNumericStringsEmptyAndNull(t *testing.T) {
	// Arrange
	raw := `{"action":"activate","order_id":"42","client_id":7,"external_user_id":"1001","plan_metadata":{"storage_bytes":"53687091200"},"expires_at_micro":"1900000000000000"}`
	rawNullAndEmpty := `{"action":"activate","order_id":42,"client_id":"","external_user_id":null}`

	// Act
	var cmd WebhookCommand
	err := json.Unmarshal([]byte(raw), &cmd)
	var cmdNull WebhookCommand
	errNull := json.Unmarshal([]byte(rawNullAndEmpty), &cmdNull)

	// Assert
	require.NoError(t, err)
	require.Equal(t, int64(42), int64(cmd.OrderID))
	require.Equal(t, int64(7), int64(cmd.ClientID))
	require.Equal(t, int64(1001), int64(cmd.ExternalUserID))
	require.Equal(t, testQuota50GB, cmd.EffectiveStorageBytes())

	require.NoError(t, errNull)
	require.Equal(t, int64(0), int64(cmdNull.ClientID))
	require.Equal(t, int64(0), int64(cmdNull.ExternalUserID))
}

func TestEffectiveStorageBytes_PrefersPlanMetadata_FallsBackToTopLevel(t *testing.T) {
	// Arrange
	cmdWithMeta := WebhookCommand{
		PlanMetadata: PlanMetadata{StorageBytes: FlexInt64(testQuota50GB)},
		StorageBytes: FlexInt64(1024),
	}
	cmdTopOnly := WebhookCommand{StorageBytes: FlexInt64(2048)}
	claimTopOnly := ClaimEntitlementResult{StorageBytes: FlexInt64(4096)}

	// Act & Assert
	require.Equal(t, testQuota50GB, cmdWithMeta.EffectiveStorageBytes())
	require.Equal(t, int64(2048), cmdTopOnly.EffectiveStorageBytes())
	require.Equal(t, int64(4096), claimTopOnly.EffectiveStorageBytes())
}
