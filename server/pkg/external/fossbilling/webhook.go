package fossbilling

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/ente/museum/ente"
	emailUtil "github.com/ente/museum/pkg/utils/email"
	timeUtil "github.com/ente/museum/pkg/utils/time"
	"github.com/ente/stacktrace"
)

type subscriptionGrant struct {
	UserID         int64
	OrderID        int64
	ClientID       int64
	PlanID         string
	StorageBytes   int64
	ExpiresAtMicro int64
}

// HandleWebhookEnvelope decrypts a FOSSBilling webhook envelope, applies the command,
// and returns a sealed response envelope.
func (s *Service) HandleWebhookEnvelope(ctx context.Context, env Envelope) (Envelope, error) {
	if !s.IsConfigured() {
		return Envelope{}, stacktrace.Propagate(ente.ErrNotImplemented, "FOSSBilling integration is not configured")
	}
	var cmd WebhookCommand
	if err := s.channel.OpenInto(env, &cmd); err != nil {
		return Envelope{}, stacktrace.Propagate(ente.ErrPermissionDenied, "invalid FOSSBilling webhook envelope: %v", err)
	}
	ack, err := s.processWebhookCommand(ctx, cmd)
	if err != nil {
		return Envelope{}, err
	}
	respEnv, err := s.channel.Seal(ack)
	if err != nil {
		return Envelope{}, stacktrace.Propagate(err, "failed to seal FOSSBilling webhook response")
	}
	return respEnv, nil
}

func (s *Service) processWebhookCommand(ctx context.Context, cmd WebhookCommand) (map[string]any, error) {
	switch strings.ToLower(strings.TrimSpace(cmd.Action)) {
	case WebhookActionActivate, WebhookActionRenew, WebhookActionUnsuspend:
		return s.provisionFromWebhook(ctx, cmd)
	case WebhookActionSuspend, WebhookActionCancel:
		return s.downgradeFromWebhook(ctx, cmd)
	default:
		return nil, stacktrace.Propagate(ente.ErrBadRequest, "unsupported FOSSBilling webhook action: %s", cmd.Action)
	}
}

func (s *Service) provisionFromWebhook(_ context.Context, cmd WebhookCommand) (map[string]any, error) {
	userID, found, err := s.resolveUserID(int64(cmd.ExternalUserID), cmd.Email)
	if err != nil {
		return nil, err
	}
	if !found {
		return map[string]any{
			"status":   StatusPendingRegistration,
			"order_id": int64(cmd.OrderID),
		}, nil
	}
	grant := subscriptionGrant{
		UserID:         userID,
		OrderID:        int64(cmd.OrderID),
		ClientID:       int64(cmd.ClientID),
		PlanID:         strings.TrimSpace(cmd.PlanID),
		StorageBytes:   cmd.EffectiveStorageBytes(),
		ExpiresAtMicro: int64(cmd.ExpiresAtMicro),
	}
	if err := s.applySubscription(grant); err != nil {
		return nil, err
	}
	return map[string]any{
		"status":           StatusProvisioned,
		"order_id":         int64(cmd.OrderID),
		"external_user_id": userID,
	}, nil
}

func (s *Service) downgradeFromWebhook(_ context.Context, cmd WebhookCommand) (map[string]any, error) {
	userID, found, err := s.resolveUserID(int64(cmd.ExternalUserID), cmd.Email)
	if err != nil {
		return nil, err
	}
	if !found {
		return map[string]any{
			"status":   StatusDowngraded,
			"order_id": int64(cmd.OrderID),
		}, nil
	}
	if err := s.downgradeUserToFree(userID, int64(cmd.OrderID)); err != nil {
		return nil, err
	}
	return map[string]any{
		"status":           StatusDowngraded,
		"order_id":         int64(cmd.OrderID),
		"external_user_id": userID,
	}, nil
}

