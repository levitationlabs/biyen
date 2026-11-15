// Biyen Admin — Core Admin API Client
// Copyright 2026 Levitation — AGPL-3.0-or-later

import type {
    AdminUser,
    AdminUserDetails,
    AbuseReport,
    EscrowAuditEntry,
    EscrowDepositSummary,
    EscrowMode,
    EscrowRecoveryRequestItem,
    StorageBonusPayload,
    SuspendUserPayload,
    UpdateQuotaPayload,
    UserEscrowSummary,
} from "@/types/admin";
import { authStore } from "./authStore";

const DEFAULT_FALLBACK_ENDPOINT = "http://localhost:8080";
const CLIENT_PACKAGE_HEADER = "id.web.levitation.biyen.admin";
const TOKEN_TOO_OLD_MESSAGE = "Token is too old";
const DEFAULT_ESCROW_KEK_VERSION = "v1";
const DEFAULT_ESCROW_CIPHER_SUITE = "X-Wing MLKEM768-X25519";
const DEFAULT_AUDIT_LIMIT = 50;

export class AdminApiError extends Error {
    public readonly status: number;
    public readonly data?: unknown;
    public readonly isSudoExpired: boolean;

    constructor(message: string, status: number, data?: unknown, isSudoExpired = false) {
        super(message);
        this.name = "AdminApiError";
        this.status = status;
        this.data = data;
        this.isSudoExpired = isSudoExpired;
    }
}

export function getAdminEndpoint(): string {
    if (typeof window !== "undefined") {
        const customEndpoint =
            localStorage.getItem("admin_api_endpoint") ||
            localStorage.getItem("apiOrigin");
        if (customEndpoint) {
            return customEndpoint.replace(/\/+$/, "");
        }
    }
    const envEndpoint = process.env.NEXT_PUBLIC_ENTE_ENDPOINT;
    if (envEndpoint) {
        return envEndpoint.replace(/\/+$/, "");
    }
    return DEFAULT_FALLBACK_ENDPOINT;
}

export function setAdminEndpoint(endpoint: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("admin_api_endpoint", endpoint.trim());
}

interface RequestOptions {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    path: string;
    params?: Record<string, string | number | undefined>;
    body?: unknown;
}

async function request<T>(options: RequestOptions): Promise<T> {
    const { method = "GET", path, params, body } = options;
    const base = getAdminEndpoint();
    const url = new URL(path, base);

    if (params) {
        for (const [key, val] of Object.entries(params)) {
            if (val !== undefined && val !== null) {
                url.searchParams.set(key, String(val));
            }
        }
    }

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Client-Package": CLIENT_PACKAGE_HEADER,
    };

    const token = authStore.getToken();
    if (token) {
        headers["X-Auth-Token"] = token;
    }

    const res = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    return handleResponse<T>(res);
}

async function handleResponse<T>(res: Response): Promise<T> {
    const rawText = await res.text();
    let parsed: unknown = null;
    if (rawText) {
        try {
            parsed = JSON.parse(rawText);
        } catch {
            parsed = rawText;
        }
    }

    if (!res.ok) {
        const errorMsg = extractErrorMessage(parsed, res.statusText);
        const isSudoExpired =
            res.status === 401 ||
            (res.status === 400 && errorMsg.includes(TOKEN_TOO_OLD_MESSAGE));

        if (isSudoExpired) {
            authStore.notifySudoExpired();
        }

        throw new AdminApiError(errorMsg, res.status, parsed, isSudoExpired);
    }

    return parsed as T;
}

function extractErrorMessage(payload: unknown, fallback: string): string {
    if (!payload || typeof payload !== "object") {
        return typeof payload === "string" && payload.length > 0 ? payload : fallback;
    }
    const record = payload as Record<string, unknown>;
    const possible = record.message || record.error || record.details;
    if (typeof possible === "string") return possible;
    return fallback;
}

function createDefaultEscrowSummary(userID: number): UserEscrowSummary {
    return {
        user_id: userID,
        mode: "managed",
        kek_version: DEFAULT_ESCROW_KEK_VERSION,
        cipher_suite: DEFAULT_ESCROW_CIPHER_SUITE,
        last_deposit_at: null,
        delete_scheduled_at: null,
        deposits: [],
        pending_requests: [],
        service_available: false,
    };
}

function pickNonEmptyString(value: unknown, fallback: string): string {
    return typeof value === "string" && value.length > 0 ? value : fallback;
}

function normalizeEscrowSummary(userID: number, payload: unknown): UserEscrowSummary {
    if (!payload || typeof payload !== "object") return createDefaultEscrowSummary(userID);
    const record = payload as Record<string, unknown>;
    const deposits = Array.isArray(record.deposits) ? (record.deposits as EscrowDepositSummary[]) : [];
    const rawPending = record.pending_requests ?? record.recovery_requests;
    const pendingRequests = Array.isArray(rawPending) ? (rawPending as EscrowRecoveryRequestItem[]) : [];
    const mode: EscrowMode = record.mode === "zero_knowledge" ? "zero_knowledge" : "managed";
    const latestDeposit = deposits[0];

    return {
        user_id: typeof record.user_id === "number" ? record.user_id : userID,
        mode,
        kek_version: pickNonEmptyString(
            record.kek_version,
            latestDeposit?.kek_version ?? DEFAULT_ESCROW_KEK_VERSION,
        ),
        cipher_suite: pickNonEmptyString(
            record.cipher_suite,
            latestDeposit?.cipher_suite ?? DEFAULT_ESCROW_CIPHER_SUITE,
        ),
        last_deposit_at:
            typeof record.last_deposit_at === "string"
                ? record.last_deposit_at
                : latestDeposit?.created_at ?? null,
        delete_scheduled_at:
            typeof record.delete_scheduled_at === "string" ? record.delete_scheduled_at : null,
        deposits,
        pending_requests: pendingRequests,
        service_available: true,
    };
}

