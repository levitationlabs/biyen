package fossbilling

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/url"
	"strconv"
	"strings"

	"github.com/ente/museum/ente"
	"github.com/ente/museum/pkg/controller"
	"github.com/ente/museum/pkg/controller/discord"
	"github.com/ente/museum/pkg/controller/email"
	"github.com/ente/museum/pkg/repo"
	"github.com/ente/museum/pkg/utils/billing"
	emailUtil "github.com/ente/museum/pkg/utils/email"
	"github.com/ente/stacktrace"
)

// ServiceConfig holds dependencies for constructing a FOSSBilling Service.
type ServiceConfig struct {
	UserRepo    *repo.UserRepository
	BillingRepo *repo.BillingRepository
	BillingCtrl *controller.BillingController
	EmailCtrl   *email.EmailNotificationController
	DiscordCtrl *discord.DiscordController
	Client      *Client
	Channel     *Channel
	PortalURL   string
}

// Service implements FOSSBilling checkout, webhook provisioning, and lifecycle sync.
type Service struct {
	userRepo    *repo.UserRepository
	billingRepo *repo.BillingRepository
	billingCtrl *controller.BillingController
	emailCtrl   *email.EmailNotificationController
	discordCtrl *discord.DiscordController
	client      *Client
	channel     *Channel
	portalURL   string
}

// NewService creates a new FOSSBilling Service from the given configuration.
func NewService(cfg ServiceConfig) *Service {
	return &Service{
		userRepo:    cfg.UserRepo,
		billingRepo: cfg.BillingRepo,
		billingCtrl: cfg.BillingCtrl,
		emailCtrl:   cfg.EmailCtrl,
		discordCtrl: cfg.DiscordCtrl,
		client:      cfg.Client,
		channel:     cfg.Channel,
		portalURL:   strings.TrimSpace(cfg.PortalURL),
	}
}

// IsConfigured reports whether the encrypted FOSSBilling channel is initialized.
func (s *Service) IsConfigured() bool {
	return s != nil && s.channel != nil
}

// CreateCheckoutSession validates the user state and requests a FOSSBilling checkout URL.
func (s *Service) CreateCheckoutSession(ctx context.Context, params CreateCheckoutParams) (CheckoutSessionResult, error) {
	if !s.client.IsConfigured() {
		return CheckoutSessionResult{}, stacktrace.Propagate(ente.ErrNotImplemented, "FOSSBilling client is not configured")
	}
	if err := validateCheckoutParams(params); err != nil {
		return CheckoutSessionResult{}, err
	}
	user, err := s.userRepo.Get(params.UserID)
	if err != nil {
		return CheckoutSessionResult{}, stacktrace.Propagate(err, "")
	}
	if err := s.ensureCheckoutAllowed(params.UserID, params.ProductID, params.Action); err != nil {
		return CheckoutSessionResult{}, err
	}
	return s.client.CreateCheckoutSession(ctx, CheckoutSessionRequest{
		ExternalUserID: FlexInt64(params.UserID),
		Email:          emailUtil.NormalizeEmail(user.Email),
		PlanID:         strings.TrimSpace(params.ProductID),
		Action:         strings.ToLower(strings.TrimSpace(params.Action)),
		RedirectURL:    strings.TrimSpace(params.RedirectURL),
	})
}

// ClaimPrePurchasedPlan checks FOSSBilling for a pre-purchased subscription matching the newly signed-up email.
func (s *Service) ClaimPrePurchasedPlan(ctx context.Context, userID int64, userEmail string) error {
	if !s.client.IsConfigured() {
		return nil
	}
	result, err := s.client.ClaimEntitlement(ctx, ClaimEntitlementRequest{
		ExternalUserID: FlexInt64(userID),
		Email:          emailUtil.NormalizeEmail(userEmail),
	})
	if err != nil {
		return err
	}
	if !result.Matched {
		return nil
	}
	return s.applySubscription(subscriptionGrant{
		UserID:         userID,
		OrderID:        int64(result.OrderID),
		ClientID:       int64(result.ClientID),
		PlanID:         strings.TrimSpace(result.PlanID),
		StorageBytes:   result.EffectiveStorageBytes(),
		ExpiresAtMicro: int64(result.ExpiresAtMicro),
	})
}

