// Biyen Admin — User Management Helpers
// Copyright 2026 Levitation — AGPL-3.0-or-later

import type { AdminUser } from "@/types/admin";

export type UserStatusFilter = "all" | "active" | "suspended";

const MICROSECONDS_THRESHOLD = 1e14;
const MILLISECONDS_THRESHOLD = 1e11;

/**
 * Normalizes microsecond, millisecond, or second timestamps to JavaScript milliseconds.
 */
export function normalizeTimestampToMs(timestamp: number): number {
    if (!timestamp || timestamp <= 0) {
        return 0;
    }
    if (timestamp > MICROSECONDS_THRESHOLD) {
        return Math.floor(timestamp / 1000);
    }
    if (timestamp > MILLISECONDS_THRESHOLD) {
        return timestamp;
    }
    return timestamp * 1000;
}

/**
 * Formats timestamp to readable localized date string (e.g., "12 Nov 2026").
 */
export function formatRegistrationDate(timestamp: number): string {
    const ms = normalizeTimestampToMs(timestamp);
    if (ms <= 0) {
        return "-";
    }
    return new Date(ms).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

/**
 * Formats timestamp to date and time string (e.g., "12 Nov 2026, 20:30").
 */
export function formatDateTime(timestamp: number): string {
    const ms = normalizeTimestampToMs(timestamp);
    if (ms <= 0) {
        return "-";
    }
    return new Date(ms).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

interface FilterUsersOptions {
    users: AdminUser[];
    searchQuery: string;
    statusFilter: UserStatusFilter;
}

/**
 * Filters a list of users based on search keyword (ID / Email) and account status filter.
 */
export function filterUsers(options: FilterUsersOptions): AdminUser[] {
    const { users, searchQuery, statusFilter } = options;
    const trimmedQuery = searchQuery.trim().toLowerCase();

    return users.filter((user) => {
        // Status check
        if (statusFilter === "active" && user.isSuspended) {
            return false;
        }
        if (statusFilter === "suspended" && !user.isSuspended) {
            return false;
        }

        // Query check
        if (!trimmedQuery) {
            return true;
        }

        const matchesId = String(user.id).includes(trimmedQuery);
        const matchesEmail = user.email.toLowerCase().includes(trimmedQuery);
        const matchesName = user.name ? user.name.toLowerCase().includes(trimmedQuery) : false;

        return matchesId || matchesEmail || matchesName;
    });
}
