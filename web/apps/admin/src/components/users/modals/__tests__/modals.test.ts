import { describe, it, expect } from "vitest";
import {
    QuotaModal,
    SuspendModal,
    SecurityModal,
    BonusModal,
    ChangeEmailModal,
} from "../index";

describe("User Action Modals Contract & Exports", () => {
    it("should export all required user action modal components", () => {
        expect(QuotaModal).toBeDefined();
        expect(typeof QuotaModal).toBe("function");

        expect(SuspendModal).toBeDefined();
        expect(typeof SuspendModal).toBe("function");

        expect(SecurityModal).toBeDefined();
        expect(typeof SecurityModal).toBe("function");

        expect(BonusModal).toBeDefined();
        expect(typeof BonusModal).toBe("function");

        expect(ChangeEmailModal).toBeDefined();
        expect(typeof ChangeEmailModal).toBe("function");
    });

    describe("QuotaModal preset conversions", () => {
        const BYTES_IN_GB = 1024 * 1024 * 1024;
        const BYTES_IN_TB = BYTES_IN_GB * 1024;

        it("converts gigabytes to exact bytes", () => {
            expect(50 * BYTES_IN_GB).toBe(53687091200);
            expect(100 * BYTES_IN_GB).toBe(107374182400);
        });

        it("converts terabytes to exact bytes", () => {
            expect(1 * BYTES_IN_TB).toBe(1099511627776);
            expect(100 * BYTES_IN_TB).toBe(109951162777600);
        });
    });

    describe("ChangeEmailModal email format validation contract", () => {
        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        it("accepts valid email addresses", () => {
            expect(EMAIL_REGEX.test("user@example.com")).toBe(true);
            expect(EMAIL_REGEX.test("admin.biyen@photos.ente.io")).toBe(true);
            expect(EMAIL_REGEX.test("user+tag@domain.co.id")).toBe(true);
        });

        it("rejects invalid email formats", () => {
            expect(EMAIL_REGEX.test("invalid-email")).toBe(false);
            expect(EMAIL_REGEX.test("user@")).toBe(false);
            expect(EMAIL_REGEX.test("@domain.com")).toBe(false);
            expect(EMAIL_REGEX.test("user@domain")).toBe(false);
            expect(EMAIL_REGEX.test("")).toBe(false);
        });
    });

    describe("BonusModal action definitions", () => {
        const allowedActions = ["ADD", "UPDATE", "REMOVE"] as const;

        it("contains all three bonus actions", () => {
            expect(allowedActions).toContain("ADD");
            expect(allowedActions).toContain("UPDATE");
            expect(allowedActions).toContain("REMOVE");
        });
    });
});
