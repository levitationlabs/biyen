// Biyen Admin E2E — System Chromium Verification Runner
// Copyright 2026 Levitation — AGPL-3.0-or-later

import { chromium } from "@playwright/test";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    ESCROW_E2E_KEK_VERSION,
    ESCROW_E2E_REQUEST_CODE,
    registerMockRoutes,
    seedMockAdminSession,
} from "./mockRoutes.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, "../out");

const SERVER_PORT = 3020;
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_ERROR = 500;
const VIEWPORT_WIDTH = 1440;
const VIEWPORT_HEIGHT = 900;
const PAGE_SETTLE_MS = 1000;
const DRAWER_SETTLE_MS = 600;
const MODAL_SETTLE_MS = 500;
const MODAL_CLOSE_SETTLE_MS = 300;
const MIN_DASHBOARD_CARDS = 3;
const CHROMIUM_EXECUTABLE_PATH = "/usr/bin/chromium-browser";
const REPORT_SCREENSHOT_DIR = "/tmp/biyen-e2e-screenshots";

const MIME_TYPES = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
};

function resolveStaticFilePath(urlString) {
    let reqPath = urlString.split("?")[0];
    if (reqPath === "/") reqPath = "/index.html";

    let filePath = path.join(outDir, reqPath);
    if (!fs.existsSync(filePath) && fs.existsSync(filePath + ".html")) {
        filePath = filePath + ".html";
    } else if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        const indexInDir = path.join(filePath, "index.html");
        if (fs.existsSync(indexInDir)) filePath = indexInDir;
    }

    if (!fs.existsSync(filePath)) {
        filePath = path.join(outDir, "index.html");
    }
    return filePath;
}

const server = http.createServer((req, res) => {
    const filePath = resolveStaticFilePath(req.url ?? "/");
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(HTTP_STATUS_ERROR);
            res.end("Server Error");
            return;
        }
        res.writeHead(HTTP_STATUS_OK, { "Content-Type": contentType });
        res.end(content);
    });
});

