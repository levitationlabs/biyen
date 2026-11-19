package fossbilling

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/url"
	"strings"
	"testing"

	"github.com/ente/museum/ente"
	"github.com/ente/museum/pkg/controller"
	"github.com/stretchr/testify/require"
)

func TestCreateCheckoutSession_RPCAndDirectEnvelope_ReturnsCheckoutURL(t *testing.T) {
	// Arrange: JSON-RPC wrapped response
	var capturedPath string
	var capturedReq map[string]any
	rpcSrv := newMockFOSSBillingServer(testSecretKey, func(path string, req map[string]any) map[string]any {
		capturedPath = path
		capturedReq = req
		return map[string]any{
			"checkout_url": "https://billing.example.com/invoice/rpc-1",
			"order_id":     105,
			"invoice_hash": "rpc-1",
		}
	})
	defer rpcSrv.Close()

	state, mod, _ := newTestModule(t, rpcSrv.URL)
	seedFreeUser(t, state, 701)

	// Act
	rpcRes, err := mod.Service.CreateCheckoutSession(context.Background(), CreateCheckoutParams{
		UserID: 701, ProductID: "50gb_monthly_v4", Action: ActionBuy, RedirectURL: "https://photos.example.com/done",
	})

	// Assert JSON-RPC path & result
	require.NoError(t, err)
	require.Equal(t, EndpointCheckoutSession, capturedPath)
	require.Equal(t, "https://photos.example.com/done", capturedReq["redirect_url"])
	require.Equal(t, "https://billing.example.com/invoice/rpc-1", rpcRes.CheckoutURL)
	require.Equal(t, int64(105), int64(rpcRes.OrderID))

	// Arrange: Direct Envelope response (not wrapped in {"result": ...})
	directSrv := newDirectEnvelopeServer(t, testSecretKey, map[string]any{
		"checkout_url": "https://billing.example.com/invoice/direct-2",
		"order_id":     206,
		"invoice_hash": "direct-2",
	})
	defer directSrv.Close()

	directState, directMod, _ := newTestModule(t, directSrv.URL)
	seedFreeUser(t, directState, 702)

	// Act
	directRes, err := directMod.Service.CreateCheckoutSession(context.Background(), CreateCheckoutParams{
		UserID: 702, ProductID: "50gb_monthly_v4", Action: ActionUpdate, RedirectURL: "https://photos.example.com/updated",
	})

	// Assert Direct Envelope result
	require.NoError(t, err)
	require.Equal(t, "https://billing.example.com/invoice/direct-2", directRes.CheckoutURL)
	require.Equal(t, int64(206), int64(directRes.OrderID))
}

func TestCreateCheckoutSession_InvalidParamsOrNonFOSSBillingPlan_ReturnsError(t *testing.T) {
	// Arrange
	state, mod, _ := newTestModule(t, "https://billing.example.com")
	require.NoError(t, state.seedUser(703, "stripe@example.com", ente.Subscription{
		ID: 30, ProductID: "50gb_monthly_v4", PaymentProvider: ente.Stripe,
		OriginalTransactionID: "sub_stripe_active", ExpiryTime: 9999999999999999,
	}))
	ctx := context.Background()

	// Act & Assert
	_, missingRedirectErr := mod.Service.CreateCheckoutSession(ctx, CreateCheckoutParams{
		UserID: 703, ProductID: "50gb_monthly_v4", Action: ActionBuy, RedirectURL: "",
	})
	require.ErrorIs(t, missingRedirectErr, ente.ErrBadRequest)

	_, badActionErr := mod.Service.CreateCheckoutSession(ctx, CreateCheckoutParams{
		UserID: 703, ProductID: "50gb_monthly_v4", Action: "delete", RedirectURL: "https://photos.example.com",
	})
	require.ErrorIs(t, badActionErr, ente.ErrBadRequest)

	_, switchErr := mod.Service.CreateCheckoutSession(ctx, CreateCheckoutParams{
		UserID: 703, ProductID: "50gb_monthly_v4", Action: ActionBuy, RedirectURL: "https://photos.example.com",
	})
	require.ErrorIs(t, switchErr, ente.ErrCannotSwitchPaymentProvider)
}