export const adminClient = {
    async getUsers(sinceTime = 0): Promise<AdminUser[]> {
        const res = await request<{ users?: AdminUser[] }>({ path: "/admin/users", params: { sinceTime } });
        return res?.users ?? (Array.isArray(res) ? (res as AdminUser[]) : []);
    },

    async getUserDetails(query: { email?: string; id?: number }): Promise<AdminUserDetails> {
        return request<AdminUserDetails>({ path: "/admin/user", params: { email: query.email, id: query.id } });
    },

    async updateSubscription(payload: UpdateQuotaPayload): Promise<void> {
        const body = {
            userID: payload.userID,
            storage: payload.storageInBytes,
            expiryTime: payload.expiryTimeInMicro,
            productID: "free",
            transactionID: `admin-ui-${Date.now()}`,
            paymentProvider: "",
        };
        await request({ method: "PUT", path: "/admin/user/subscription", body });
    },

    async updateBonus(payload: StorageBonusPayload): Promise<void> {
        await request({ method: "POST", path: "/admin/user/bonus", body: payload });
    },

    async disableTwoFactor(userID: number): Promise<void> {
        await request({ method: "POST", path: "/admin/user/disable-2fa", body: { userID } });
    },

    async disablePasskeys(userID: number): Promise<void> {
        await request({ method: "POST", path: "/admin/user/disable-passkeys", body: { userID } });
    },

    async updateEmailMFA(userID: number, enabled: boolean): Promise<void> {
        await request({ method: "POST", path: "/admin/user/update-email-mfa", body: { userID, emailMFA: enabled } });
    },

    async terminateSession(payload: { userID: number; token: string }): Promise<void> {
        await request({ method: "POST", path: "/admin/user/terminate-session", body: payload });
    },

    async suspendUser(payload: SuspendUserPayload): Promise<void> {
        await request({ method: "POST", path: "/admin/user/suspend", body: payload });
    },

    async unsuspendUser(userID: number): Promise<void> {
        await request({ method: "POST", path: "/admin/user/unsuspend", body: { userID } });
    },

    async getAbuseReports(): Promise<AbuseReport[]> {
        const res = await request<{ reports?: AbuseReport[] }>({ path: "/admin/abuse-reports" });
        return res?.reports ?? (Array.isArray(res) ? (res as AbuseReport[]) : []);
    },

    async disableSharedCollection(shareID: number): Promise<void> {
        await request({ method: "POST", path: "/admin/collection/disable-share", body: { shareID } });
    },

    async changeEmail(payload: { userID: number; email: string }): Promise<void> {
        await request({ method: "PUT", path: "/admin/user/change-email", body: payload });
    },

    async deleteUser(email: string): Promise<void> {
        await request({ method: "DELETE", path: "/admin/user/delete", params: { email } });
    },

    async unblockStorageWarning(userID: number): Promise<void> {
        await request({ method: "POST", path: "/admin/user/unblock-storage-warning-login", body: { userID } });
    },

    async requeueItem(payload: { id: number; queueName: string }): Promise<void> {
        await request({ method: "POST", path: "/admin/queue/re-queue", body: payload });
    },

    async initFileCounts(userID: number): Promise<{ initialized: boolean; reason?: string }> {
        return request<{ initialized: boolean; reason?: string }>({
            method: "POST",
            path: "/admin/user/init-file-counts",
            body: { userID },
        });
    },

    async sendTestMail(payload: { to: string[]; subject: string; body: string }): Promise<void> {
        await request({ method: "POST", path: "/admin/mail", body: payload });
    },

    async getUserEscrowDeposits(userID: number): Promise<UserEscrowSummary> {
        try {
            const res = await request<unknown>({ path: `/escrow/v1/admin/users/${userID}/deposits` });
            return normalizeEscrowSummary(userID, res);
        } catch (err: unknown) {
            if (err instanceof AdminApiError && err.isSudoExpired) throw err;
            return createDefaultEscrowSummary(userID);
        }
    },

    async getEscrowAuditLog(limit = DEFAULT_AUDIT_LIMIT): Promise<EscrowAuditEntry[]> {
        try {
            const res = await request<
                { entries?: EscrowAuditEntry[]; audit_log?: EscrowAuditEntry[] } | EscrowAuditEntry[]
            >({ path: "/escrow/v1/admin/audit", params: { limit } });
            return Array.isArray(res) ? res : (res?.entries ?? res?.audit_log ?? []);
        } catch (err: unknown) {
            if (err instanceof AdminApiError && err.isSudoExpired) throw err;
            return [];
        }
    },
};
