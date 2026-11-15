// Biyen Admin — Comprehensive Tests for AuthStore & AdminClient
// Copyright 2026 Levitation — AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi, afterEach, beforeAll } from "vitest";

const storageMap = new Map<string, string>();
const localStorageMock = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => {
        storageMap.set(key, String(value));
    },
    removeItem: (key: string) => {
        storageMap.delete(key);
    },
    clear: () => {
        storageMap.clear();
    },
};

beforeAll(() => {
    Object.defineProperty(globalThis, "localStorage", {
        value: localStorageMock,
        writable: true,
    });
    Object.defineProperty(globalThis, "window", {
        value: {
            dispatchEvent: vi.fn(),
            setInterval: globalThis.setInterval,
            clearInterval: globalThis.clearInterval,
        },
        writable: true,
    });
});

import { authStore, SUDO_MAX_FRESHNESS_SECONDS } from "../authStore";
import { adminClient, AdminApiError, getAdminEndpoint, setAdminEndpoint } from "../adminClient";

describe("authStore", () => {
    beforeEach(() => {
        authStore.clearToken();
        localStorage.clear();
    });

    it("should set and retrieve admin token and timestamp", () => {
        const dummyToken = "test-token-123";
        const now = Date.now();
        authStore.setToken(dummyToken, now);
        expect(authStore.getToken()).toBe(dummyToken);
        expect(authStore.getTokenCreatedAt()).toBe(now);
    });

    it("should calculate remaining freshness seconds correctly", () => {
        const now = Date.now();
        authStore.setToken("fresh-token", now);
        const remaining = authStore.getRemainingFreshnessSeconds();
        expect(remaining).toBeGreaterThanOrEqual(SUDO_MAX_FRESHNESS_SECONDS - 1);
        expect(remaining).toBeLessThanOrEqual(SUDO_MAX_FRESHNESS_SECONDS);
        expect(authStore.isSudoExpired()).toBe(false);
    });

    it("should report expired when token is older than 10 minutes", () => {
        const elevenMinutesAgo = Date.now() - 11 * 60 * 1000;
        authStore.setToken("old-token", elevenMinutesAgo);
        expect(authStore.getRemainingFreshnessSeconds()).toBe(0);
        expect(authStore.isSudoExpired()).toBe(true);
    });

    it("should notify listeners on auth change and sudo expiry", () => {
        const authChangeSpy = vi.fn();
        const sudoExpiredSpy = vi.fn();
        const unsubAuth = authStore.onAuthChange(authChangeSpy);
        const unsubExpired = authStore.onSudoExpired(sudoExpiredSpy);
        authStore.setToken("notify-test");
        expect(authChangeSpy).toHaveBeenCalledTimes(1);
        authStore.notifySudoExpired();
        expect(sudoExpiredSpy).toHaveBeenCalledTimes(1);
        unsubAuth();
        unsubExpired();
        authStore.clearToken();
        expect(authChangeSpy).toHaveBeenCalledTimes(1);
    });
});

