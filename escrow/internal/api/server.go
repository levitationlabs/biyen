package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/ente/escrow/internal/envelope"
	"github.com/ente/escrow/internal/museum"
	"github.com/ente/escrow/internal/store"
)

const (
	defaultKEKVersion  = "v1"
	founderAlertEmail  = "founder@biyen.id"
	maxRequestBodySize = 64 * 1024
)

type ServerConfig struct {
	Store            store.Store
	Museum           museum.Client
	CustodyPublicKey []byte
	KEKVersion       string
	FounderEmail     string
	RateLimiter      *RateLimiter
}

type Server struct {
	store            store.Store
	museum           museum.Client
	custodyPublicKey []byte
	kekVersion       string
	founderEmail     string
	rateLimiter      *RateLimiter
	mux              *http.ServeMux
}

func NewServer(cfg ServerConfig) *Server {
	kekVer := strings.TrimSpace(cfg.KEKVersion)
	if kekVer == "" {
		kekVer = defaultKEKVersion
	}
	founder := strings.TrimSpace(cfg.FounderEmail)
	if founder == "" {
		founder = founderAlertEmail
	}
	rl := cfg.RateLimiter
	if rl == nil {
		rl = NewRateLimiter(defaultRateLimitWindow, defaultRateLimitMaxReqs)
	}
	s := &Server{
		store:            cfg.Store,
		museum:           cfg.Museum,
		custodyPublicKey: append([]byte(nil), cfg.CustodyPublicKey...),
		kekVersion:       kekVer,
		founderEmail:     founder,
		rateLimiter:      rl,
		mux:              http.NewServeMux(),
	}
	s.registerRoutes()
	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	setCORSHeaders(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodySize)
	s.mux.ServeHTTP(w, r)
}

func (s *Server) registerRoutes() {
	s.mux.HandleFunc("GET /escrow/v1/public-key", s.handleGetPublicKey)
	s.mux.HandleFunc("PUT /escrow/v1/deposit", s.handlePutDeposit)
	s.mux.HandleFunc("POST /escrow/v1/deposit", s.handlePutDeposit)
	s.mux.HandleFunc("GET /escrow/v1/status", s.handleGetStatus)
	s.mux.HandleFunc("POST /escrow/v1/zero-knowledge", s.handleScheduleZeroKnowledge)
	s.mux.HandleFunc("POST /escrow/v1/zero-knowledge/cancel", s.handleCancelZeroKnowledge)
	s.mux.HandleFunc("POST /escrow/v1/recovery-requests", s.handleCreateRecoveryRequest)
	s.mux.HandleFunc("GET /escrow/v1/recovery-requests/{id}", s.handlePollRecoveryRequest)

	s.mux.HandleFunc("GET /escrow/v1/admin/recovery-requests/{code}", s.handleAdminGetRecoveryRequest)
	s.mux.HandleFunc("GET /escrow/v1/admin/users/{id}/deposits", s.handleAdminGetUserDeposits)
	s.mux.HandleFunc("POST /escrow/v1/admin/recovery-requests/{id}/approve", s.handleAdminApproveRecoveryRequest)
	s.mux.HandleFunc("POST /escrow/v1/admin/recovery-requests/{id}/reject", s.handleAdminRejectRecoveryRequest)
	s.mux.HandleFunc("GET /escrow/v1/admin/audit", s.handleAdminGetAuditLog)
}

func (s *Server) authenticateUser(r *http.Request) (museum.UserDetails, error) {
	token := extractAuthHeader(r)
	if token == "" {
		return museum.UserDetails{}, museum.ErrUnauthorized
	}
	return s.museum.ValidateUserToken(r.Context(), token)
}

func (s *Server) authenticateAdmin(r *http.Request) (museum.AdminPrincipal, string, error) {
	token := extractAuthHeader(r)
	if token == "" {
		return museum.AdminPrincipal{}, "", museum.ErrUnauthorized
	}
	principal, err := s.museum.ValidateAdminToken(r.Context(), token)
	return principal, token, err
}

func extractAuthHeader(r *http.Request) string {
	if tok := strings.TrimSpace(r.Header.Get("X-Auth-Token")); tok != "" {
		return tok
	}
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
		return strings.TrimSpace(auth[7:])
	}
	return auth
}

func setCORSHeaders(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin == "" {
		origin = "*"
	}
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Auth-Token, Authorization, X-Poll-Secret")
	w.Header().Set("Access-Control-Max-Age", "86400")
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func isValidXWingPublicKey(pubKey []byte) bool {
	if len(pubKey) != envelope.PublicKeyBytes {
		return false
	}
	_, err := envelope.SealDevice(pubKey, "key-validation-check", []byte("ok"))
	return err == nil
}
