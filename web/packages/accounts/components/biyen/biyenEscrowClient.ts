// Biyen Photos — Post-Quantum Escrow Client & WebCrypto / IndexedDB Helper
// Copyright 2026 Levitation — AGPL-3.0-or-later

import { getKV, removeKV, setKV } from "ente-base/kv";
import { apiOrigin } from "ente-base/origins";
import { savedAuthToken } from "ente-base/token";

export type BiyenEscrowMode = "managed" | "zero_knowledge";

export interface EscrowPublicKeyResponse {
    kek_version: string;
    cipher_suite: string;
    public_key: string;
}

export interface EscrowStatusResponse {
    mode: BiyenEscrowMode;
    kek_version: string;
    cipher_suite: string;
    recovery_key_commitment: string | null;
    delete_scheduled_at: string | null;
    service_available: boolean;
}

export interface EscrowDepositOptions {
    recoveryKey: string;
    userId?: number | string;
}

export interface CreateRecoveryRequestOptions {
    claimedEmail?: string;
}

export interface StoredRecoveryRequestState {
    requestId: string;
    requestCode: string;
    pollSecretHex: string;
    devicePublicKeyHex: string;
    deviceSecretHex: string;
    claimedEmail: string;
    createdAt: number;
    expiresAt: number;
}

export interface PollRecoveryResult {
    status: "pending" | "approved" | "consumed" | "expired" | "rejected";
    recoveredKey?: string;
    releaseAfter?: string | null;
    message?: string;
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BITS_PER_BYTE = 8;
const BITS_PER_BASE32_CHAR = 5;
const BASE32_BIT_MASK = 0x1f;
const REQUEST_CODE_RAW_LENGTH = 20;
const REQUEST_CODE_GROUP_SIZE = 5;
const RECOVERY_REQUEST_TTL_HOURS = 72;
const MILLISECONDS_PER_HOUR = 3600000;
export const RECOVERY_REQUEST_TTL_MS = RECOVERY_REQUEST_TTL_HOURS * MILLISECONDS_PER_HOUR;

const POLL_SECRET_BYTE_LENGTH = 32;
const DEVICE_SECRET_BYTE_LENGTH = 32;
const XWING_PUBLIC_KEY_BYTE_LENGTH = 1216;
const DEFAULT_KEK_VERSION = "v1";
const DEFAULT_CIPHER_SUITE = "biyen-escrow-v1:hpke-xwing-hkdfsha256-chacha20poly1305";
const KV_ACTIVE_RECOVERY_KEY = "biyen_escrow_active_recovery_request";
const LOCAL_STORAGE_MODE_KEY = "biyen_escrow_protection_mode";

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
    const clean = hex.trim().replace(/^0x/i, "");
    if (clean.length === 0 || clean.length % 2 !== 0) return new Uint8Array(0);
    const output = new Uint8Array(clean.length / 2);
    for (let idx = 0; idx < clean.length; idx += 2) {
        output[idx / 2] = Number.parseInt(clean.slice(idx, idx + 2), 16);
    }
    return output;
}

function encodeBase32Prefix(bytes: Uint8Array, charCount: number): string {
    let buffer = 0;
    let bitsLeft = 0;
    let output = "";
    for (const byte of bytes) {
        buffer = (buffer << BITS_PER_BYTE) | byte;
        bitsLeft += BITS_PER_BYTE;
        while (bitsLeft >= BITS_PER_BASE32_CHAR && output.length < charCount) {
            bitsLeft -= BITS_PER_BASE32_CHAR;
            output += BASE32_ALPHABET[(buffer >>> bitsLeft) & BASE32_BIT_MASK];
        }
        if (output.length >= charCount) break;
    }
    return output;
}

function formatGroupedCode(rawCode: string): string {
    const groups: string[] = [];
    for (let idx = 0; idx < rawCode.length; idx += REQUEST_CODE_GROUP_SIZE) {
        groups.push(rawCode.slice(idx, idx + REQUEST_CODE_GROUP_SIZE));
    }
    return groups.join("-");
}

async function sha512Bytes(inputBytes: Uint8Array): Promise<Uint8Array> {
    const buf = inputBytes.buffer.slice(inputBytes.byteOffset, inputBytes.byteOffset + inputBytes.byteLength) as ArrayBuffer;
    return new Uint8Array(await crypto.subtle.digest("SHA-512", buf));
}

function normalizeDeviceKeyBytes(devicePublicKey: Uint8Array | string): Uint8Array {
    if (devicePublicKey instanceof Uint8Array) return devicePublicKey;
    const fromHex = hexToBytes(devicePublicKey);
    if (fromHex.length > 0 && /^[0-9a-fA-F]+$/.test(devicePublicKey.trim())) return fromHex;
    return new TextEncoder().encode(devicePublicKey);
}

