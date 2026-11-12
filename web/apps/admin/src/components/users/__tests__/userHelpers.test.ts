// Biyen Admin — User Helpers Unit Tests
// Copyright 2026 Levitation — AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import type { AdminUser } from "@/types/admin";
import {
    normalizeTimestampToMs,
    formatRegistrationDate,
    formatDateTime,
    filterUsers,
} from "../userHelpers";

describe("userHelpers", () => {
    describe("normalizeTimestampToMs", () => {
        it("handles zero or negative timestamps", () => {
            expect(normalizeTimestampToMs(0)).toBe(0);
            expect(normalizeTimestampToMs(-100)).toBe(0);
        });

        it("normalizes microseconds (> 1e14) to milliseconds", () => {
            const micro = 1731420000000000;
            expect(normalizeTimestampToMs(micro)).toBe(1731420000000);
        });

        it("normalizes milliseconds (> 1e11) as-is", () => {
            const ms = 1731420000000;
            expect(normalizeTimestampToMs(ms)).toBe(1731420000000);
        });

        it("normalizes seconds (< 1e11) to milliseconds", () => {
            const sec = 1731420000;
            expect(normalizeTimestampToMs(sec)).toBe(1731420000000);
        });
    });

    describe("formatRegistrationDate", () => {
        it("returns dash for invalid timestamp", () => {
            expect(formatRegistrationDate(0)).toBe("-");
        });

        it("formats valid timestamp", () => {
            const formatted = formatRegistrationDate(1731420000000);
            expect(formatted).toBeTruthy();
            expect(typeof formatted).toBe("string");
            expect(formatted).not.toBe("-");
        });
    });

    describe("formatDateTime", () => {
        it("returns dash for invalid timestamp", () => {
            expect(formatDateTime(0)).toBe("-");
        });

        it("formats valid date time", () => {
            const formatted = formatDateTime(1731420000000);
            expect(formatted).toBeTruthy();
            expect(formatted).not.toBe("-");
        });
    });

    describe("filterUsers", () => {
        const mockUsers: AdminUser[] = [
            {
                id: 101,
                email: "alice@biyen.id",
                name: "Alice Wijaya",
                creationTime: 1700000000000,
                isSuspended: false,
                isTwoFactorEnabled: true,
            },
            {
                id: 102,
                email: "bob@levitation.id",
                creationTime: 1700000000000,
                isSuspended: true,
                suspendReason: "Spam abuse",
            },
            {
                id: 205,
                email: "charlie@example.com",
                name: "Charlie Tan",
                creationTime: 1700000000000,
                isSuspended: false,
                isEmailMFAEnabled: true,
            },
        ];

        it("returns all users when status is 'all' and query is empty", () => {
            const result = filterUsers({
                users: mockUsers,
                searchQuery: "",
                statusFilter: "all",
            });
            expect(result).toHaveLength(3);
        });

        it("filters active users only", () => {
            const result = filterUsers({
                users: mockUsers,
                searchQuery: "",
                statusFilter: "active",
            });
            expect(result).toHaveLength(2);
            expect(result.map((u) => u.id)).toEqual([101, 205]);
        });

        it("filters suspended users only", () => {
            const result = filterUsers({
                users: mockUsers,
                searchQuery: "",
                statusFilter: "suspended",
            });
            expect(result).toHaveLength(1);
            expect(result[0]?.id).toBe(102);
        });

        it("filters by email query", () => {
            const result = filterUsers({
                users: mockUsers,
                searchQuery: "levitation",
                statusFilter: "all",
            });
            expect(result).toHaveLength(1);
            expect(result[0]?.email).toBe("bob@levitation.id");
        });

        it("filters by user ID query", () => {
            const result = filterUsers({
                users: mockUsers,
                searchQuery: "205",
                statusFilter: "all",
            });
            expect(result).toHaveLength(1);
            expect(result[0]?.id).toBe(205);
        });

        it("filters by name query", () => {
            const result = filterUsers({
                users: mockUsers,
                searchQuery: "Alice",
                statusFilter: "all",
            });
            expect(result).toHaveLength(1);
            expect(result[0]?.name).toBe("Alice Wijaya");
        });

        it("combines search query with status filter", () => {
            const result = filterUsers({
                users: mockUsers,
                searchQuery: "id",
                statusFilter: "active",
            });
            // Alice (alice@biyen.id) is active, Bob is suspended
            expect(result).toHaveLength(1);
            expect(result[0]?.id).toBe(101);
        });
    });
});
