import type { AbuseReport } from "@/types/admin";

export interface AbuseMetrics {
    total: number;
    open: number;
    resolved: number;
}

export type AbuseStatusFilter = "all" | "open" | "resolved";

export interface FilterAbuseReportsOptions {
    reports: AbuseReport[];
    filter: AbuseStatusFilter;
    searchQuery?: string;
}

const MICROSECOND_THRESHOLD = 1e14;
const MILLISECOND_THRESHOLD = 1e11;

export function formatReportDate(timestamp: number): string {
    if (!timestamp || isNaN(timestamp) || timestamp <= 0) {
        return "-";
    }

    let millis = timestamp;
    if (timestamp > MICROSECOND_THRESHOLD) {
        millis = Math.floor(timestamp / 1000);
    } else if (timestamp < MILLISECOND_THRESHOLD) {
        millis = timestamp * 1000;
    }

    try {
        return new Intl.DateTimeFormat("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(millis));
    } catch {
        return new Date(millis).toLocaleString("id-ID");
    }
}

export function computeAbuseMetrics(reports: AbuseReport[]): AbuseMetrics {
    if (!reports || reports.length === 0) {
        return { total: 0, open: 0, resolved: 0 };
    }

    let open = 0;
    let resolved = 0;

    for (const report of reports) {
        if (report.isDisabled) {
            resolved += 1;
        } else {
            open += 1;
        }
    }

    return {
        total: reports.length,
        open,
        resolved,
    };
}

export function filterAbuseReports(options: FilterAbuseReportsOptions): AbuseReport[] {
    const { reports, filter, searchQuery } = options;
    if (!reports || reports.length === 0) {
        return [];
    }

    const trimmedQuery = searchQuery ? searchQuery.trim().toLowerCase() : "";

    return reports.filter((report) => {
        // Status filter guard
        if (filter === "open" && report.isDisabled) {
            return false;
        }
        if (filter === "resolved" && !report.isDisabled) {
            return false;
        }

        // Search query filter guard
        if (!trimmedQuery) {
            return true;
        }

        const matchUrl = report.url?.toLowerCase().includes(trimmedQuery) ?? false;
        const matchReason = report.reason?.toLowerCase().includes(trimmedQuery) ?? false;
        const matchIp = report.ip?.toLowerCase().includes(trimmedQuery) ?? false;
        const matchShareId = String(report.shareID).includes(trimmedQuery);

        return matchUrl || matchReason || matchIp || matchShareId;
    });
}
