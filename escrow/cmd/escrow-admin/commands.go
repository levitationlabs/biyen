package main

import (
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/ente/escrow/internal/envelope"
	"github.com/ente/escrow/internal/store"
)

type rewrapParams struct {
	Seed            [envelope.SecretKeySeedBytes]byte
	UserID          int64
	Deposits        []store.Deposit
	RecoveryRequest store.RecoveryRequest
}

func runList(args []string, out io.Writer) error {
	fs := flag.NewFlagSet("list", flag.ContinueOnError)
	code := fs.String("code", "", "20-character recovery request code")
	userID := fs.Int64("user-id", 0, "optional user ID to inspect deposits")
	serverURL := fs.String("server", envOrFallback("ESCROW_SERVER_URL", defaultEscrowServerURL), "escrow server URL")
	adminToken := fs.String("admin-token", os.Getenv("ESCROW_ADMIN_TOKEN"), "admin sudo token")
	if err := fs.Parse(args); err != nil {
		return err
	}
	client := newAdminClient(*serverURL, *adminToken)

	if strings.TrimSpace(*code) != "" {
		reqData, err := client.fetchRecoveryRequest(*code)
		if err != nil {
			return err
		}
		formatted, _ := json.MarshalIndent(reqData, "", "  ")
		_, _ = fmt.Fprintln(out, string(formatted))
	}
	if *userID > 0 {
		depData, err := client.fetchUserDeposits(*userID)
		if err != nil {
			return err
		}
		formatted, _ := json.MarshalIndent(depData, "", "  ")
		_, _ = fmt.Fprintln(out, string(formatted))
	}
	return nil
}

func runApprove(args []string, out io.Writer) error {
	fs := flag.NewFlagSet("approve", flag.ContinueOnError)
	code := fs.String("code", "", "20-character recovery request code from user")
	userID := fs.Int64("user-id", 0, "verified user ID")
	supportRef := fs.String("support-ref", "", "support ticket reference")
	keyFile := fs.String("key-file", "./custody-v1.key", "path to encrypted custody key file")
	passphrase := fs.String("passphrase", os.Getenv("ESCROW_CUSTODY_PASSPHRASE"), "passphrase for custody key file")
	cooldownHours := fs.Int("cooldown-hours", defaultCooldownHours, "cooldown hours before user can download")
	serverURL := fs.String("server", envOrFallback("ESCROW_SERVER_URL", defaultEscrowServerURL), "escrow server URL")
	adminToken := fs.String("admin-token", os.Getenv("ESCROW_ADMIN_TOKEN"), "admin sudo token")
	if err := fs.Parse(args); err != nil {
		return err
	}

	normCode := store.NormalizeRequestCode(*code)
	if normCode == "" || *userID <= 0 || strings.TrimSpace(*supportRef) == "" {
		return fmt.Errorf("escrow-admin approve requires --code, --user-id, and --support-ref")
	}

	client := newAdminClient(*serverURL, *adminToken)
	recReq, err := client.fetchRecoveryRequest(normCode)
	if err != nil {
		return err
	}

	computedCode := envelope.ComputeRequestCode(recReq.RequestID, recReq.DevicePublicKey)
	if computedCode != normCode {
		return fmt.Errorf("%w: got %s from server key, expected %s", ErrDevicePublicKeySwapped, computedCode, normCode)
	}

	userDeps, err := client.fetchUserDeposits(*userID)
	if err != nil {
		return err
	}
	if userDeps.Mode != store.ModeManaged || len(userDeps.Deposits) == 0 {
		return ErrAccountNotManaged
	}

	encryptedKeyJSON, err := os.ReadFile(*keyFile)
	if err != nil {
		return fmt.Errorf("read custody key file: %w", err)
	}
	seed, _, err := envelope.DecryptCustodySeed(encryptedKeyJSON, []byte(strings.TrimSpace(*passphrase)))
	if err != nil {
		return err
	}
	defer envelope.Zeroize(seed[:])

	deviceBlob, err := rewrapLatestValidDeposit(rewrapParams{
		Seed:            seed,
		UserID:          *userID,
		Deposits:        userDeps.Deposits,
		RecoveryRequest: recReq,
	})
	if err != nil {
		return err
	}

	approved, err := client.postApprove(recReq.RequestID, map[string]any{
		"linked_user_id": *userID,
		"support_ref":    strings.TrimSpace(*supportRef),
		"device_blob":    deviceBlob,
		"cooldown_hours": *cooldownHours,
	})
	if err != nil {
		return err
	}
	_, _ = fmt.Fprintf(out, "Approved recovery request %s (code %s) for user %d\n", approved.RequestID, normCode, *userID)
	return nil
}

