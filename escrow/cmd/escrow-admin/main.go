package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/ente/escrow/internal/envelope"
)

const (
	defaultEscrowServerURL = "http://127.0.0.1:8081"
	defaultCooldownHours   = 24
	filePermPublic         = 0o644
	filePermPrivate        = 0o600
)

var (
	ErrUnknownSubcommand      = errors.New("escrow-admin: unknown subcommand (expected keygen, list, approve, reject, audit-verify)")
	ErrDevicePublicKeySwapped = errors.New("escrow-admin: SECURITY ALERT - server device_public_key does not match request_code; aborting")
	ErrAccountNotManaged      = errors.New("escrow-admin: account is in zero_knowledge mode or has no escrow deposits")
	ErrNoValidCustodyDeposit  = errors.New("escrow-admin: none of the stored deposits matched decryption and SHA-512 commitment")
)

func main() {
	if err := runCLI(os.Args[1:], os.Stdout); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func runCLI(args []string, out io.Writer) error {
	if len(args) == 0 {
		return ErrUnknownSubcommand
	}
	subcmd := strings.TrimSpace(args[0])
	subArgs := args[1:]

	switch subcmd {
	case "keygen":
		return runKeygen(subArgs, out)
	case "list":
		return runList(subArgs, out)
	case "approve":
		return runApprove(subArgs, out)
	case "reject":
		return runReject(subArgs, out)
	case "audit-verify":
		return runAuditVerify(subArgs, out)
	default:
		return fmt.Errorf("%w: %s", ErrUnknownSubcommand, subcmd)
	}
}

func runKeygen(args []string, out io.Writer) error {
	fs := flag.NewFlagSet("keygen", flag.ContinueOnError)
	version := fs.String("version", "v1", "KEK version identifier (e.g. v1)")
	outDir := fs.String("out-dir", ".", "directory to write custody-<version>.pub, .key, and .shares.txt")
	passphrase := fs.String("passphrase", os.Getenv("ESCROW_CUSTODY_PASSPHRASE"), "passphrase for custody private key")
	if err := fs.Parse(args); err != nil {
		return err
	}
	passBytes := []byte(strings.TrimSpace(*passphrase))
	if len(passBytes) == 0 {
		return envelope.ErrEmptyPassphrase
	}

	seed, pubBytes, err := envelope.GenerateKeyPair()
	if err != nil {
		return err
	}
	defer envelope.Zeroize(seed[:])

	encryptedJSON, err := envelope.EncryptCustodySeed(seed, passBytes, *version)
	if err != nil {
		return err
	}
	shares, err := envelope.SplitSeed2Of3(seed)
	if err != nil {
		return err
	}

	pubPath := filepath.Join(*outDir, fmt.Sprintf("custody-%s.pub", *version))
	keyPath := filepath.Join(*outDir, fmt.Sprintf("custody-%s.key", *version))
	sharesPath := filepath.Join(*outDir, fmt.Sprintf("custody-%s.shares.txt", *version))

	if err := os.WriteFile(pubPath, pubBytes, filePermPublic); err != nil {
		return fmt.Errorf("write public key: %w", err)
	}
	if err := os.WriteFile(keyPath, encryptedJSON, filePermPrivate); err != nil {
		return fmt.Errorf("write encrypted custody key: %w", err)
	}

	var shareLines strings.Builder
	for _, sh := range shares {
		shareLines.WriteString(envelope.FormatShare(sh))
		shareLines.WriteByte('\n')
	}
	if err := os.WriteFile(sharesPath, []byte(shareLines.String()), filePermPrivate); err != nil {
		return fmt.Errorf("write shamir shares: %w", err)
	}

	fingerprint := envelope.PublicKeyFingerprint(pubBytes)
	_, _ = fmt.Fprintf(out, "Custody Key Version : %s\n", *version)
	_, _ = fmt.Fprintf(out, "Public Key File     : %s (%d bytes)\n", pubPath, len(pubBytes))
	_, _ = fmt.Fprintf(out, "Encrypted Key File  : %s\n", keyPath)
	_, _ = fmt.Fprintf(out, "Shamir 2-of-3 File  : %s\n", sharesPath)
	_, _ = fmt.Fprintf(out, "SHA-512 Fingerprint : %s\n", fingerprint)
	return nil
}