describe("adminClient", () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        authStore.setToken("active-admin-token", Date.now());
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it("should send correct headers with requests", async () => {
        let capturedHeaders: HeadersInit | undefined;
        let capturedUrl: string | undefined;

        globalThis.fetch = vi.fn().mockImplementation(async (url, init) => {
            capturedUrl = String(url);
            capturedHeaders = init?.headers;
            return new Response(JSON.stringify({ users: [{ id: 1, email: "admin@ente.io" }] }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        });

        const users = await adminClient.getUsers(100);

        expect(users).toHaveLength(1);
        expect(users[0]?.email).toBe("admin@ente.io");
        expect(capturedUrl).toContain("/admin/users?sinceTime=100");

        const headers = capturedHeaders as Record<string, string>;
        expect(headers["X-Auth-Token"]).toBe("active-admin-token");
        expect(headers["X-Client-Package"]).toBe("id.web.levitation.biyen.admin");
        expect(headers["Content-Type"]).toBe("application/json");
    });

    it("should trigger sudo expired on status 400 with 'Token is too old'", async () => {
        const expiredSpy = vi.fn();
        const unsub = authStore.onSudoExpired(expiredSpy);

        globalThis.fetch = vi.fn().mockImplementation(async () => {
            return new Response(JSON.stringify({ message: "Token is too old" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        });

        await expect(adminClient.disableTwoFactor(42)).rejects.toThrow(AdminApiError);
        expect(expiredSpy).toHaveBeenCalledTimes(1);

        unsub();
    });

    it("should trigger sudo expired on status 401 Unauthorized", async () => {
        const expiredSpy = vi.fn();
        const unsub = authStore.onSudoExpired(expiredSpy);

        globalThis.fetch = vi.fn().mockImplementation(async () => {
            return new Response(JSON.stringify({ message: "Unauthorized" }), {
                status: 401,
            });
        });

        await expect(adminClient.getUserDetails({ id: 99 })).rejects.toThrow(AdminApiError);
        expect(expiredSpy).toHaveBeenCalledTimes(1);

        unsub();
    });

    it("should execute all required admin operations with correct payloads", async () => {
        const calls: Array<{ url: string; method: string; body?: unknown }> = [];

        globalThis.fetch = vi.fn().mockImplementation(async (url, init) => {
            calls.push({
                url: String(url),
                method: init?.method || "GET",
                body: init?.body ? JSON.parse(String(init.body)) : undefined,
            });
            return new Response(JSON.stringify({ success: true, initialized: true }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        });

        await adminClient.getUserDetails({ email: "user@ente.io" });
        await adminClient.updateSubscription({
            userID: 1,
            storageInBytes: 10737418240,
            expiryTimeInMicro: 1700000000000,
        });
        await adminClient.updateBonus({
            userID: 1,
            bonusType: "ADD_ON_SUPPORT",
            storageInGB: 50,
            year: 3,
            action: "ADD",
        });
        await adminClient.disablePasskeys(1);
        await adminClient.updateEmailMFA(1, true);
        await adminClient.terminateSession({ userID: 1, token: "session-abc" });
        await adminClient.suspendUser({ userID: 1, reason: "Spam behavior" });
        await adminClient.unsuspendUser(1);
        await adminClient.getAbuseReports();
        await adminClient.disableSharedCollection(99);
        await adminClient.changeEmail({ userID: 1, email: "new@ente.io" });
        await adminClient.deleteUser("del@ente.io");
        await adminClient.unblockStorageWarning(1);
        await adminClient.requeueItem({ id: 10, queueName: "thumbnails" });
        const initRes = await adminClient.initFileCounts(1);
        await adminClient.sendTestMail({
            to: ["admin@ente.io"],
            subject: "Halo",
            body: "Tes Email",
        });

        expect(initRes.initialized).toBe(true);
        expect(calls).toHaveLength(16);
        expect(calls[0]?.url).toContain("/admin/user?email=user%40ente.io");
        expect(calls[1]?.method).toBe("PUT");
        expect(calls[2]?.method).toBe("POST");
        expect(calls[4]?.body).toEqual({ userID: 1, emailMFA: true });
        expect(calls[6]?.body).toEqual({ userID: 1, reason: "Spam behavior" });
        expect(calls[11]?.url).toContain("/admin/user/delete?email=del%40ente.io");
    });

    it("should allow configuring custom admin endpoint", () => {
        setAdminEndpoint("https://my-ente.example.com");
        expect(getAdminEndpoint()).toBe("https://my-ente.example.com");
        localStorage.removeItem("admin_api_endpoint");
    });

    it("should fetch and normalize user escrow deposits summary when escrow service responds", async () => {
        globalThis.fetch = vi.fn().mockImplementation(async () => {
            return new Response(
                JSON.stringify({
                    user_id: 77,
                    mode: "managed",
                    kek_version: "v1",
                    cipher_suite: "biyen-escrow-v1:hpke-xwing-hkdfsha256-chacha20poly1305",
                    deposits: [
                        {
                            id: 10,
                            user_id: 77,
                            kek_version: "v1",
                            cipher_suite: "biyen-escrow-v1:hpke-xwing-hkdfsha256-chacha20poly1305",
                            recovery_key_commitment: "abcd1234",
                            created_at: "2026-11-15T10:00:00Z",
                        },
                    ],
                    pending_requests: [
                        {
                            request_id: "req-1",
                            request_code: "ABCDE-FGHIJ-KLMNO-PQRST",
                            status: "pending",
                            expires_at: "2026-11-18T10:00:00Z",
                        },
                    ],
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            );
        });

        const summary = await adminClient.getUserEscrowDeposits(77);
        expect(summary.user_id).toBe(77);
        expect(summary.mode).toBe("managed");
        expect(summary.kek_version).toBe("v1");
        expect(summary.last_deposit_at).toBe("2026-11-15T10:00:00Z");
        expect(summary.deposits).toHaveLength(1);
        expect(summary.pending_requests[0]?.request_code).toBe("ABCDE-FGHIJ-KLMNO-PQRST");
        expect(summary.service_available).toBe(true);
    });

    it("should gracefully fall back when escrow service is offline or returns 404", async () => {
        globalThis.fetch = vi.fn().mockImplementation(async () => {
            return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
        });

        const summary = await adminClient.getUserEscrowDeposits(88);
        expect(summary.user_id).toBe(88);
        expect(summary.mode).toBe("managed");
        expect(summary.cipher_suite).toBe("X-Wing MLKEM768-X25519");
        expect(summary.deposits).toEqual([]);
        expect(summary.service_available).toBe(false);

        const auditEntries = await adminClient.getEscrowAuditLog(20);
        expect(auditEntries).toEqual([]);
    });

    it("should fetch escrow audit log entries when available", async () => {
        globalThis.fetch = vi.fn().mockImplementation(async () => {
            return new Response(
                JSON.stringify({
                    entries: [
                        {
                            id: 1,
                            user_id: 77,
                            actor_type: "admin",
                            actor_id: "founder",
                            action: "approve_recovery",
                            prev_hash: "00",
                            entry_hash: "ff",
                            created_at: "2026-11-15T12:00:00Z",
                        },
                    ],
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
            );
        });

        const entries = await adminClient.getEscrowAuditLog(10);
        expect(entries).toHaveLength(1);
        expect(entries[0]?.action).toBe("approve_recovery");
    });
});
