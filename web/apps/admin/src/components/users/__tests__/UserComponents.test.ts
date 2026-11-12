// Biyen Admin — User Components Definition & Contract Tests
// Copyright 2026 Levitation — AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { UserTable } from "../UserTable";
import { UserDetailDrawer, USER_DRAWER_WIDTH } from "../UserDetailDrawer";
import {
    UserDrawerHeader,
    UserDrawerStorage,
    UserDrawerSecurity,
    UserDrawerSessions,
    UserDrawerActions,
} from "../drawer";

describe("User Components Exports & Configuration", () => {
    it("exports UserTable as a valid component", () => {
        expect(typeof UserTable).toBe("function");
    });

    it("exports UserDetailDrawer as a valid component and defines drawer width", () => {
        expect(typeof UserDetailDrawer).toBe("function");
        expect(USER_DRAWER_WIDTH).toBe(480);
    });

    it("exports all drawer modular subcomponents", () => {
        expect(typeof UserDrawerHeader).toBe("function");
        expect(typeof UserDrawerStorage).toBe("function");
        expect(typeof UserDrawerSecurity).toBe("function");
        expect(typeof UserDrawerSessions).toBe("function");
        expect(typeof UserDrawerActions).toBe("function");
    });
});
