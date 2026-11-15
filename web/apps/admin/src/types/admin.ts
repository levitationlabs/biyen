export interface AdminUser {
    id: number;
    email: string;
    name?: string;
    hash?: string;
    creationTime: number;
    familyAdminID?: number | null;
    isTwoFactorEnabled?: boolean;
    isEmailMFAEnabled?: boolean;
    isSuspended?: boolean;
    suspendReason?: string;
}

export interface UserSubscription {
    userID: number;
    storage: number;
    expiryTime: number;
    productID: string;
    paymentProvider?: string;
    transactionID?: string;
}

export interface UserSessionToken {
    token?: string;
    creationTime: number;
    lastUsedTime: number;
    ua: string;
    isDeleted: boolean;
    app: string;
}

export interface AdminUserDetails {
    user: AdminUser;
    subscription?: UserSubscription;
    storageConsumed?: number;
    storageConsumedStatus?: "available" | "unavailable";
    photosFileCount?: number;
    lockerFileCount?: number;
    tokens?: UserSessionToken[];
    authCodes?: number;
}

export interface AbuseReport {
    id: number;
    shareID: number;
    url: string;
    ip: string;
    userAgent: string;
    reason: string;
    details?: Record<string, unknown>;
    createdAt: number;
    isDisabled?: boolean;
}

export interface SuspendUserPayload {
    userID: number;
    reason: string;
}

export interface UpdateQuotaPayload {
    userID: number;
    storageInBytes: number;
    expiryTimeInMicro: number;
}

export interface StorageBonusPayload {
    userID: number;
    bonusType: string;
    storageInGB: number;
    year: number;
    action: "ADD" | "UPDATE" | "REMOVE";
}

export type EscrowMode = "managed" | "zero_knowledge";

export type EscrowRecoveryRequestStatus =
    | "pending"
    | "approved"
    | "consumed"
    | "expired"
    | "rejected";

export interface EscrowDepositSummary {
    id: number;
    user_id: number;
    kek_version: string;
    cipher_suite: string;
    recovery_key_commitment: string;
    created_at: string;
}

export interface EscrowRecoveryRequestItem {
    request_id: string;
    request_code: string;
    claimed_email?: string;
    status: EscrowRecoveryRequestStatus;
    linked_user_id?: number | null;
    support_ref?: string | null;
    approved_at?: string | null;
    release_after?: string | null;
    expires_at: string;
    consumed_at?: string | null;
    created_at?: string;
}

export interface EscrowAuditEntry {
    id: number;
    user_id?: number | null;
    actor_type: string;
    actor_id: string;
    action: string;
    support_ref?: string | null;
    prev_hash: string;
    entry_hash: string;
    created_at: string;
}

export interface UserEscrowSummary {
    user_id: number;
    mode: EscrowMode;
    kek_version: string;
    cipher_suite: string;
    last_deposit_at: string | null;
    delete_scheduled_at: string | null;
    deposits: EscrowDepositSummary[];
    pending_requests: EscrowRecoveryRequestItem[];
    service_available: boolean;
}
