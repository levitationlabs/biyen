// Biyen Admin E2E — Mock Backend & Post-Quantum Escrow Route Handlers
// Copyright 2026 Levitation — AGPL-3.0-or-later

const HTTP_STATUS_OK = 200;
const JSON_CONTENT_TYPE = "application/json";
const MOCK_TOKEN_AGE_MS = 60000;
const MOCK_USER_ID_PRIMARY = 101;
const MOCK_USER_ID_SUSPENDED = 102;
const MOCK_STORAGE_QUOTA_BYTES = 107374182400;
const MOCK_STORAGE_USED_BYTES = 26843545600;
const MOCK_PHOTOS_COUNT = 1420;
const MOCK_LOCKER_COUNT = 12;

export const ESCROW_E2E_CIPHER_SUITE =
    "biyen-escrow-v1:hpke-xwing-hkdfsha256-chacha20poly1305";
export const ESCROW_E2E_KEK_VERSION = "v1";
export const ESCROW_E2E_REQUEST_CODE = "TUU2H-5AQV7-ASMSS-AD747";

const MOCK_USERS_PAYLOAD = {
    users: [
        {
            id: MOCK_USER_ID_PRIMARY,
            email: "huda@biyen.local",
            name: "Huda Biyen",
            creationTime: 1700000000000000,
            isSuspended: false,
            isTwoFactorEnabled: true,
            isEmailMFAEnabled: false,
        },
        {
            id: MOCK_USER_ID_SUSPENDED,
            email: "alice@example.com",
            name: "Alice Wonderland",
            creationTime: 1705000000000000,
            isSuspended: true,
            suspendReason: "Spam account detected",
            isTwoFactorEnabled: false,
            isEmailMFAEnabled: true,
        },
    ],
};

const MOCK_USER_DETAIL_PAYLOAD = {
    user: MOCK_USERS_PAYLOAD.users[0],
    subscription: {
        userID: MOCK_USER_ID_PRIMARY,
        storage: MOCK_STORAGE_QUOTA_BYTES,
        expiryTime: 1800000000000000,
        productID: "pro-100gb",
    },
    storageConsumed: MOCK_STORAGE_USED_BYTES,
    storageConsumedStatus: "available",
    photosFileCount: MOCK_PHOTOS_COUNT,
    lockerFileCount: MOCK_LOCKER_COUNT,
    tokens: [
        {
            token: "tok_session_web_1",
            creationTime: 1700000000000000,
            lastUsedTime: 1700005000000000,
            ua: "Mozilla/5.0 (X11; Linux x86_64) BiyenWeb/1.0",
            isDeleted: false,
            app: "web",
        },
    ],
    authCodes: 1,
};

const MOCK_ABUSE_REPORTS_PAYLOAD = {
    reports: [
        {
            id: 1,
            shareID: 401,
            url: "https://biyen.local/s/xyz123",
            ip: "192.168.1.50",
            userAgent: "Mozilla/5.0",
            reason: "Hak cipta / DMCA",
            createdAt: 1715000000000000,
            isDisabled: false,
        },
    ],
};

const MOCK_ESCROW_DEPOSITS_PAYLOAD = {
    user_id: MOCK_USER_ID_PRIMARY,
    mode: "managed",
    kek_version: ESCROW_E2E_KEK_VERSION,
    cipher_suite: ESCROW_E2E_CIPHER_SUITE,
    last_deposit_at: "2026-11-15T14:30:00Z",
    delete_scheduled_at: null,
    deposits: [
        {
            id: 2,
            user_id: MOCK_USER_ID_PRIMARY,
            kek_version: ESCROW_E2E_KEK_VERSION,
            cipher_suite: ESCROW_E2E_CIPHER_SUITE,
            recovery_key_commitment:
                "e246ec8d33414238c657066a04eb06ed9d5f9e03c63445ee31bf398d5f393fd252f32cf2ec04e1cf6ce2f778b9033ca8f2227ab3d341eaee5d194bcc5512f12f",
            created_at: "2026-11-15T14:30:00Z",
        },
        {
            id: 1,
            user_id: MOCK_USER_ID_PRIMARY,
            kek_version: ESCROW_E2E_KEK_VERSION,
            cipher_suite: ESCROW_E2E_CIPHER_SUITE,
            recovery_key_commitment:
                "a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00",
            created_at: "2026-11-10T09:15:00Z",
        },
    ],
    pending_requests: [
        {
            request_id: "550e8400-e29b-41d4-a716-446655440000",
            request_code: ESCROW_E2E_REQUEST_CODE,
            claimed_email: "huda@biyen.local",
            status: "pending",
            linked_user_id: MOCK_USER_ID_PRIMARY,
            support_ref: "SUP-2026-101",
            expires_at: "2026-11-18T14:30:00Z",
            created_at: "2026-11-15T15:00:00Z",
        },
    ],
};

const MOCK_ESCROW_AUDIT_PAYLOAD = {
    entries: [
        {
            id: 1,
            user_id: MOCK_USER_ID_PRIMARY,
            actor_type: "user",
            actor_id: "101",
            action: "deposit_created",
            support_ref: null,
            prev_hash: "0".repeat(128),
            entry_hash: "f".repeat(128),
            created_at: "2026-11-15T14:30:00Z",
        },
        {
            id: 2,
            user_id: MOCK_USER_ID_PRIMARY,
            actor_type: "device",
            actor_id: "550e8400-e29b-41d4-a716-446655440000",
            action: "recovery_requested",
            support_ref: "SUP-2026-101",
            prev_hash: "f".repeat(128),
            entry_hash: "e".repeat(128),
            created_at: "2026-11-15T15:00:00Z",
        },
    ],
};

function fulfillJson(route, payload) {
    return route.fulfill({
        status: HTTP_STATUS_OK,
        contentType: JSON_CONTENT_TYPE,
        body: JSON.stringify(payload),
    });
}

export async function seedMockAdminSession(context) {
    await context.addInitScript((tokenAgeMs) => {
        window.localStorage.setItem("biyen_admin_token", "biyen_mock_admin_token_xyz");
        window.localStorage.setItem(
            "biyen_admin_token_created_at",
            String(Date.now() - tokenAgeMs),
        );
    }, MOCK_TOKEN_AGE_MS);
}

export async function registerMockRoutes(context) {
    await context.route(/.*\/(admin|escrow)\/.*/, async (route) => {
        const url = route.request().url();
        const method = route.request().method();

        if (url.includes("/escrow/v1/admin/users/101/deposits")) {
            return fulfillJson(route, MOCK_ESCROW_DEPOSITS_PAYLOAD);
        }

        if (url.includes("/escrow/v1/admin/audit")) {
            return fulfillJson(route, MOCK_ESCROW_AUDIT_PAYLOAD);
        }

        if (url.includes("/admin/users")) {
            return fulfillJson(route, MOCK_USERS_PAYLOAD);
        }

        if (url.includes("/admin/user") && method === "GET") {
            return fulfillJson(route, MOCK_USER_DETAIL_PAYLOAD);
        }

        if (url.includes("/admin/abuse-reports")) {
            return fulfillJson(route, MOCK_ABUSE_REPORTS_PAYLOAD);
        }

        return fulfillJson(route, { success: true });
    });
}
