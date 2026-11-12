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
