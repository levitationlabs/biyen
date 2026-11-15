// Biyen Web — Post-Quantum Escrow Client Deterministic Vector & Lifecycle Tests
// Copyright 2026 Levitation — AGPL-3.0-or-later

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const kvMemory = new Map<string, unknown>();
const localStore = new Map<string, string>();

vi.mock("ente-base/kv", () => ({
    getKV: vi.fn(async (key: string) => kvMemory.get(key) ?? null),
    setKV: vi.fn(async (key: string, val: unknown) => {
        kvMemory.set(key, val);
    }),
    removeKV: vi.fn(async (key: string) => {
        kvMemory.delete(key);
    }),
}));

vi.mock("ente-base/origins", () => ({
    apiOrigin: vi.fn(async () => "https://api.biyen.local"),
}));

vi.mock("ente-base/token", () => ({
    savedAuthToken: vi.fn(async () => "web-user-auth-token-1001"),
}));

import {
    biyenEscrowClient,
    clearStoredRecoveryRequest,
    computeRecoveryKeyCommitment,
    computeRequestCode,
    loadStoredRecoveryRequest,
} from "../../../../../packages/accounts/components/biyen/biyenEscrowClient";

const DETERMINISTIC_USER_ID = 1001;
const DETERMINISTIC_KEY_REPEAT_COUNT = 32;
const DETERMINISTIC_RECOVERY_KEY = "B".repeat(DETERMINISTIC_KEY_REPEAT_COUNT);
const DETERMINISTIC_REQUEST_ID = "550e8400-e29b-41d4-a716-446655440000";
const EXPECTED_COMMITMENT_HEX =
    "e246ec8d33414238c657066a04eb06ed9d5f9e03c63445ee31bf398d5f393fd252f32cf2ec04e1cf6ce2f778b9033ca8f2227ab3d341eaee5d194bcc5512f12f";
const EXPECTED_REQUEST_CODE = "TUU2H-5AQV7-ASMSS-AD747";
const EXPECTED_CIPHER_SUITE = "biyen-escrow-v1:hpke-xwing-hkdfsha256-chacha20poly1305";
const HTTP_STATUS_OK = 200;

const DETERMINISTIC_XWING_PUBKEY_B64 = [
    "b1QJigoOZBFGYUtpYLpg2GA9YvRH+atJm0e9aQbMQLBh2GNKPoiQbyhJWOdEHKbHJcu5cJW3ZxpGK2aB",
    "yeZYC7yNYLFJ+mAmEEOvu6UvIFpgKDhIUVlq3zcavqmNM0c4PSu2c0OPZ4NhK/hwFPe5Gol0AmU0XfZ5",
    "NARz0cTBdohuXim48Fi7fHNTFmhs/1w764wmHLAJcKacGvzFS5TLhuHOY7pjbjlcpFEB4hx70EwxPqGa",
    "8kFB79KtREFqJbpPZZEO99iAnDCT8EqvAOPNluNcSqPIAsGK1vOdpLS42YyL15Atg6B7pFOWZ0pgJDyr",
    "k+gP2bHId3N2qcwNb6EV4mOTgLnGvnhIvRNYjGRwOgU10ZoPgWM6l2oKEFtm7ihdD9JV6CwDMZJfQ4O2",
    "78dh72CZI1oLmHJjWKqdAbi4llGfkhR0u3wUuyIlK1wvENQSRsmyPnZEhJNn9UGhX2O8koo5u3vHPwe2",
    "ZcSWu2VYyPRUiacuxLrNNOnFlMM4cbcj8DSV6ItDkasm5DBD3rYRezkZ5FxMGxarKOR93XI2Y4VHZhkv",
    "wYBspwq7eGy9swky5oyKNwvPsHmDoBLDJmuT76YmV/S4ODdMsLuV4OwGVBsHZdmc8VO8a5YTXKeApVs2",
    "R3ieMZFeRig8+ce7boRT+2aCEFFB8dwNANhe7XA7bGyWH3nIRSdrQkiUnAZ4LlE+spkbldlgQuOMvto1",
    "JEmytQhOvaUiamIGQAeJEwowlkSYSLYp/upKLCp0PEoN3Jyz89Z2/FY3MbJsShpm3IRZFwBW1XaX8UQ7",
    "gamjRBK7e/BfMydXWlkR3TAdYFOGfzwwgHEfG/EVh7C7KYQnayaF53ViEOSz+JVThCMeVYxvUQyR4PxW",
    "tdGIX/KUnpWka8G+4fpx9QJ+EMRDsOkdD9dED0Z6JyISEuiPXGumQpbK4NIHv8YPiMfPtcRaoYOdGMs3",
    "xFhD5UJqSpDIArZCj5U8NZxKwGA0UvrAtzYeL9NdzIhakhRdT8oBWPG31wtLzRGOSipBVEON8xDESpob",
    "mepBWQcmeoiwYkJBV5wXIvRu1hwuPspUXJlwUXF1OZuADbJdo5WT0GSQ1xQsAOiNLbBH6YmL23rLftkH",
    "9uMEFswN5UokLAohJjAvXVTIW8Zqwvg8eXlFtQZ8qkK9LgwZypdQblB6sKXJ9WM3CEmcGfJK7FE705A6",
    "XXO27EmR98cuuZHBw3iJgFyx6jigzAIXayfFjWOM5aMmaEV8+bm+AnygIUBXlxcl1UEC6JlnFusq2CNF",
    "O2BbhVNwsbIbOTLN7UFgqplzx+uuWsR2TZTPfMlQbwd7rXMBLbtKyBQKOHRkEuszyVFFliBfcHY1hiIX",
    "2bYJGMYmjZNEkVuEeiR2waJw8VSlyEI0FlrPyGk5hwLOqemgfnsOmeqb3LeEH+nA+iXIM4CSVho+3dxw",
    "AfR4rWV4GmAkqtFl2baXmtrESKRGL1ZGhVJ/diQ0/ppCWoRDe0VzkuyoDJE1BhUeOhMjnzQvynZVtuqu",
    "hFoiHOs+Z/VjnGGT9v3u9X45m4CLfzqitXQKre2QFj3F13XJ+vfx+9B12rNE6dfRRmRygfu6ezxWyv1Y",
    "M7epMOxCBufDptd2T+gdeg==",
].join("");

