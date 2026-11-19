package fossbilling

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/ente/museum/ente"
	"github.com/ente/museum/pkg/utils/auth"
	"github.com/ente/museum/pkg/utils/handler"
	"github.com/ente/stacktrace"
	"github.com/gin-gonic/gin"
)

type createCheckoutRequest struct {
	ProductID   string `json:"productID"`
	Action      string `json:"action"`
	RedirectURL string `json:"redirectURL"`
}

// Handler exposes HTTP endpoints for FOSSBilling checkout, webhook notifications, and portal access.
type Handler struct {
	Service *Service
}

// CreateCheckoutSession initiates a FOSSBilling checkout session for an authenticated user.
func (h *Handler) CreateCheckoutSession(c *gin.Context) {
	if !h.ensureConfigured(c) {
		return
	}
	var req createCheckoutRequest
	if err := handler.BindJSON(c, &req); err != nil {
		handler.Error(c, stacktrace.Propagate(err, ""))
		return
	}
	if !isValidRedirectURL(req.RedirectURL) {
		handler.Error(c, stacktrace.Propagate(ente.ErrBadRequest, "invalid redirectURL"))
		return
	}
	action := strings.TrimSpace(req.Action)
	if action == "" {
		action = ActionBuy
	}
	result, err := h.Service.CreateCheckoutSession(c.Request.Context(), CreateCheckoutParams{
		UserID:      auth.GetUserID(c.Request.Header),
		ProductID:   req.ProductID,
		Action:      action,
		RedirectURL: req.RedirectURL,
	})
	if err != nil {
		handler.Error(c, stacktrace.Propagate(err, ""))
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"checkoutURL": result.CheckoutURL,
		"orderID":     int64(result.OrderID),
		"invoiceHash": result.InvoiceHash,
	})
}

// HandleWebhook receives encrypted provisioning notifications from FOSSBilling.
func (h *Handler) HandleWebhook(c *gin.Context) {
	if !h.ensureConfigured(c) {
		return
	}
	var env Envelope
	if err := handler.BindJSON(c, &env); err != nil {
		handler.Error(c, stacktrace.Propagate(err, ""))
		return
	}
	respEnv, err := h.Service.HandleWebhookEnvelope(c.Request.Context(), env)
	if err != nil {
		handler.Error(c, stacktrace.Propagate(err, ""))
		return
	}
	c.JSON(http.StatusOK, respEnv)
}

// CustomerPortal returns the FOSSBilling customer portal URL for managing subscriptions.
func (h *Handler) CustomerPortal(c *gin.Context) {
	if !h.ensureConfigured(c) {
		return
	}
	userID := auth.GetUserID(c.Request.Header)
	portalURL, err := h.Service.GetCustomerPortalURL(c.Request.Context(), userID, c.Query("redirectURL"))
	if err != nil {
		handler.Error(c, stacktrace.Propagate(err, ""))
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": portalURL})
}

func (h *Handler) ensureConfigured(c *gin.Context) bool {
	if h == nil || h.Service == nil || !h.Service.IsConfigured() {
		handler.Error(c, stacktrace.Propagate(ente.ErrNotImplemented, "FOSSBilling integration is not configured"))
		return false
	}
	return true
}

func isValidRedirectURL(raw string) bool {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return false
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Scheme == "" {
		return false
	}
	switch strings.ToLower(parsed.Scheme) {
	case "http", "https", "biyen", "ente":
		return parsed.Host != ""
	default:
		return false
	}
}
