package envelope

import (
	"bytes"
	"encoding/hex"
	"testing"
)

func TestSealAndOpen_ReturnsOriginalRecoveryKey_WhenContextMatches(t *testing.T) {
	seed, pubKey, err := GenerateKeyPair()
	if err != nil {
		t.Fatalf("GenerateKeyPair failed: %v", err)
	}
	recoveryKey := bytes.Repeat([]byte{0xab}, 32)
	ctx := CustodyContext{UserID: 4242, KEKVersion: "v1"}

	custodyBlob, err := SealCustody(pubKey, ctx, recoveryKey)
	if err != nil {
		t.Fatalf("SealCustody failed: %v", err)
	}
	if len(custodyBlob) != len(recoveryKey)+HPKEOverheadBytes {
		t.Fatalf("unexpected custodyBlob length: got %d, want %d", len(custodyBlob), len(recoveryKey)+HPKEOverheadBytes)
	}

	opened, err := OpenCustody(seed, ctx, custodyBlob)
	if err != nil {
		t.Fatalf("OpenCustody failed: %v", err)
	}
	if !bytes.Equal(opened, recoveryKey) {
		t.Fatalf("decrypted recoveryKey mismatch: got %x, want %x", opened, recoveryKey)
	}
}

func TestOpen_Fails_WhenUserIDOrVersionInInfoDiffers(t *testing.T) {
	seed, pubKey, err := GenerateKeyPair()
	if err != nil {
		t.Fatalf("GenerateKeyPair failed: %v", err)
	}
	recoveryKey := bytes.Repeat([]byte{0xcd}, 32)
	ctx := CustodyContext{UserID: 1001, KEKVersion: "v1"}

	custodyBlob, err := SealCustody(pubKey, ctx, recoveryKey)
	if err != nil {
		t.Fatalf("SealCustody failed: %v", err)
	}

	wrongUserCtx := CustodyContext{UserID: 1002, KEKVersion: "v1"}
	if _, err := OpenCustody(seed, wrongUserCtx, custodyBlob); err == nil {
		t.Fatal("expected OpenCustody to fail when UserID differs")
	}

	wrongVersionCtx := CustodyContext{UserID: 1001, KEKVersion: "v2"}
	if _, err := OpenCustody(seed, wrongVersionCtx, custodyBlob); err == nil {
		t.Fatal("expected OpenCustody to fail when KEKVersion differs")
	}
}

func TestVerifyCommitment_Matches_WhenUserIDAndRecoveryKeyMatch(t *testing.T) {
	recoveryKey := bytes.Repeat([]byte{0x42}, 32)
	commitment := ComputeCommitment(1001, recoveryKey)

	if !VerifyCommitment(1001, recoveryKey, commitment) {
		t.Fatal("expected VerifyCommitment to succeed for matching userID and recoveryKey")
	}
	if VerifyCommitment(1002, recoveryKey, commitment) {
		t.Fatal("expected VerifyCommitment to fail for mismatched userID")
	}
	otherKey := bytes.Repeat([]byte{0x43}, 32)
	if VerifyCommitment(1001, otherKey, commitment) {
		t.Fatal("expected VerifyCommitment to fail for mismatched recoveryKey")
	}
}

func TestComputeRequestCode_MatchesRustVector_Deterministic(t *testing.T) {
	var seed [SecretKeySeedBytes]byte
	for i := range seed {
		seed[i] = byte(i)
	}
	pubKey, err := DerivePublicKey(seed)
	if err != nil {
		t.Fatalf("DerivePublicKey failed: %v", err)
	}

	recoveryKey := bytes.Repeat([]byte{0x42}, 32)
	commitment := ComputeCommitment(1001, recoveryKey)
	wantCommitHex := "e246ec8d33414238c657066a04eb06ed9d5f9e03c63445ee31bf398d5f393fd252f32cf2ec04e1cf6ce2f778b9033ca8f2227ab3d341eaee5d194bcc5512f12f"
	if got := hex.EncodeToString(commitment[:]); got != wantCommitHex {
		t.Fatalf("commitment mismatch with Rust vector:\ngot:  %s\nwant: %s", got, wantCommitHex)
	}

	fingerprint := PublicKeyFingerprint(pubKey)
	wantFingerprint := "6ba5ba0db298b98ec2498a2e21ddfc79e7e29cb82f87a11f5bc300a3807c09bff43d429275e43e13be54e5c1d736df6b11a6c36f918ed23bf2537a693c1ed75c"
	if fingerprint != wantFingerprint {
		t.Fatalf("fingerprint mismatch with Rust vector:\ngot:  %s\nwant: %s", fingerprint, wantFingerprint)
	}

	requestID := "550e8400-e29b-41d4-a716-446655440000"
	code := ComputeRequestCode(requestID, pubKey)
	wantCode := "TUU2H-5AQV7-ASMSS-AD747"
	if code != wantCode {
		t.Fatalf("request code mismatch with Rust vector: got %s, want %s", code, wantCode)
	}
}

