package envelope

import (
	"crypto/sha512"
	"crypto/subtle"
	"errors"
	"fmt"
)

const AuditDomainPrefix = "biyen-escrow-v1/audit|"

var (
	ErrAuditChainLengthMismatch = errors.New("envelope: audit entries and hashes length mismatch")
	ErrAuditGenesisPrevHash     = errors.New("envelope: first audit entry must have zero prev_hash")
	ErrAuditBrokenPrevHashLink  = errors.New("envelope: audit prev_hash does not match previous entry_hash")
	ErrAuditTamperedEntryHash   = errors.New("envelope: audit entry_hash does not match entry content")
)

type AuditChainInput struct {
	ID                int64
	UserID            int64
	ActorType         string
	ActorID           string
	Action            string
	SupportRef        string
	CreatedAtUnixNano int64
	PrevHash          [CommitmentBytes]byte
}

func ComputeAuditEntryHash(input AuditChainInput) [CommitmentBytes]byte {
	hasher := sha512.New()
	_, _ = hasher.Write(input.PrevHash[:])
	payload := fmt.Appendf(
		nil,
		"%s%d|%d|%s|%s|%s|%s|%d",
		AuditDomainPrefix,
		input.ID,
		input.UserID,
		input.ActorType,
		input.ActorID,
		input.Action,
		input.SupportRef,
		input.CreatedAtUnixNano,
	)
	_, _ = hasher.Write(payload)
	var out [CommitmentBytes]byte
	copy(out[:], hasher.Sum(nil))
	return out
}

func VerifyAuditHashChain(entries []AuditChainInput, hashes [][CommitmentBytes]byte) error {
	if len(entries) != len(hashes) {
		return ErrAuditChainLengthMismatch
	}
	var expectedPrev [CommitmentBytes]byte
	for idx, entry := range entries {
		if idx == 0 {
			var zeroHash [CommitmentBytes]byte
			if subtle.ConstantTimeCompare(entry.PrevHash[:], zeroHash[:]) != 1 {
				return ErrAuditGenesisPrevHash
			}
		} else if subtle.ConstantTimeCompare(entry.PrevHash[:], expectedPrev[:]) != 1 {
			return fmt.Errorf("%w at index %d (id=%d)", ErrAuditBrokenPrevHashLink, idx, entry.ID)
		}

		computed := ComputeAuditEntryHash(entry)
		if subtle.ConstantTimeCompare(computed[:], hashes[idx][:]) != 1 {
			return fmt.Errorf("%w at index %d (id=%d)", ErrAuditTamperedEntryHash, idx, entry.ID)
		}
		expectedPrev = hashes[idx]
	}
	return nil
}