function decodeBase64Bytes(b64: string): Uint8Array {
    return new Uint8Array(Buffer.from(b64, "base64"));
}

function encodeHexString(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString("hex");
}

function createJsonResponse(payload: unknown): Response {
    return new Response(JSON.stringify(payload), {
        status: HTTP_STATUS_OK,
        headers: { "Content-Type": "application/json" },
    });
}

beforeAll(() => {
    const localStorageMock = {
        getItem: (key: string) => localStore.get(key) ?? null,
        setItem: (key: string, val: string) => {
            localStore.set(key, String(val));
        },
        removeItem: (key: string) => {
            localStore.delete(key);
        },
        clear: () => {
            localStore.clear();
        },
    };
    Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });
    Object.defineProperty(globalThis, "window", {
        value: { localStorage: localStorageMock },
        writable: true,
    });
});

describe("biyenEscrowClient cryptographic vectors & Web recovery flow", () => {
    const originalFetch = globalThis.fetch;

    beforeEach(async () => {
        kvMemory.clear();
        localStore.clear();
        await clearStoredRecoveryRequest();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it("matches Go and Rust deterministic SHA-512 commitment and Base32 request_code vectors", async () => {
        const commitment = await computeRecoveryKeyCommitment(
            DETERMINISTIC_USER_ID,
            DETERMINISTIC_RECOVERY_KEY,
        );
        expect(commitment).toBe(EXPECTED_COMMITMENT_HEX);

        const otherUserCommitment = await computeRecoveryKeyCommitment(
            DETERMINISTIC_USER_ID + 1,
            DETERMINISTIC_RECOVERY_KEY,
        );
        expect(otherUserCommitment).not.toBe(EXPECTED_COMMITMENT_HEX);

        const pubKeyBytes = decodeBase64Bytes(DETERMINISTIC_XWING_PUBKEY_B64);
        const codeFromBytes = await computeRequestCode(DETERMINISTIC_REQUEST_ID, pubKeyBytes);
        expect(codeFromBytes).toBe(EXPECTED_REQUEST_CODE);

        const codeFromHex = await computeRequestCode(
            DETERMINISTIC_REQUEST_ID,
            encodeHexString(pubKeyBytes),
        );
        expect(codeFromHex).toBe(EXPECTED_REQUEST_CODE);

        const differentCode = await computeRequestCode(
            "550e8400-e29b-41d4-a716-446655440001",
            pubKeyBytes,
        );
        expect(differentCode).not.toBe(EXPECTED_REQUEST_CODE);
    });

    it("deposits recovery key in managed mode and supports zero-knowledge schedule/cancel", async () => {
        const recordedRequests: Array<{ url: string; method: string; body: Record<string, unknown> | null }> = [];
        let activeMode: "managed" | "zero_knowledge" = "managed";
        let scheduledDelete: string | null = null;

        globalThis.fetch = vi.fn().mockImplementation(async (input, init) => {
            const url = String(input);
            const method = init?.method ?? "GET";
            const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
            recordedRequests.push({ url, method, body });

            if (url.endsWith("/escrow/v1/public-key")) {
                return createJsonResponse({
                    kek_version: "v1",
                    cipher_suite: EXPECTED_CIPHER_SUITE,
                    public_key: DETERMINISTIC_XWING_PUBKEY_B64,
                });
            }
            if (url.endsWith("/escrow/v1/zero-knowledge") && method === "POST") {
                activeMode = "zero_knowledge";
                scheduledDelete = "2026-11-22T16:00:00Z";
                return createJsonResponse({ ok: true });
            }
            if (url.endsWith("/escrow/v1/zero-knowledge/cancel") && method === "POST") {
                activeMode = "managed";
                scheduledDelete = null;
                return createJsonResponse({ ok: true });
            }
            return createJsonResponse({
                mode: activeMode,
                kek_version: "v1",
                cipher_suite: EXPECTED_CIPHER_SUITE,
                recovery_key_commitment: EXPECTED_COMMITMENT_HEX,
                delete_scheduled_at: scheduledDelete,
            });
        });

        const depositStatus = await biyenEscrowClient.depositRecoveryKey({
            userId: DETERMINISTIC_USER_ID,
            recoveryKey: DETERMINISTIC_RECOVERY_KEY,
        });
        expect(depositStatus.mode).toBe("managed");
        expect(depositStatus.kek_version).toBe("v1");
        expect(depositStatus.cipher_suite).toBe(EXPECTED_CIPHER_SUITE);
        expect(depositStatus.recovery_key_commitment).toBe(EXPECTED_COMMITMENT_HEX);

        const putCall = recordedRequests.find((req) => req.method === "PUT");
        expect(putCall?.url).toContain("/escrow/v1/deposit");
        expect(putCall?.body?.recovery_key_commitment).toBe(EXPECTED_COMMITMENT_HEX);

        const zkStatus = await biyenEscrowClient.scheduleZeroKnowledge();
        expect(zkStatus.mode).toBe("zero_knowledge");
        expect(zkStatus.delete_scheduled_at).toBe("2026-11-22T16:00:00Z");

        const restoredStatus = await biyenEscrowClient.cancelZeroKnowledge();
        expect(restoredStatus.mode).toBe("managed");
        expect(restoredStatus.delete_scheduled_at).toBeNull();
    });

    it("creates recovery request, persists state, and polls until approved", async () => {
        let approvalReady = false;
        let capturedPollSecretHeader = "";

        globalThis.fetch = vi.fn().mockImplementation(async (input, init) => {
            const url = String(input);
            const method = init?.method ?? "GET";
            if (url.endsWith("/escrow/v1/recovery-requests") && method === "POST") {
                return createJsonResponse({
                    request_id: DETERMINISTIC_REQUEST_ID,
                    expires_at: new Date(Date.now() + 3600000).toISOString(),
                });
            }
            if (url.includes(`/escrow/v1/recovery-requests/${DETERMINISTIC_REQUEST_ID}`)) {
                const headers = (init?.headers ?? {}) as Record<string, string>;
                capturedPollSecretHeader = headers["X-Poll-Secret"] ?? "";
                if (!approvalReady) {
                    return createJsonResponse({
                        status: "pending",
                        release_after: "2026-11-16T00:00:00Z",
                    });
                }
                return createJsonResponse({
                    status: "approved",
                    recovery_key: DETERMINISTIC_RECOVERY_KEY,
                });
            }
            return createJsonResponse({});
        });

        const state = await biyenEscrowClient.getOrCreateRecoveryRequest({
            claimedEmail: "huda@biyen.local",
        });
        expect(state.requestId).toBe(DETERMINISTIC_REQUEST_ID);
        expect(state.requestCode).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}$/);

        const cached = await biyenEscrowClient.getOrCreateRecoveryRequest({
            claimedEmail: "huda@biyen.local",
        });
        expect(cached.requestCode).toBe(state.requestCode);

        const pendingPoll = await biyenEscrowClient.pollRecoveryRequest(state);
        expect(pendingPoll.status).toBe("pending");
        expect(capturedPollSecretHeader).toBe(state.pollSecretHex);
        expect(await loadStoredRecoveryRequest()).not.toBeNull();

        approvalReady = true;
        const approvedPoll = await biyenEscrowClient.pollRecoveryRequest(state);
        expect(approvedPoll.status).toBe("approved");
        expect(approvedPoll.recoveredKey).toBe(DETERMINISTIC_RECOVERY_KEY);
        expect(await loadStoredRecoveryRequest()).toBeNull();
    });
});
