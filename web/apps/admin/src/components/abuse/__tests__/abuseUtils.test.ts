import { describe, it, expect } from "vitest";
import {
    formatReportDate,
    computeAbuseMetrics,
    filterAbuseReports,
} from "../abuseUtils";
import type { AbuseReport } from "@/types/admin";

describe("abuseUtils", () => {
    const mockReports: AbuseReport[] = [
        {
            id: 1,
            shareID: 101,
            url: "https://photos.biyen.id/s/abc12345",
            ip: "192.168.1.50",
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            reason: "Pelanggaran hak cipta foto",
            createdAt: 1700000000000,
            isDisabled: false,
        },
        {
            id: 2,
            shareID: 102,
            url: "https://photos.biyen.id/s/spam-album",
            ip: "10.0.0.12",
            userAgent: "curl/7.68.0",
            reason: "Spam / Phishing link",
            createdAt: 1700000000000000, // microsecond timestamp
            isDisabled: true,
        },
        {
            id: 3,
            shareID: 103,
            url: "https://photos.biyen.id/s/xyz98765",
            ip: "172.16.0.4",
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
            reason: "Konten tidak pantas",
            createdAt: 1700000000, // second timestamp
            isDisabled: false,
        },
    ];

    describe("formatReportDate", () => {
        it("returns '-' for 0 or negative timestamps", () => {
            expect(formatReportDate(0)).toBe("-");
            expect(formatReportDate(-1)).toBe("-");
        });

        it("formats timestamps across units (seconds, milliseconds, microseconds)", () => {
            const fromMillis = formatReportDate(1700000000000);
            const fromSeconds = formatReportDate(1700000000);
            const fromMicros = formatReportDate(1700000000000000);

            expect(fromMillis).not.toBe("-");
            expect(fromSeconds).not.toBe("-");
            expect(fromMicros).not.toBe("-");
            expect(fromMillis).toContain("2023");
        });
    });

    describe("computeAbuseMetrics", () => {
        it("handles empty arrays", () => {
            expect(computeAbuseMetrics([])).toEqual({ total: 0, open: 0, resolved: 0 });
        });

        it("accurately tallies total, open, and resolved reports", () => {
            const metrics = computeAbuseMetrics(mockReports);
            expect(metrics.total).toBe(3);
            expect(metrics.open).toBe(2);
            expect(metrics.resolved).toBe(1);
        });
    });

    describe("filterAbuseReports", () => {
        it("returns all reports when filter is 'all' without query", () => {
            const result = filterAbuseReports({ reports: mockReports, filter: "all" });
            expect(result).toHaveLength(3);
        });

        it("filters open reports correctly", () => {
            const result = filterAbuseReports({ reports: mockReports, filter: "open" });
            expect(result).toHaveLength(2);
            expect(result.every((r) => !r.isDisabled)).toBe(true);
        });

        it("filters resolved reports correctly", () => {
            const result = filterAbuseReports({ reports: mockReports, filter: "resolved" });
            expect(result).toHaveLength(1);
            expect(result[0]?.id).toBe(2);
        });

        it("filters by search query matching url, reason, or ip", () => {
            const byReason = filterAbuseReports({
                reports: mockReports,
                filter: "all",
                searchQuery: "hak cipta",
            });
            expect(byReason).toHaveLength(1);
            expect(byReason[0]?.id).toBe(1);

            const byIp = filterAbuseReports({
                reports: mockReports,
                filter: "all",
                searchQuery: "10.0.0.12",
            });
            expect(byIp).toHaveLength(1);
            expect(byIp[0]?.id).toBe(2);
        });
    });
});