func TestHandleWebhookEnvelope_ActivateAndRenew_StoresFOSSBillingFields(t *testing.T) {
	// Arrange
	state, mod, peerChan := newTestModule(t, "")
	require.NoError(t, state.seedUser(501, "Alice@Example.com", ente.Subscription{
		ID: 10, ProductID: ente.FreePlanProductID, OriginalTransactionID: ente.FreePlanTransactionID,
	}))
	ctx := context.Background()
	activateEnv := mustSeal(t, peerChan, map[string]any{
		"action": WebhookActionActivate, "order_id": 99, "client_id": 12,
		"email": "alice@example.com", "plan_id": "50gb_monthly_v4",
		"plan_metadata": map[string]any{"storage_bytes": testQuota50GB}, "expires_at_micro": int64(1900000000000000),
	})

	// Act: activate
	respEnv, err := mod.Service.HandleWebhookEnvelope(ctx, activateEnv)
	require.NoError(t, err)
	ack, err := peerChan.Open(respEnv)
	require.NoError(t, err)

	// Assert: activate
	require.Equal(t, StatusProvisioned, ack["status"])
	sub := state.subs[501]
	require.Equal(t, ente.Stripe, sub.PaymentProvider)
	require.Equal(t, "fb:99", sub.OriginalTransactionID)
	require.Equal(t, "fb:12", sub.Attributes.CustomerID)
	require.Equal(t, testQuota50GB, sub.Storage)
	require.Equal(t, int64(1900000000000000), sub.ExpiryTime)

	// Act: renew without storage_bytes (falls back to BillingPlansPerAccount)
	renewEnv := mustSeal(t, peerChan, map[string]any{
		"action": WebhookActionRenew, "order_id": 99, "client_id": 12,
		"external_user_id": 501, "plan_id": "50gb_monthly_v4", "expires_at_micro": int64(2000000000000000),
	})
	_, err = mod.Service.HandleWebhookEnvelope(ctx, renewEnv)

	// Assert: renew
	require.NoError(t, err)
	require.Equal(t, testQuota50GB, state.subs[501].Storage)
	require.Equal(t, int64(2000000000000000), state.subs[501].ExpiryTime)
}

func TestHandleWebhookEnvelope_UnknownUserEmail_ReturnsPendingRegistration(t *testing.T) {
	// Arrange
	_, mod, peerChan := newTestModule(t, "")
	env := mustSeal(t, peerChan, map[string]any{
		"action": WebhookActionActivate, "order_id": 88, "client_id": 9,
		"email": "future@example.com", "plan_id": "50gb_monthly_v4",
	})

	// Act
	respEnv, err := mod.Service.HandleWebhookEnvelope(context.Background(), env)
	require.NoError(t, err)
	ack, err := peerChan.Open(respEnv)

	// Assert
	require.NoError(t, err)
	require.Equal(t, StatusPendingRegistration, ack["status"])
	require.Equal(t, float64(88), ack["order_id"])
}

