package main

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/ente/escrow/internal/api"
	"github.com/ente/escrow/internal/envelope"
	"github.com/ente/escrow/internal/museum"
	"github.com/ente/escrow/internal/store"
	"gopkg.in/yaml.v3"
)

const (
	defaultListenAddr = "127.0.0.1:8081"
	defaultMuseumURL  = "http://127.0.0.1:8080"
	defaultKEKVersion = "v1"
	shutdownTimeout   = 10 * time.Second
)

type Config struct {
	HTTP struct {
		Addr string `yaml:"addr"`
	} `yaml:"http"`
	DB struct {
		DSN string `yaml:"dsn"`
	} `yaml:"db"`
	Museum struct {
		InternalURL string `yaml:"internal_url"`
	} `yaml:"museum"`
	Custody struct {
		PublicKeyFile string `yaml:"public_key_file"`
		KEKVersion    string `yaml:"kek_version"`
	} `yaml:"custody"`
}

func main() {
	if err := run(os.Args[1:]); err != nil {
		log.Fatalf("escrow error: %v", err)
	}
}

func run(args []string) error {
	fs := flag.NewFlagSet("escrow", flag.ContinueOnError)
	configPath := fs.String("config", envOrDefault("ESCROW_CONFIG", "./escrow.yaml"), "path to escrow.yaml")
	addrFlag := fs.String("addr", "", "override HTTP listen address")
	dsnFlag := fs.String("dsn", "", "override database DSN (or 'memory')")
	museumFlag := fs.String("museum-url", "", "override museum internal URL")
	pubKeyFlag := fs.String("public-key", "", "override custody public key file")
	kekVerFlag := fs.String("kek-version", "", "override custody KEK version")
	if err := fs.Parse(args); err != nil {
		return err
	}

	cfg := loadConfig(*configPath)
	applyOverrides(&cfg, *addrFlag, *dsnFlag)
	applyServiceOverrides(&cfg, *museumFlag, *pubKeyFlag, *kekVerFlag)

	pubKeyBytes, err := loadCustodyPublicKey(cfg.Custody.PublicKeyFile)
	if err != nil {
		return err
	}

	dataStore, closeFn, err := initStore(cfg.DB.DSN)
	if err != nil {
		return err
	}
	defer closeFn()

	srv := api.NewServer(api.ServerConfig{
		Store:            dataStore,
		Museum:           museum.NewHTTPClient(cfg.Museum.InternalURL),
		CustodyPublicKey: pubKeyBytes,
		KEKVersion:       cfg.Custody.KEKVersion,
	})

	httpServer := &http.Server{
		Addr:              cfg.HTTP.Addr,
		Handler:           srv,
		ReadHeaderTimeout: shutdownTimeout,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
	go func() {
		log.Printf("Biyen Escrow listening on http://%s (kek=%s, fingerprint=%s...)",
			cfg.HTTP.Addr, cfg.Custody.KEKVersion, envelope.PublicKeyFingerprint(pubKeyBytes)[:16])
		if serveErr := httpServer.ListenAndServe(); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			errCh <- serveErr
		}
		close(errCh)
	}()

	select {
	case serveErr := <-errCh:
		return serveErr
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		return httpServer.Shutdown(shutdownCtx)
	}
}

func loadConfig(path string) Config {
	var cfg Config
	cfg.HTTP.Addr = defaultListenAddr
	cfg.Museum.InternalURL = defaultMuseumURL
	cfg.Custody.PublicKeyFile = "./custody-v1.pub"
	cfg.Custody.KEKVersion = defaultKEKVersion

	raw, err := os.ReadFile(path)
	if err == nil {
		_ = yaml.Unmarshal(raw, &cfg)
	}
	return cfg
}

func applyOverrides(cfg *Config, addrFlag string, dsnFlag string) {
	if envAddr := os.Getenv("ESCROW_HTTP_ADDR"); envAddr != "" {
		cfg.HTTP.Addr = envAddr
	}
	if addrFlag != "" {
		cfg.HTTP.Addr = addrFlag
	}
	if envDSN := os.Getenv("ESCROW_DB_DSN"); envDSN != "" {
		cfg.DB.DSN = envDSN
	}
	if dsnFlag != "" {
		cfg.DB.DSN = dsnFlag
	}
}

func applyServiceOverrides(cfg *Config, museumFlag string, pubKeyFlag string, kekVerFlag string) {
	if envMuseum := os.Getenv("ESCROW_MUSEUM_URL"); envMuseum != "" {
		cfg.Museum.InternalURL = envMuseum
	}
	if museumFlag != "" {
		cfg.Museum.InternalURL = museumFlag
	}
	if envPub := os.Getenv("ESCROW_PUBLIC_KEY_FILE"); envPub != "" {
		cfg.Custody.PublicKeyFile = envPub
	}
	if pubKeyFlag != "" {
		cfg.Custody.PublicKeyFile = pubKeyFlag
	}
	if envVer := os.Getenv("ESCROW_KEK_VERSION"); envVer != "" {
		cfg.Custody.KEKVersion = envVer
	}
	if kekVerFlag != "" {
		cfg.Custody.KEKVersion = kekVerFlag
	}
}

func loadCustodyPublicKey(path string) ([]byte, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read custody public key %s: %w", path, err)
	}
	if len(raw) == envelope.PublicKeyBytes {
		return raw, nil
	}
	trimmed := strings.TrimSpace(string(raw))
	if decodedHex, err := hex.DecodeString(trimmed); err == nil && len(decodedHex) == envelope.PublicKeyBytes {
		return decodedHex, nil
	}
	if decodedB64, err := base64.StdEncoding.DecodeString(trimmed); err == nil && len(decodedB64) == envelope.PublicKeyBytes {
		return decodedB64, nil
	}
	return nil, fmt.Errorf("custody public key %s has invalid length %d (expected %d bytes)", path, len(raw), envelope.PublicKeyBytes)
}

func initStore(dsn string) (store.Store, func(), error) {
	trimmed := strings.TrimSpace(dsn)
	if trimmed == "" || trimmed == "memory" {
		return store.NewMemoryStore(), func() {}, nil
	}
	migrationSQL := loadMigrationSQL()
	pgStore, err := store.NewPostgresStore(trimmed, migrationSQL)
	if err != nil {
		return nil, func() {}, err
	}
	return pgStore, func() { _ = pgStore.Close() }, nil
}

func loadMigrationSQL() string {
	candidates := []string{
		"migrations/001_init.sql",
		filepath.Join("..", "..", "migrations", "001_init.sql"),
	}
	for _, p := range candidates {
		if raw, err := os.ReadFile(p); err == nil {
			return string(raw)
		}
	}
	return ""
}

func envOrDefault(key string, fallback string) string {
	if val := strings.TrimSpace(os.Getenv(key)); val != "" {
		return val
	}
	return fallback
}