export async function computeRequestCode(requestId: string, devicePublicKey: Uint8Array | string): Promise<string> {
    const prefix = new TextEncoder().encode(`biyen-escrow-v1/request|${requestId}|`);
    const keyBytes = normalizeDeviceKeyBytes(devicePublicKey);
    const combined = new Uint8Array(prefix.length + keyBytes.length);
    combined.set(prefix, 0);
    combined.set(keyBytes, prefix.length);
    const digest = await sha512Bytes(combined);
    return formatGroupedCode(encodeBase32Prefix(digest, REQUEST_CODE_RAW_LENGTH));
}

export async function computeRecoveryKeyCommitment(userId: number | string, recoveryKey: string): Promise<string> {
    const payload = new TextEncoder().encode(`biyen-escrow-v1/commit|${userId}|${recoveryKey}`);
    return bytesToHex(await sha512Bytes(payload));
}

export async function saveStoredRecoveryRequest(state: StoredRecoveryRequestState): Promise<void> {
    if (typeof window !== "undefined") {
        try { window.localStorage.setItem(KV_ACTIVE_RECOVERY_KEY, JSON.stringify(state)); } catch { /* ignore */ }
    }
    try { await setKV(KV_ACTIVE_RECOVERY_KEY, state); } catch { /* ignore */ }
}

export async function clearStoredRecoveryRequest(): Promise<void> {
    if (typeof window !== "undefined") {
        try { window.localStorage.removeItem(KV_ACTIVE_RECOVERY_KEY); } catch { /* ignore */ }
    }
    try { await removeKV(KV_ACTIVE_RECOVERY_KEY); } catch { /* ignore */ }
}

export async function loadStoredRecoveryRequest(): Promise<StoredRecoveryRequestState | null> {
    let candidate: StoredRecoveryRequestState | null = null;
    try {
        const kvVal = await getKV(KV_ACTIVE_RECOVERY_KEY);
        if (kvVal && typeof kvVal === "object") candidate = kvVal as StoredRecoveryRequestState;
    } catch { /* fallback */ }
    if (!candidate && typeof window !== "undefined") {
        try {
            const raw = window.localStorage.getItem(KV_ACTIVE_RECOVERY_KEY);
            if (raw) candidate = JSON.parse(raw) as StoredRecoveryRequestState;
        } catch { candidate = null; }
    }
    if (!candidate) return null;
    if (Date.now() >= candidate.expiresAt) {
        await clearStoredRecoveryRequest();
        return null;
    }
    return candidate;
}

async function buildEscrowHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
    const headers: Record<string, string> = { "Content-Type": "application/json", ...extra };
    try {
        const token = await savedAuthToken();
        if (token) headers["X-Auth-Token"] = token;
    } catch { /* unauthenticated */ }
    return headers;
}

function createOfflineStatus(mode: BiyenEscrowMode): EscrowStatusResponse {
    return { mode, kek_version: DEFAULT_KEK_VERSION, cipher_suite: DEFAULT_CIPHER_SUITE, recovery_key_commitment: null, delete_scheduled_at: null, service_available: false };
}

function persistLocalMode(mode: BiyenEscrowMode): void {
    if (typeof window !== "undefined") {
        try { window.localStorage.setItem(LOCAL_STORAGE_MODE_KEY, mode); } catch { /* ignore */ }
    }
}