func TestHandleWebhookEnvelope_SuspendCancelUnsuspend_RespectsStaleOrderGuard(t *testing.T) {
	// Arrange
	state, mod, peerChan := newTestModule(t, "")
	require.NoError(t, state.seedUser(502, "bob@example.com", ente.Subscription{
		ID: 20, ProductID: "50gb_monthly_v4", Storage: testQuota50GB,
		OriginalTransactionID: "fb:200", ExpiryTime: 1900000000000000,
		PaymentProvider: ente.Stripe, Attributes: ente.SubscriptionAttributes{CustomerID: "fb:15"},
	}))
	ctx := context.Background()

	// Act 1: stale suspend for old order 100 must NOT overwrite active fb:200
	staleSuspend := mustSeal(t, peerChan, map[string]any{
		"action": WebhookActionSuspend, "order_id": 100, "external_user_id": 502,
	})
	_, err := mod.Service.HandleWebhookEnvelope(ctx, staleSuspend)
	require.NoError(t, err)
	require.Equal(t, "fb:200", state.subs[502].OriginalTransactionID)

	// Act 2: matching suspend downgrades to FreePlan
	suspendEnv := mustSeal(t, peerChan, map[string]any{
		"action": WebhookActionSuspend, "order_id": 200, "external_user_id": 502,
	})
	_, err = mod.Service.HandleWebhookEnvelope(ctx, suspendEnv)
	require.NoError(t, err)
	require.Equal(t, ente.FreePlanProductID, state.subs[502].ProductID)
	require.Equal(t, int64(0), state.subs[502].Storage)
	require.Equal(t, int64(0), state.subs[502].ExpiryTime)
	require.Equal(t, ente.FreePlanTransactionID, state.subs[502].OriginalTransactionID)

	// Act 3: unsuspend restores paid quota and fb:<orderID>
	unsuspendEnv := mustSeal(t, peerChan, map[string]any{
		"action": WebhookActionUnsuspend, "order_id": 200, "client_id": 15, "external_user_id": 502,
		"plan_id": "50gb_monthly_v4", "storage_bytes": testQuota50GB, "expires_at_micro": int64(1950000000000000),
	})
	_, err = mod.Service.HandleWebhookEnvelope(ctx, unsuspendEnv)
	require.NoError(t, err)
	require.Equal(t, "fb:200", state.subs[502].OriginalTransactionID)
	require.Equal(t, testQuota50GB, state.subs[502].Storage)

	// Act 4: matching cancel downgrades to FreePlan
	cancelEnv := mustSeal(t, peerChan, map[string]any{
		"action": WebhookActionCancel, "order_id": 200, "external_user_id": 502,
	})
	respEnv, err := mod.Service.HandleWebhookEnvelope(ctx, cancelEnv)
	require.NoError(t, err)
	ack, err := peerChan.Open(respEnv)
	require.NoError(t, err)
	require.Equal(t, StatusDowngraded, ack["status"])
	require.Equal(t, ente.FreePlanProductID, state.subs[502].ProductID)
	require.Equal(t, ente.FreePlanTransactionID, state.subs[502].OriginalTransactionID)
}

func TestClaimPrePurchasedPlan_MatchedAndUnmatched_UpdatesOnlyWhenMatched(t *testing.T) {
	// Arrange
	matched := true
	srv := newMockFOSSBillingServer(testSecretKey, func(path string, req map[string]any) map[string]any {
		if !matched {
			return map[string]any{"matched": false}
		}
		return map[string]any{
			"matched": true, "order_id": 305, "client_id": 33,
			"plan_id": "50gb_monthly_v4", "storage_bytes": testQuota50GB, "expires_at_micro": int64(1950000000000000),
		}
	})
	defer srv.Close()

	state, mod, _ := newTestModule(t, srv.URL)
	seedFreeUser(t, state, 700)
	seedFreeUser(t, state, 701)

	// Act
	require.NoError(t, mod.Service.ClaimPrePurchasedPlan(context.Background(), 700, "user@example.com"))
	matched = false
	require.NoError(t, mod.Service.ClaimPrePurchasedPlan(context.Background(), 701, "user2@example.com"))

	// Assert
	require.Equal(t, "fb:305", state.subs[700].OriginalTransactionID)
	require.Equal(t, "fb:33", state.subs[700].Attributes.CustomerID)
	require.Equal(t, testQuota50GB, state.subs[700].Storage)
	require.Equal(t, ente.FreePlanProductID, state.subs[701].ProductID)
	require.Equal(t, ente.FreePlanTransactionID, state.subs[701].OriginalTransactionID)
}

