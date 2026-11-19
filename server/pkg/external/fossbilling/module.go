package fossbilling

import (
	"strings"

	"github.com/ente/museum/pkg/controller"
	"github.com/ente/museum/pkg/controller/discord"
	"github.com/ente/museum/pkg/controller/email"
	"github.com/ente/museum/pkg/repo"
	"github.com/ente/stacktrace"
	"github.com/gin-gonic/gin"
	"github.com/spf13/viper"
)

const (
	DefaultPortalPath = "/order/service"

	RouteCheckoutSession = "/billing/fossbilling/checkout-session"
	RouteWebhook         = "/billing/notify/fossbilling"
	RouteCustomerPortal  = "/billing/fossbilling/customer-portal"
)

// ModuleDeps holds Museum repositories and controllers wired into the FOSSBilling module.
type ModuleDeps struct {
	UserRepo    *repo.UserRepository
	BillingRepo *repo.BillingRepository
	BillingCtrl *controller.BillingController
	EmailCtrl   *email.EmailNotificationController
	DiscordCtrl *discord.DiscordController
}

// ModuleConfig holds configuration values for the FOSSBilling integration.
type ModuleConfig struct {
	BaseURL         string
	AppID           string
	SharedSecret    string
	PortalURL       string
	MaxDriftSeconds int64
}

// Module bundles the FOSSBilling Channel, Client, Service, and HTTP Handler.
type Module struct {
	Service *Service
	Handler *Handler
	Channel *Channel
	Client  *Client
}

// NewModuleFromViper reads FOSSBilling configuration from Viper and constructs a Module.
func NewModuleFromViper(deps ModuleDeps) (*Module, error) {
	cfg := ModuleConfig{
		BaseURL:         viper.GetString("fossbilling.base-url"),
		AppID:           viper.GetString("fossbilling.app-id"),
		SharedSecret:    viper.GetString("fossbilling.shared-secret"),
		PortalURL:       viper.GetString("fossbilling.portal-url"),
		MaxDriftSeconds: viper.GetInt64("fossbilling.max-drift-seconds"),
	}
	return NewModule(deps, cfg)
}

// NewModule constructs a FOSSBilling Module from explicit dependencies and configuration.
func NewModule(deps ModuleDeps, cfg ModuleConfig) (*Module, error) {
	secret := strings.TrimSpace(cfg.SharedSecret)
	baseURL := strings.TrimSpace(cfg.BaseURL)
	if secret == "" {
		service := NewService(ServiceConfig{
			UserRepo:    deps.UserRepo,
			BillingRepo: deps.BillingRepo,
			BillingCtrl: deps.BillingCtrl,
			EmailCtrl:   deps.EmailCtrl,
			DiscordCtrl: deps.DiscordCtrl,
		})
		return &Module{
			Service: service,
			Handler: &Handler{Service: service},
		}, nil
	}

	channel, err := NewChannel(cfg.AppID, secret)
	if err != nil {
		return nil, stacktrace.Propagate(err, "failed to initialize FOSSBilling channel")
	}
	if cfg.MaxDriftSeconds > 0 {
		channel.MaxDriftSeconds = cfg.MaxDriftSeconds
	}

	var client *Client
	if baseURL != "" {
		client = NewClient(baseURL, channel)
	}
	service := NewService(ServiceConfig{
		UserRepo:    deps.UserRepo,
		BillingRepo: deps.BillingRepo,
		BillingCtrl: deps.BillingCtrl,
		EmailCtrl:   deps.EmailCtrl,
		DiscordCtrl: deps.DiscordCtrl,
		Client:      client,
		Channel:     channel,
		PortalURL:   resolvePortalURL(cfg.PortalURL, baseURL),
	})
	return &Module{
		Service: service,
		Handler: &Handler{Service: service},
		Channel: channel,
		Client:  client,
	}, nil
}

// IsConfigured reports whether the module has an active encrypted channel.
func (m *Module) IsConfigured() bool {
	return m != nil && m.Service != nil && m.Service.IsConfigured()
}

// RegisterRoutes mounts FOSSBilling checkout, webhook, and customer portal routes.
func (m *Module) RegisterRoutes(publicAPI, privateAPI, paymentJwtAuthAPI gin.IRoutes) {
	if m == nil || m.Handler == nil {
		return
	}
	paymentJwtAuthAPI.POST(RouteCheckoutSession, m.Handler.CreateCheckoutSession)
	publicAPI.POST(RouteWebhook, m.Handler.HandleWebhook)
	privateAPI.GET(RouteCustomerPortal, m.Handler.CustomerPortal)
}

func resolvePortalURL(portalURL, baseURL string) string {
	if trimmed := strings.TrimSpace(portalURL); trimmed != "" {
		return trimmed
	}
	if trimmedBase := strings.TrimRight(strings.TrimSpace(baseURL), "/"); trimmedBase != "" {
		return trimmedBase + DefaultPortalPath
	}
	return ""
}
