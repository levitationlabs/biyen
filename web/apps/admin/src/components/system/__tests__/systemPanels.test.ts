import { describe, it, expect } from "vitest";
import {
    UsageRecalculationPanel,
    QueueRequeuePanel,
    SystemMailerPanel,
} from "../index";

describe("System Operations Panels exports and contracts", () => {
    it("should export all 3 maintenance panels", () => {
        expect(UsageRecalculationPanel).toBeDefined();
        expect(QueueRequeuePanel).toBeDefined();
        expect(SystemMailerPanel).toBeDefined();
    });

    describe("Email list parsing logic", () => {
        const parseEmails = (input: string): string[] =>
            input
                .split(",")
                .map((e) => e.trim())
                .filter((e) => e.length > 0);

        it("parses single email correctly", () => {
            expect(parseEmails("admin@biyen.id")).toEqual(["admin@biyen.id"]);
        });

        it("parses comma-separated emails and trims whitespace", () => {
            expect(
                parseEmails(" admin@biyen.id ,  ops@biyen.id,  dev@biyen.id  ")
            ).toEqual(["admin@biyen.id", "ops@biyen.id", "dev@biyen.id"]);
        });

        it("filters out empty entries", () => {
            expect(parseEmails("admin@biyen.id, ,,  ")).toEqual(["admin@biyen.id"]);
        });
    });

    describe("Item and User ID numeric validation", () => {
        const isValidId = (val: string): boolean => {
            const trimmed = val.trim();
            if (!trimmed) return false;
            const num = Number(trimmed);
            return !isNaN(num) && num > 0;
        };

        it("validates positive integers", () => {
            expect(isValidId("1042")).toBe(true);
            expect(isValidId(" 50 ")).toBe(true);
        });

        it("rejects non-numeric, 0, or negative numbers", () => {
            expect(isValidId("0")).toBe(false);
            expect(isValidId("-5")).toBe(false);
            expect(isValidId("abc")).toBe(false);
            expect(isValidId("")).toBe(false);
        });
    });
});