func TestService_OnEmailChangedAndOnAccountDeleted_SendsEncryptedAccountEvent(t *testing.T) {
	// Arrange
	var events []map[string]any
	srv := newMockFOSSBillingServer(testSecretKey, func(path string, req map[string]any) map[string]any {
		require.Equal(t, EndpointAccountEvent, path)
		events = append(events, req)
		return map[string]any{"status": "ok"}
	})
	defer srv.Close()

	_, mod, _ := newTestModule(t, srv.URL)
	ctx := context.Background()

	// Act
	require.NoError(t, mod.Service.OnEmailChanged(ctx, 801, "  NewUser@Example.COM "))
	require.NoError(t, mod.Service.OnAccountDeleted(ctx, 801))

	// Assert
	require.Len(t, events, 2)
	require.Equal(t, AccountEventEmailChanged, events[0]["event"])
	require.Equal(t, "newuser@example.com", events[0]["email"])
	require.Equal(t, float64(801), events[0]["external_user_id"])
	require.Equal(t, AccountEventAccountDeleted, events[1]["event"])
	require.Equal(t, float64(801), events[1]["external_user_id"])
}

func TestBillingController_UpdateBillingEmail_SkipsStripeForFOSSBillingPrefix(t *testing.T) {
	// Arrange: StripeController is nil; calling Stripe would panic if not skipped
	state, userRepo, billingRepo := openTestRepos([]byte(testEncKey), []byte(testHashKey))
	require.NoError(t, state.seedUser(901, "fbuser@example.com", ente.Subscription{
		ID: 91, ProductID: "50gb_monthly_v4", PaymentProvider: ente.Stripe,
		OriginalTransactionID: "fb:444", Attributes: ente.SubscriptionAttributes{CustomerID: "fb:22"},
	}))
	billingCtrl := &controller.BillingController{
		BillingRepo: billingRepo, UserRepo: userRepo, StripeController: nil,
	}

	// Act
	err := billingCtrl.UpdateBillingEmail(901, "changed@example.com")

	// Assert
	require.NoError(t, err)
}

func TestBillingController_VerifySubscription_ReturnsFOSSBillingSubWithoutStripeCall(t *testing.T) {
	state, userRepo, billingRepo := openTestRepos([]byte(testEncKey), []byte(testHashKey))
	require.NoError(t, state.seedUser(902, "fbverify@example.com", ente.Subscription{
		ID: 92, ProductID: "20gb_monthly_v4", PaymentProvider: ente.Stripe,
		OriginalTransactionID: "fb:555", ExpiryTime: 1950000000000000,
	}))
	billingCtrl := &controller.BillingController{
		BillingRepo: billingRepo, UserRepo: userRepo, StripeController: nil,
	}

	sub, err := billingCtrl.VerifySubscription(902, ente.Stripe, "20gb_monthly_v4", "")
	require.NoError(t, err)
	require.Equal(t, "fb:555", sub.OriginalTransactionID)
	require.Equal(t, "20gb_monthly_v4", sub.ProductID)
}

func TestGetCustomerPortalURL_BuildsSealedSSOTokenURL(t *testing.T) {
	state, mod, peerChan := newTestModule(t, "https://billing.biyen.test")
	seedFreeUser(t, state, 777)

	portalURL, err := mod.Service.GetCustomerPortalURL(context.Background(), 777, "")
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(portalURL, "https://billing.biyen.test/servicesaas/portal?token="))

	parsed, err := url.Parse(portalURL)
	require.NoError(t, err)
	rawBytes, err := base64.RawURLEncoding.DecodeString(parsed.Query().Get("token"))
	require.NoError(t, err)
	var env Envelope
	require.NoError(t, json.Unmarshal(rawBytes, &env))
	claims, err := peerChan.Open(env)
	require.NoError(t, err)
	require.Equal(t, "777", claims["external_user_id"])
	require.Equal(t, "user@example.com", claims["email"])
}