async function verifyDashboardPage(page, assert) {
    console.log("\n🧪 [Test 1] Testing Dashboard Overview (/)...\n");
    await page.goto(`http://localhost:${SERVER_PORT}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(PAGE_SETTLE_MS);

    const pageTitle = await page.title();
    assert(pageTitle.includes("Admin"), "Page title contains 'Admin': " + pageTitle);

    const welcomeText = await page.locator("body").textContent();
    assert(welcomeText.includes("Biyen Admin"), "Body contains 'Biyen Admin'");
    assert(welcomeText.includes("Dashboard") || welcomeText.includes("Overview"), "Contains Dashboard header");

    const cardCount = await page.locator(".MuiCard-root").count();
    assert(cardCount >= MIN_DASHBOARD_CARDS, "StatCards rendered on dashboard, count: " + cardCount);
    assert(welcomeText.includes("Sudo"), "Header contains Sudo status pill");
    assert(welcomeText.includes("Pengguna") || welcomeText.includes("Users"), "Sidebar contains Users link");
    assert(welcomeText.includes("Abuse"), "Sidebar contains Abuse navigation link");
    assert(welcomeText.includes("Sistem") || welcomeText.includes("System"), "Sidebar contains System link");

    await page.screenshot({ path: `${REPORT_SCREENSHOT_DIR}/01-dashboard.png`, fullPage: true });
    console.log(`  📸 Screenshot saved: ${REPORT_SCREENSHOT_DIR}/01-dashboard.png`);
}

async function verifyUsersAndEscrowDrawer(page, assert) {
    console.log("\n🧪 [Test 2] Testing User Management & Escrow Card (/users)...\n");
    await page.goto(`http://localhost:${SERVER_PORT}/users`, { waitUntil: "networkidle" });
    await page.waitForTimeout(PAGE_SETTLE_MS);

    const usersContent = await page.locator("body").textContent();
    assert(usersContent.includes("Pengguna"), "Header contains 'Pengguna'");

    const searchInput = page
        .locator('input[placeholder*="Cari"], input[placeholder*="cari"], input[type="text"]')
        .first();
    assert(await searchInput.isVisible(), "Search input bar is visible");
    assert(usersContent.includes("Semua"), "Filter chip 'Semua' exists");
    assert(usersContent.includes("Aktif"), "Filter chip 'Aktif' exists");
    assert(usersContent.includes("Ditangguhkan"), "Filter chip 'Ditangguhkan' exists");
    assert(usersContent.includes("User ID") || usersContent.includes("ID"), "Table has User ID column");
    assert(usersContent.includes("Email"), "Table has Email column");
    assert(usersContent.includes("Status"), "Table has Status column");
    assert(usersContent.includes("Keamanan") || usersContent.includes("2FA"), "Table has Security column");
    assert(usersContent.includes("Aksi") || usersContent.includes("Action"), "Table has Action column");

    await page.screenshot({ path: `${REPORT_SCREENSHOT_DIR}/02-users-table.png`, fullPage: true });
    console.log(`  📸 Screenshot saved: ${REPORT_SCREENSHOT_DIR}/02-users-table.png`);

    const manageButton = page.locator('button:has-text("Kelola"), button:has-text("Detail")').first();
    if (!(await manageButton.isVisible())) return;

    console.log("  👉 Clicking 'Kelola' button to test UserDetailDrawer & Escrow Card...");
    await manageButton.click();
    await page.waitForTimeout(DRAWER_SETTLE_MS);

    const drawerContent = await page.locator("body").textContent();
    assert(drawerContent.includes("Penyimpanan") || drawerContent.includes("Storage"), "Drawer shows storage");
    assert(drawerContent.includes("Sesi") || drawerContent.includes("Session"), "Drawer shows sessions");
    assert(drawerContent.includes("Ubah Kuota") || drawerContent.includes("Kuota"), "Drawer has 'Ubah Kuota'");
    assert(drawerContent.includes("Tangguhkan") || drawerContent.includes("Suspend"), "Drawer has 'Suspend'");

    await page.screenshot({ path: `${REPORT_SCREENSHOT_DIR}/03-users-drawer.png` });
    console.log(`  📸 Screenshot saved: ${REPORT_SCREENSHOT_DIR}/03-users-drawer.png`);

    const escrowCard = page.locator('[data-testid="user-drawer-escrow-card"]');
    const isEscrowVisible = await escrowCard.isVisible();
    assert(isEscrowVisible, "Status Brankas Escrow card is visible in UserDetailDrawer");

    if (isEscrowVisible) {
        await escrowCard.scrollIntoViewIfNeeded();
        await page.waitForTimeout(MODAL_CLOSE_SETTLE_MS);
    }

    const escrowCardText = (await escrowCard.textContent()) ?? "";
    assert(escrowCardText.includes("Status Brankas Escrow"), "Escrow card displays 'Status Brankas Escrow'");
    assert(escrowCardText.includes("Managed"), "Escrow card displays 'Managed' protection mode badge");
    assert(
        escrowCardText.includes("X-Wing") && escrowCardText.includes("MLKEM768-X25519"),
        "Escrow card displays 'X-Wing MLKEM768-X25519' cipher suite",
    );
    assert(
        escrowCardText.includes(ESCROW_E2E_KEK_VERSION),
        "Escrow card displays KEK version '" + ESCROW_E2E_KEK_VERSION + "'",
    );
    assert(
        escrowCardText.includes(ESCROW_E2E_REQUEST_CODE),
        "Escrow card displays pending request_code '" + ESCROW_E2E_REQUEST_CODE + "'",
    );
    assert(
        escrowCardText.includes("escrow-admin approve"),
        "Escrow card displays offline CLI 'escrow-admin approve' notice",
    );

    await page.screenshot({ path: `${REPORT_SCREENSHOT_DIR}/03b-users-drawer-escrow.png` });
    console.log(`  📸 Screenshot saved: ${REPORT_SCREENSHOT_DIR}/03b-users-drawer-escrow.png`);

    const suspendBtn = page.locator('button:has-text("Tangguhkan Akun"), button:has-text("Suspend")').first();
    if (await suspendBtn.isVisible()) {
        console.log("  👉 Clicking 'Tangguhkan Akun' to test SuspendModal warning banner...");
        await suspendBtn.click();
        await page.waitForTimeout(MODAL_SETTLE_MS);

        const suspendModalText = await page.locator("body").textContent();
        assert(
            suspendModalText.includes("dihapus permanen") || suspendModalText.includes("masa aktif langganan"),
            "SuspendModal displays mandatory warning about permanent data deletion at subscription end",
        );

        await page.screenshot({ path: `${REPORT_SCREENSHOT_DIR}/04-suspend-modal-warning.png` });
        console.log(`  📸 Screenshot saved: ${REPORT_SCREENSHOT_DIR}/04-suspend-modal-warning.png`);

        const cancelBtn = page.locator('button:has-text("Batal"), button:has-text("Tutup")').first();
        if (await cancelBtn.isVisible()) await cancelBtn.click();
        await page.waitForTimeout(MODAL_CLOSE_SETTLE_MS);
    }
}

async function verifyAbuseAndSystemPages(page, assert) {
    console.log("\n🧪 [Test 3] Testing Abuse Center (/abuse)...\n");
    await page.goto(`http://localhost:${SERVER_PORT}/abuse`, { waitUntil: "networkidle" });
    await page.waitForTimeout(PAGE_SETTLE_MS);

    const abuseContent = await page.locator("body").textContent();
    assert(abuseContent.includes("Abuse") || abuseContent.includes("Pelanggaran"), "Header contains Abuse title");
    assert(abuseContent.includes("Total Laporan") || abuseContent.includes("Laporan"), "Abuse stats rendered");
    assert(abuseContent.includes("Semua") || abuseContent.includes("Tindakan"), "Abuse tab filters rendered");

    await page.screenshot({ path: `${REPORT_SCREENSHOT_DIR}/05-abuse-center.png`, fullPage: true });
    console.log(`  📸 Screenshot saved: ${REPORT_SCREENSHOT_DIR}/05-abuse-center.png`);

    console.log("\n🧪 [Test 4] Testing System Operations (/system)...\n");
    await page.goto(`http://localhost:${SERVER_PORT}/system`, { waitUntil: "networkidle" });
    await page.waitForTimeout(PAGE_SETTLE_MS);

    const systemContent = await page.locator("body").textContent();
    assert(systemContent.includes("Pemeliharaan") || systemContent.includes("Operasi"), "System header exists");
    assert(systemContent.includes("Hitung Ulang") || systemContent.includes("Recalculat"), "Recalculate panel");
    assert(systemContent.includes("Antrean") || systemContent.includes("Queue"), "Queue Re-queue panel");
    assert(systemContent.includes("Email") || systemContent.includes("Mailer"), "System Mailer panel");

    await page.screenshot({ path: `${REPORT_SCREENSHOT_DIR}/06-system-ops.png`, fullPage: true });
    console.log(`  📸 Screenshot saved: ${REPORT_SCREENSHOT_DIR}/06-system-ops.png`);
}

async function runE2ETests() {
    console.log("🚀 Starting Biyen Admin E2E Static Server on port " + SERVER_PORT + "...");
    await new Promise((resolve) => server.listen(SERVER_PORT, resolve));
    console.log("✅ Static server running at http://localhost:" + SERVER_PORT);

    console.log("🌐 Launching Chromium browser at " + CHROMIUM_EXECUTABLE_PATH + "...");
    const browser = await chromium.launch({
        executablePath: CHROMIUM_EXECUTABLE_PATH,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });

    const context = await browser.newContext({
        viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
        deviceScaleFactor: 1,
    });

    await seedMockAdminSession(context);
    await registerMockRoutes(context);

    const page = await context.newPage();
    if (!fs.existsSync(REPORT_SCREENSHOT_DIR)) {
        fs.mkdirSync(REPORT_SCREENSHOT_DIR, { recursive: true });
    }

    let testsPassed = 0;
    let testsFailed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log("  ✅ PASS: " + message);
            testsPassed++;
        } else {
            console.error("  ❌ FAIL: " + message);
            testsFailed++;
        }
    }

    try {
        await verifyDashboardPage(page, assert);
        await verifyUsersAndEscrowDrawer(page, assert);
        await verifyAbuseAndSystemPages(page, assert);
    } catch (err) {
        console.error("❌ Unexpected Error in E2E Test:", err);
        testsFailed++;
    } finally {
        await browser.close();
        server.close();
    }

    console.log("\n========================================================");
    console.log(`📊 E2E TEST SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
    console.log("========================================================\n");

    if (testsFailed > 0) {
        process.exit(1);
    }
}

runE2ETests();