// OnEmailChanged notifies FOSSBilling when a user updates their account email.
func (s *Service) OnEmailChanged(ctx context.Context, userID int64, newEmail string) error {
	if !s.client.IsConfigured() {
		return nil
	}
	return s.client.SendAccountEvent(ctx, AccountEventRequest{
		Event:          AccountEventEmailChanged,
		ExternalUserID: FlexInt64(userID),
		Email:          emailUtil.NormalizeEmail(newEmail),
	})
}

// OnAccountDeleted notifies FOSSBilling when a user deletes their account.
func (s *Service) OnAccountDeleted(ctx context.Context, userID int64) error {
	if !s.client.IsConfigured() {
		return nil
	}
	return s.client.SendAccountEvent(ctx, AccountEventRequest{
		Event:          AccountEventAccountDeleted,
		ExternalUserID: FlexInt64(userID),
	})
}

// GetCustomerPortalURL returns a short-lived SSO URL to the FOSSBilling order portal when configured,
// falling back to the static portal URL.
func (s *Service) GetCustomerPortalURL(_ context.Context, userID int64, _ string) (string, error) {
	if !s.IsConfigured() {
		return "", stacktrace.Propagate(ente.ErrNotImplemented, "FOSSBilling customer portal is not configured")
	}
	if s.client != nil && s.client.IsConfigured() && userID > 0 && s.userRepo != nil {
		if user, err := s.userRepo.Get(userID); err == nil {
			if ssoURL, ssoErr := s.buildPortalSSOURL(userID, user.Email); ssoErr == nil {
				return ssoURL, nil
			}
		}
	}
	if s.portalURL == "" {
		return "", stacktrace.Propagate(ente.ErrNotImplemented, "FOSSBilling customer portal is not configured")
	}
	return s.portalURL, nil
}

func (s *Service) buildPortalSSOURL(userID int64, userEmail string) (string, error) {
	env, err := s.channel.Seal(map[string]any{
		"external_user_id": strconv.FormatInt(userID, 10),
		"email":            emailUtil.NormalizeEmail(userEmail),
	})
	if err != nil {
		return "", err
	}
	rawJSON, err := json.Marshal(env)
	if err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(rawJSON)
	return strings.TrimRight(s.client.BaseURL, "/") + "/servicesaas/portal?token=" + url.QueryEscape(token), nil
}

func (s *Service) ensureCheckoutAllowed(userID int64, targetPlanID string, action string) error {
	currentSub, err := s.billingRepo.GetUserSubscription(userID)
	if err != nil {
		return stacktrace.Propagate(err, "")
	}
	if billing.IsActivePaidPlan(currentSub) && !isFOSSBillingSubscription(currentSub) && !currentSub.Attributes.IsCancelled {
		return stacktrace.Propagate(ente.ErrCannotSwitchPaymentProvider, "")
	}
	if strings.EqualFold(strings.TrimSpace(action), ActionUpdate) && s.billingCtrl != nil && s.billingCtrl.CommonBillCtrl != nil {
		targetStorage := s.resolveStorageBytes(strings.TrimSpace(targetPlanID), 0)
		if targetStorage > 0 && targetStorage < currentSub.Storage {
			canDowngrade, checkErr := s.billingCtrl.CommonBillCtrl.CanDowngradeToGivenStorage(targetStorage, userID)
			if checkErr != nil {
				return stacktrace.Propagate(checkErr, "")
			}
			if !canDowngrade {
				return stacktrace.Propagate(ente.ErrCannotDowngrade, "")
			}
		}
	}
	return nil
}

func validateCheckoutParams(params CreateCheckoutParams) error {
	if params.UserID <= 0 {
		return stacktrace.Propagate(ente.ErrAuthenticationRequired, "")
	}
	if strings.TrimSpace(params.ProductID) == "" || strings.TrimSpace(params.RedirectURL) == "" {
		return stacktrace.Propagate(ente.ErrBadRequest, "productID and redirectURL are required")
	}
	action := strings.ToLower(strings.TrimSpace(params.Action))
	if action != ActionBuy && action != ActionUpdate {
		return stacktrace.Propagate(ente.ErrBadRequest, "unsupported checkout action: %s", params.Action)
	}
	return nil
}