func TestShamirSplitAndCombine_RecoversSeed_WithAny2Of3Shares(t *testing.T) {
	seed, _, err := GenerateKeyPair()
	if err != nil {
		t.Fatalf("GenerateKeyPair failed: %v", err)
	}
	shares, err := SplitSeed2Of3(seed)
	if err != nil {
		t.Fatalf("SplitSeed2Of3 failed: %v", err)
	}

	pairs := [][2]int{{0, 1}, {0, 2}, {1, 2}, {2, 0}}
	for _, pair := range pairs {
		encodedA := FormatShare(shares[pair[0]])
		encodedB := FormatShare(shares[pair[1]])
		parsedA, err := ParseShare(encodedA)
		if err != nil {
			t.Fatalf("ParseShare A failed: %v", err)
		}
		parsedB, err := ParseShare(encodedB)
		if err != nil {
			t.Fatalf("ParseShare B failed: %v", err)
		}
		recovered, err := CombineSeed2Of3(parsedA, parsedB)
		if err != nil {
			t.Fatalf("CombineSeed2Of3(%d,%d) failed: %v", pair[0], pair[1], err)
		}
		if recovered != seed {
			t.Fatalf("recovered seed mismatch for pair (%d,%d)", pair[0], pair[1])
		}
	}

	if _, err := CombineSeed2Of3(shares[0], shares[0]); err == nil {
		t.Fatal("expected error when combining identical share index")
	}
}

func TestAuditHashChain_DetectsTamperedOrDeletedEntry(t *testing.T) {
	var zeroHash [CommitmentBytes]byte
	entry1 := AuditChainInput{
		ID:                1,
		UserID:            1001,
		ActorType:         "user",
		ActorID:           "1001",
		Action:            "deposit_created",
		SupportRef:        "",
		CreatedAtUnixNano: 1700000000000000000,
		PrevHash:          zeroHash,
	}
	hash1 := ComputeAuditEntryHash(entry1)

	entry2 := AuditChainInput{
		ID:                2,
		UserID:            1001,
		ActorType:         "admin",
		ActorID:           "admin-1",
		Action:            "recovery_approved",
		SupportRef:        "SUP-2026-001",
		CreatedAtUnixNano: 1700000100000000000,
		PrevHash:          hash1,
	}
	hash2 := ComputeAuditEntryHash(entry2)

	entries := []AuditChainInput{entry1, entry2}
	hashes := [][CommitmentBytes]byte{hash1, hash2}
	if err := VerifyAuditHashChain(entries, hashes); err != nil {
		t.Fatalf("expected valid chain, got error: %v", err)
	}

	tampered := []AuditChainInput{entry1, entry2}
	tampered[1].SupportRef = "SUP-FORGED"
	if err := VerifyAuditHashChain(tampered, hashes); err == nil {
		t.Fatal("expected VerifyAuditHashChain to fail when entry content is tampered")
	}

	deletedFirst := []AuditChainInput{entry2}
	deletedHashes := [][CommitmentBytes]byte{hash2}
	if err := VerifyAuditHashChain(deletedFirst, deletedHashes); err == nil {
		t.Fatal("expected VerifyAuditHashChain to fail when genesis entry is deleted")
	}
}

func TestEncryptAndDecryptCustodySeed_RoundTripsWithArgon2id128MB(t *testing.T) {
	seed, _, err := GenerateKeyPair()
	if err != nil {
		t.Fatalf("GenerateKeyPair failed: %v", err)
	}
	passphrase := []byte("correct-horse-battery-staple-pq")

	encryptedJSON, err := EncryptCustodySeed(seed, passphrase, "v1")
	if err != nil {
		t.Fatalf("EncryptCustodySeed failed: %v", err)
	}

	recovered, version, err := DecryptCustodySeed(encryptedJSON, passphrase)
	if err != nil {
		t.Fatalf("DecryptCustodySeed failed: %v", err)
	}
	if recovered != seed || version != "v1" {
		t.Fatalf("decrypted seed or version mismatch: version=%s", version)
	}

	if _, _, err := DecryptCustodySeed(encryptedJSON, []byte("wrong-passphrase")); err == nil {
		t.Fatal("expected error with wrong passphrase")
	}
}