func (s *Service) applySubscription(grant subscriptionGrant) error {
	if grant.OrderID <= 0 || grant.PlanID == "" {
		return stacktrace.Propagate(ente.ErrBadRequest, "missing order_id or plan_id for provisioning")
	}
	currentSub, err := s.billingRepo.GetUserSubscription(grant.UserID)
	if err != nil {
		return stacktrace.Propagate(err, "")
	}
	txnID := formatTransactionID(grant.OrderID)
	if err := s.ensureTransactionAvailable(grant.UserID, txnID); err != nil {
		return err
	}
	newSub := ente.Subscription{
		UserID:                grant.UserID,
		ProductID:             grant.PlanID,
		Storage:               s.resolveStorageBytes(grant.PlanID, grant.StorageBytes),
		OriginalTransactionID: txnID,
		ExpiryTime:            grant.ExpiresAtMicro,
		UpgradedAt:            timeUtil.Microseconds(),
		PaymentProvider:       ente.Stripe,
		Attributes: ente.SubscriptionAttributes{
			CustomerID:           formatCustomerID(grant.ClientID),
			StripeAccountCountry: ente.DefaultStripeAccountCountry,
		},
	}
	if err := s.billingRepo.ReplaceSubscription(currentSub.ID, newSub); err != nil {
		return stacktrace.Propagate(err, "")
	}
	if currentSub.ProductID == ente.FreePlanProductID {
		s.notifyUpgrade(grant.UserID, grant.PlanID)
	}
	return nil
}

func (s *Service) downgradeUserToFree(userID, orderID int64) error {
	currentSub, err := s.billingRepo.GetUserSubscription(userID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return stacktrace.Propagate(err, "")
	}
	if shouldSkipDowngrade(currentSub, orderID) {
		return nil
	}
	freeSub := ente.Subscription{
		UserID:                userID,
		ProductID:             ente.FreePlanProductID,
		Storage:               ente.FreePlanStorage,
		OriginalTransactionID: ente.FreePlanTransactionID,
		ExpiryTime:            0,
		PaymentProvider:       "",
		Attributes:            ente.SubscriptionAttributes{},
	}
	return stacktrace.Propagate(s.billingRepo.ReplaceSubscription(currentSub.ID, freeSub), "")
}

func (s *Service) resolveUserID(externalUserID int64, rawEmail string) (int64, bool, error) {
	if externalUserID > 0 {
		user, err := s.userRepo.Get(externalUserID)
		if err == nil {
			return user.ID, true, nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return 0, false, stacktrace.Propagate(err, "")
		}
	}
	normalized := emailUtil.NormalizeEmail(rawEmail)
	if normalized == "" {
		return 0, false, nil
	}
	userID, err := s.userRepo.GetUserIDWithEmailUnrestricted(normalized)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, stacktrace.Propagate(err, "")
	}
	return userID, true, nil
}

func (s *Service) ensureTransactionAvailable(userID int64, txnID string) error {
	existingSub, err := s.billingRepo.GetSubscriptionForTransaction(txnID, ente.Stripe)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return stacktrace.Propagate(err, "")
	}
	if existingSub.UserID != userID {
		return stacktrace.Propagate(&ente.ErrSubscriptionAlreadyClaimed, "transaction %s belongs to user %d", txnID, existingSub.UserID)
	}
	return nil
}

func (s *Service) resolveStorageBytes(planID string, providedBytes int64) int64 {
	if providedBytes > 0 {
		return providedBytes
	}
	if s.billingCtrl == nil {
		return 0
	}
	for _, countryPlans := range s.billingCtrl.BillingPlansPerAccount {
		if storage := findPlanStorage(countryPlans, planID); storage > 0 {
			return storage
		}
	}
	return 0
}

func (s *Service) notifyUpgrade(userID int64, planID string) {
	if s.discordCtrl != nil {
		discordCtrl := s.discordCtrl
		go discordCtrl.NotifyNewSub(userID, "fossbilling", planID)
	}
	if s.emailCtrl != nil {
		emailCtrl := s.emailCtrl
		go emailCtrl.OnAccountUpgrade(userID)
	}
}

func findPlanStorage(countryPlans ente.BillingPlansPerCountry, planID string) int64 {
	for _, plans := range countryPlans {
		for _, plan := range plans {
			if plan.ID == planID || plan.StripeID == planID {
				return plan.Storage
			}
		}
	}
	return 0
}

func shouldSkipDowngrade(currentSub ente.Subscription, orderID int64) bool {
	if currentSub.ProductID == ente.FreePlanProductID {
		return true
	}
	if !isFOSSBillingSubscription(currentSub) {
		return true
	}
	if orderID <= 0 {
		return false
	}
	return currentSub.OriginalTransactionID != formatTransactionID(orderID)
}

func isFOSSBillingSubscription(sub ente.Subscription) bool {
	return strings.HasPrefix(sub.OriginalTransactionID, TransactionPrefix) ||
		strings.HasPrefix(sub.Attributes.CustomerID, TransactionPrefix)
}

func formatTransactionID(orderID int64) string {
	return TransactionPrefix + strconv.FormatInt(orderID, 10)
}

func formatCustomerID(clientID int64) string {
	return fmt.Sprintf("%s%d", TransactionPrefix, clientID)
}
