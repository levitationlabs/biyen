import { describe, it, expect } from "vitest";
import { formatBytes } from "../QuotaProgress";

describe("formatBytes utility", () => {
    it("should format 0 bytes correctly", () => {
        expect(formatBytes(0)).toBe("0 B");
        expect(formatBytes(-100)).toBe("0 B");
    });

    it("should format bytes into KB, MB, GB, and TB", () => {
        expect(formatBytes(500)).toBe("500 B");
        expect(formatBytes(1024)).toBe("1 KB");
        expect(formatBytes(1536)).toBe("1.5 KB");
        expect(formatBytes(1024 * 1024)).toBe("1 MB");
        expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GB");
        expect(formatBytes(12.4 * 1024 * 1024 * 1024)).toBe("12.4 GB");
        expect(formatBytes(100 * 1024 * 1024 * 1024)).toBe("100 GB");
        expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe("1 TB");
    });

    it("should handle custom decimal places", () => {
        expect(formatBytes(1234567, 2)).toBe("1.18 MB");
        expect(formatBytes(1234567, 0)).toBe("1 MB");
    });
});
