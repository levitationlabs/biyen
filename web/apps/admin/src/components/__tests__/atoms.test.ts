import { describe, it, expect } from "vitest";
import { ADMIN_NAV_ITEMS, TERRACOTTA_PRIMARY } from "../layout/AdminSidebar";
import { DRAWER_WIDTH, WARM_ARCHIVAL_LIGHT, WARM_ARCHIVAL_DARK } from "../layout/AdminLayout";

describe("Admin Layout & Reusable Atoms contracts", () => {
    describe("AdminSidebar navigation", () => {
        it("should contain all required navigation links", () => {
            const expectedLinks = [
                { label: "Dashboard", href: "/" },
                { label: "Pengguna & Kuota", href: "/users" },
                { label: "Abuse Center", href: "/abuse" },
                { label: "Pemeliharaan Sistem", href: "/system" },
            ];

            expect(ADMIN_NAV_ITEMS).toHaveLength(4);
            ADMIN_NAV_ITEMS.forEach((item, index) => {
                expect(item.label).toBe(expectedLinks[index]?.label);
                expect(item.href).toBe(expectedLinks[index]?.href);
                expect(item.icon).toBeDefined();
            });
        });

        it("should adhere to Biyen Terracotta branding", () => {
            expect(TERRACOTTA_PRIMARY).toBe("#C8502E");
            expect(WARM_ARCHIVAL_LIGHT).toBe("#FAFAFA");
            expect(WARM_ARCHIVAL_DARK).toBe("#1F1916");
            expect(DRAWER_WIDTH).toBe(250);
        });
    });
});