func rewrapLatestValidDeposit(params rewrapParams) ([]byte, error) {
	for _, dep := range params.Deposits {
		var expectedCommit [envelope.CommitmentBytes]byte
		copy(expectedCommit[:], dep.CommitmentBytes)

		ctx := envelope.CustodyContext{UserID: params.UserID, KEKVersion: dep.KEKVersion}
		recoveryKey, err := envelope.OpenCustody(params.Seed, ctx, dep.CustodyBlob)
		if err != nil {
			continue
		}
		if !envelope.VerifyCommitment(params.UserID, recoveryKey, expectedCommit) {
			envelope.Zeroize(recoveryKey)
			continue
		}
		deviceBlob, sealErr := envelope.SealDevice(
			params.RecoveryRequest.DevicePublicKey,
			params.RecoveryRequest.RequestID,
			recoveryKey,
		)
		envelope.Zeroize(recoveryKey)
		if sealErr != nil {
			return nil, sealErr
		}
		return deviceBlob, nil
	}
	return nil, ErrNoValidCustodyDeposit
}

func runReject(args []string, out io.Writer) error {
	fs := flag.NewFlagSet("reject", flag.ContinueOnError)
	code := fs.String("code", "", "20-character recovery request code")
	supportRef := fs.String("support-ref", "rejected-by-admin", "support ticket reference")
	serverURL := fs.String("server", envOrFallback("ESCROW_SERVER_URL", defaultEscrowServerURL), "escrow server URL")
	adminToken := fs.String("admin-token", os.Getenv("ESCROW_ADMIN_TOKEN"), "admin sudo token")
	if err := fs.Parse(args); err != nil {
		return err
	}
	client := newAdminClient(*serverURL, *adminToken)
	recReq, err := client.fetchRecoveryRequest(store.NormalizeRequestCode(*code))
	if err != nil {
		return err
	}
	if err := client.postReject(recReq.RequestID, *supportRef); err != nil {
		return err
	}
	_, _ = fmt.Fprintf(out, "Rejected recovery request %s\n", recReq.RequestID)
	return nil
}

func runAuditVerify(args []string, out io.Writer) error {
	fs := flag.NewFlagSet("audit-verify", flag.ContinueOnError)
	serverURL := fs.String("server", envOrFallback("ESCROW_SERVER_URL", defaultEscrowServerURL), "escrow server URL")
	adminToken := fs.String("admin-token", os.Getenv("ESCROW_ADMIN_TOKEN"), "admin sudo token")
	if err := fs.Parse(args); err != nil {
		return err
	}
	client := newAdminClient(*serverURL, *adminToken)
	entries, err := client.fetchAuditLog()
	if err != nil {
		return err
	}
	inputs := make([]envelope.AuditChainInput, len(entries))
	hashes := make([][envelope.CommitmentBytes]byte, len(entries))
	for i, e := range entries {
		var prev, curr [envelope.CommitmentBytes]byte
		if rawPrev, err := hex.DecodeString(e.PrevHex); err == nil {
			copy(prev[:], rawPrev)
		}
		if rawCurr, err := hex.DecodeString(e.EntryHex); err == nil {
			copy(curr[:], rawCurr)
		}
		inputs[i] = envelope.AuditChainInput{
			ID:                e.ID,
			UserID:            e.UserID,
			ActorType:         e.ActorType,
			ActorID:           e.ActorID,
			Action:            e.Action,
			SupportRef:        e.SupportRef,
			CreatedAtUnixNano: e.CreatedAt.UnixNano(),
			PrevHash:          prev,
		}
		hashes[i] = curr
	}
	if err := envelope.VerifyAuditHashChain(inputs, hashes); err != nil {
		return err
	}
	_, _ = fmt.Fprintf(out, "Audit log verified: %d entries intact\n", len(entries))
	return nil
}
