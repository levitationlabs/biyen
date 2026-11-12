// Biyen Admin — Sudo Authentication Store
// Copyright 2026 Levitation — AGPL-3.0-or-later

export const ADMIN_TOKEN_KEY = "biyen_admin_token";
export const ADMIN_TOKEN_CREATED_AT_KEY = "biyen_admin_token_created_at";

// Museum enforcement window: admin token is valid for 10 minutes (600s)
export const SUDO_MAX_FRESHNESS_SECONDS = 600;
export const SUDO_WARNING_THRESHOLD_SECONDS = 180; // 3 minutes

export const SUDO_EXPIRED_EVENT = "biyen:admin:sudo-expired";
export const AUTH_CHANGED_EVENT = "biyen:admin:auth-changed";

type AuthListener = () => void;

class AdminAuthStore {
    private cachedToken: string | null = null;
    private cachedCreatedAt: number | null = null;
    private authListeners = new Set<AuthListener>();
    private sudoExpiredListeners = new Set<AuthListener>();

    constructor() {
        if (typeof window !== "undefined") {
            this.hydrateFromStorage();
        }
    }

    private hydrateFromStorage(): void {
        const storedToken = this.readTokenFromAvailableSources();
        if (!storedToken) {
            return;
        }

        this.cachedToken = storedToken;
        const storedCreatedAt = localStorage.getItem(ADMIN_TOKEN_CREATED_AT_KEY);
        if (storedCreatedAt) {
            const parsed = parseInt(storedCreatedAt, 10);
            this.cachedCreatedAt = Number.isNaN(parsed) ? Date.now() : parsed;
            return;
        }

        // When token exists without timestamp, initialize timestamp to current time
        this.cachedCreatedAt = Date.now();
        localStorage.setItem(ADMIN_TOKEN_CREATED_AT_KEY, String(this.cachedCreatedAt));
    }

    private readTokenFromAvailableSources(): string | null {
        // Priority 1: dedicated admin token
        const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
        if (adminToken) return adminToken;

        // Priority 2: generic token key used by web photos
        const generalToken = localStorage.getItem("token") || localStorage.getItem("admin_token");
        if (generalToken) return generalToken;

        // Priority 3: fallback cookie inspection
        return this.parseTokenFromCookies();
    }

    private parseTokenFromCookies(): string | null {
        if (typeof document === "undefined" || !document.cookie) {
            return null;
        }

        const cookiePairs = document.cookie.split(";");
        for (const pair of cookiePairs) {
            const [rawKey, rawVal] = pair.trim().split("=");
            if (!rawKey || !rawVal) continue;

            const key = decodeURIComponent(rawKey);
            if (key === "admin_token" || key === "token" || key === "ente_token") {
                return decodeURIComponent(rawVal);
            }
        }
        return null;
    }

    public getToken(): string | null {
        if (this.cachedToken) {
            return this.cachedToken;
        }
        if (typeof window === "undefined") {
            return null;
        }
        this.hydrateFromStorage();
        return this.cachedToken;
    }

    public getTokenCreatedAt(): number | null {
        if (this.cachedCreatedAt !== null) {
            return this.cachedCreatedAt;
        }
        if (typeof window === "undefined") {
            return null;
        }
        this.hydrateFromStorage();
        return this.cachedCreatedAt;
    }

    public setToken(token: string, createdAt?: number): void {
        const timestamp = createdAt ?? Date.now();
        this.cachedToken = token;
        this.cachedCreatedAt = timestamp;

        if (typeof window !== "undefined") {
            localStorage.setItem(ADMIN_TOKEN_KEY, token);
            localStorage.setItem(ADMIN_TOKEN_CREATED_AT_KEY, String(timestamp));
            window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT));
        }

        this.notifyAuthListeners();
    }

    public clearToken(): void {
        this.cachedToken = null;
        this.cachedCreatedAt = null;

        if (typeof window !== "undefined") {
            localStorage.removeItem(ADMIN_TOKEN_KEY);
            localStorage.removeItem(ADMIN_TOKEN_CREATED_AT_KEY);
            window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT));
        }

        this.notifyAuthListeners();
    }

    public getRemainingFreshnessSeconds(): number {
        const token = this.getToken();
        const createdAt = this.getTokenCreatedAt();

        if (!token || !createdAt) {
            return 0;
        }

        const elapsedSeconds = Math.floor((Date.now() - createdAt) / 1000);
        const remaining = SUDO_MAX_FRESHNESS_SECONDS - elapsedSeconds;
        return Math.max(0, remaining);
    }

    public isSudoExpired(): boolean {
        return this.getRemainingFreshnessSeconds() <= 0;
    }

    public notifySudoExpired(): void {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent(SUDO_EXPIRED_EVENT));
        }
        this.sudoExpiredListeners.forEach((listener) => {
            try {
                listener();
            } catch {
                // Ignore subscriber runtime errors
            }
        });
    }

    public onSudoExpired(callback: AuthListener): () => void {
        this.sudoExpiredListeners.add(callback);
        return () => {
            this.sudoExpiredListeners.delete(callback);
        };
    }

    public onAuthChange(callback: AuthListener): () => void {
        this.authListeners.add(callback);
        return () => {
            this.authListeners.delete(callback);
        };
    }

    private notifyAuthListeners(): void {
        this.authListeners.forEach((listener) => {
            try {
                listener();
            } catch {
                // Ignore subscriber runtime errors
            }
        });
    }
}

export const authStore = new AdminAuthStore();