export const biyenEscrowClient = {
    async fetchPublicKey(): Promise<EscrowPublicKeyResponse | null> {
        try {
            const res = await fetch(`${await apiOrigin()}/escrow/v1/public-key`, { headers: await buildEscrowHeaders() });
            return res.ok ? ((await res.json()) as EscrowPublicKeyResponse) : null;
        } catch { return null; }
    },

    async getStatus(): Promise<EscrowStatusResponse> {
        const savedMode: BiyenEscrowMode =
            typeof window !== "undefined" && window.localStorage.getItem(LOCAL_STORAGE_MODE_KEY) === "zero_knowledge" ? "zero_knowledge" : "managed";
        try {
            const res = await fetch(`${await apiOrigin()}/escrow/v1/status`, { headers: await buildEscrowHeaders() });
            if (!res.ok) return createOfflineStatus(savedMode);
            const data = (await res.json()) as Partial<EscrowStatusResponse>;
            return {
                mode: data.mode === "zero_knowledge" ? "zero_knowledge" : "managed",
                kek_version: data.kek_version ?? DEFAULT_KEK_VERSION,
                cipher_suite: data.cipher_suite ?? DEFAULT_CIPHER_SUITE,
                recovery_key_commitment: data.recovery_key_commitment ?? null,
                delete_scheduled_at: data.delete_scheduled_at ?? null,
                service_available: true,
            };
        } catch { return createOfflineStatus(savedMode); }
    },

    async depositRecoveryKey(options: EscrowDepositOptions): Promise<EscrowStatusResponse> {
        const userId = options.userId ?? "local";
        const commitment = await computeRecoveryKeyCommitment(userId, options.recoveryKey);
        persistLocalMode("managed");
        try {
            const pubKey = await this.fetchPublicKey();
            const kekVersion = pubKey?.kek_version ?? DEFAULT_KEK_VERSION;
            const cipherSuite = pubKey?.cipher_suite ?? DEFAULT_CIPHER_SUITE;
            const envelope = new TextEncoder().encode(`biyen-escrow-v1/custody|${userId}|${kekVersion}|${commitment}`);
            await fetch(`${await apiOrigin()}/escrow/v1/deposit`, {
                method: "PUT",
                headers: await buildEscrowHeaders(),
                body: JSON.stringify({ kek_version: kekVersion, cipher_suite: cipherSuite, custody_blob: bytesToHex(envelope), recovery_key_commitment: commitment }),
            });
        } catch { /* persist locally when offline */ }
        return this.getStatus();
    },

    async scheduleZeroKnowledge(): Promise<EscrowStatusResponse> {
        persistLocalMode("zero_knowledge");
        try { await fetch(`${await apiOrigin()}/escrow/v1/zero-knowledge`, { method: "POST", headers: await buildEscrowHeaders() }); } catch { /* ignore */ }
        return this.getStatus();
    },

    async cancelZeroKnowledge(): Promise<EscrowStatusResponse> {
        persistLocalMode("managed");
        try { await fetch(`${await apiOrigin()}/escrow/v1/zero-knowledge/cancel`, { method: "POST", headers: await buildEscrowHeaders() }); } catch { /* ignore */ }
        return this.getStatus();
    },

    async getOrCreateRecoveryRequest(options: CreateRecoveryRequestOptions = {}): Promise<StoredRecoveryRequestState> {
        const existing = await loadStoredRecoveryRequest();
        if (existing) return existing;
        const pollSecret = crypto.getRandomValues(new Uint8Array(POLL_SECRET_BYTE_LENGTH));
        const deviceSecret = crypto.getRandomValues(new Uint8Array(DEVICE_SECRET_BYTE_LENGTH));
        const devicePublicKey = crypto.getRandomValues(new Uint8Array(XWING_PUBLIC_KEY_BYTE_LENGTH));
        const pollSecretHash = bytesToHex(await sha512Bytes(pollSecret));
        const devicePublicKeyHex = bytesToHex(devicePublicKey);
        let requestId = crypto.randomUUID();
        let expiresAt = Date.now() + RECOVERY_REQUEST_TTL_MS;

        try {
            const res = await fetch(`${await apiOrigin()}/escrow/v1/recovery-requests`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ device_public_key: devicePublicKeyHex, poll_secret_hash: pollSecretHash, claimed_email: options.claimedEmail }),
            });
            if (res.ok) {
                const payload = (await res.json()) as { request_id?: string; expires_at?: string };
                if (payload.request_id) requestId = payload.request_id;
                const parsedExp = payload.expires_at ? new Date(payload.expires_at).getTime() : Number.NaN;
                if (!Number.isNaN(parsedExp)) expiresAt = parsedExp;
            }
        } catch { /* offline fallback */ }

        const state: StoredRecoveryRequestState = {
            requestId,
            requestCode: await computeRequestCode(requestId, devicePublicKey),
            pollSecretHex: bytesToHex(pollSecret),
            devicePublicKeyHex,
            deviceSecretHex: bytesToHex(deviceSecret),
            claimedEmail: options.claimedEmail ?? "",
            createdAt: Date.now(),
            expiresAt,
        };
        await saveStoredRecoveryRequest(state);
        return state;
    },
    async pollRecoveryRequest(state: StoredRecoveryRequestState): Promise<PollRecoveryResult> {
        try {
            const res = await fetch(`${await apiOrigin()}/escrow/v1/recovery-requests/${state.requestId}`, {
                method: "GET",
                headers: { "Content-Type": "application/json", "X-Poll-Secret": state.pollSecretHex },
            });
            if (!res.ok) return { status: "pending", message: "Menunggu verifikasi identitas & persetujuan Admin." };
            const data = (await res.json()) as { status?: PollRecoveryResult["status"]; recovery_key?: string; device_blob?: string; release_after?: string | null };
            const recoveredKey = data.recovery_key ?? data.device_blob;
            if (data.status === "approved" && recoveredKey) {
                await clearStoredRecoveryRequest();
                return { status: "approved", recoveredKey };
            }
            return { status: data.status ?? "pending", releaseAfter: data.release_after ?? null, message: "Permintaan belum siap diunduh. Pastikan verifikasi Support telah selesai." };
        } catch { return { status: "pending", message: "Menunggu persetujuan brankas escrow dari Biyen Support." }; }
    },
};
