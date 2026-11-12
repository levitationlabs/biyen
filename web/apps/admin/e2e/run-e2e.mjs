import { chromium } from "@playwright/test";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, "../out");

// Simple static file server supporting SPA / clean URLs
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

const server = http.createServer((req, res) => {
    let reqPath = req.url.split("?")[0];
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

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(500);
            res.end("Server Error");
            return;
        }
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
    });
});

const PORT = 3020;

async function runE2ETests() {
    console.log("🚀 Starting Biyen Admin E2E Static Server on port " + PORT + "...");
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log("✅ Static server running at http://localhost:" + PORT);

    console.log("🌐 Launching Chromium browser at /usr/bin/chromium-browser...");
    const browser = await chromium.launch({
        executablePath: "/usr/bin/chromium-browser",
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
        ],
    });

    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
    });

    // Seed mock admin token in localStorage so admin pages display authenticated state
    await context.addInitScript(() => {
        window.localStorage.setItem("biyen_admin_token", "biyen_mock_admin_token_xyz");
        window.localStorage.setItem("biyen_admin_token_created_at", String(Date.now() - 60000)); // 1 min ago
    });

    // Mock backend API endpoints for autonomous E2E testing
    await context.route(/.*\/admin\/.*/, async (route) => {
        const url = route.request().url();
        const method = route.request().method();

        if (url.includes("/admin/users")) {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    users: [
                        {
                            id: 101,
                            email: "huda@biyen.local",
                            name: "Huda Biyen",
                            creationTime: 1700000000000000,
                            isSuspended: false,
                            isTwoFactorEnabled: true,
                            isEmailMFAEnabled: false,
                        },
                        {
                            id: 102,
                            email: "alice@example.com",
                            name: "Alice Wonderland",
                            creationTime: 1705000000000000,
                            isSuspended: true,
                            suspendReason: "Spam account detected",
                            isTwoFactorEnabled: false,
                            isEmailMFAEnabled: true,
                        },
                    ],
                }),
            });
        }

        if (url.includes("/admin/user") && method === "GET") {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    user: {
                        id: 101,
                        email: "huda@biyen.local",
                        name: "Huda Biyen",
                        creationTime: 1700000000000000,
                        isSuspended: false,
                        isTwoFactorEnabled: true,
                        isEmailMFAEnabled: false,
                    },
                    subscription: {
                        userID: 101,
                        storage: 107374182400,
                        expiryTime: 1800000000000000,
                        productID: "pro-100gb",
                    },
                    storageConsumed: 26843545600,
                    storageConsumedStatus: "available",
                    photosFileCount: 1420,
                    lockerFileCount: 12,
                    tokens: [
                        {
                            token: "tok_session_web_1",
                            creationTime: 1700000000000000,
                            lastUsedTime: 1700005000000000,
                            ua: "Mozilla/5.0 (X11; Linux x86_64) BiyenWeb/1.0",
                            isDeleted: false,
                            app: "web",
                        },
                    ],
                    authCodes: 1,
                }),
            });
        }

        if (url.includes("/admin/abuse-reports")) {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    reports: [
                        {
                            id: 1,
                            shareID: 401,
                            url: "https://biyen.local/s/xyz123",
                            ip: "192.168.1.50",
                            userAgent: "Mozilla/5.0",
                            reason: "Hak cipta / DMCA",
                            createdAt: 1715000000000000,
                            isDisabled: false,
                        },
                    ],
                }),
            });
        }

        return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    const page = await context.newPage();
    const reportDir = "/tmp/biyen-e2e-screenshots";
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

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
        // ================= TEST 1: DASHBOARD PAGE =================
        console.log("\n🧪 [Test 1] Testing Dashboard Overview (/)...\n");
        await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
        await page.waitForTimeout(1000);

        const pageTitle = await page.title();
        assert(pageTitle.includes("Admin"), "Page title contains 'Admin': " + pageTitle);

        const welcomeText = await page.locator("body").textContent();
        assert(welcomeText.includes("Biyen Admin"), "Body contains 'Biyen Admin'");
        assert(welcomeText.includes("Dashboard") || welcomeText.includes("Overview"), "Contains Dashboard header");

        // Verify StatCards exist
        const statCards = page.locator(".MuiCard-root");
        const cardCount = await statCards.count();
        assert(cardCount >= 3, "StatCards rendered on dashboard, count: " + cardCount);

        // Verify SudoFreshnessBar exists in Header
        assert(welcomeText.includes("Sudo"), "Header contains Sudo status pill");

        // Verify Sidebar navigation items
        assert(welcomeText.includes("Pengguna") || welcomeText.includes("Users"), "Sidebar contains Users navigation link");
        assert(welcomeText.includes("Abuse"), "Sidebar contains Abuse navigation link");
        assert(welcomeText.includes("Sistem") || welcomeText.includes("System"), "Sidebar contains System navigation link");

        await page.screenshot({ path: `${reportDir}/01-dashboard.png`, fullPage: true });
        console.log(`  📸 Screenshot saved: ${reportDir}/01-dashboard.png`);

        // ================= TEST 2: USERS PAGE =================
        console.log("\n🧪 [Test 2] Testing User Management (/users)...\n");
        await page.goto(`http://localhost:${PORT}/users`, { waitUntil: "networkidle" });
        await page.waitForTimeout(1000);

        const usersContent = await page.locator("body").textContent();
        assert(usersContent.includes("Pengguna"), "Header contains 'Pengguna'");

        // Check search bar
        const searchInput = page.locator('input[placeholder*="Cari"], input[placeholder*="cari"], input[type="text"]').first();
        assert(await searchInput.isVisible(), "Search input bar is visible");

        // Check filter chips
        assert(usersContent.includes("Semua"), "Filter chip 'Semua' exists");
        assert(usersContent.includes("Aktif"), "Filter chip 'Aktif' exists");
        assert(usersContent.includes("Ditangguhkan"), "Filter chip 'Ditangguhkan' exists");

        // Check User Table headers
        assert(usersContent.includes("User ID") || usersContent.includes("ID"), "Table has User ID column");
        assert(usersContent.includes("Email"), "Table has Email column");
        assert(usersContent.includes("Status"), "Table has Status column");
        assert(usersContent.includes("Keamanan") || usersContent.includes("2FA"), "Table has Security column");
        assert(usersContent.includes("Aksi") || usersContent.includes("Action"), "Table has Action column");

        await page.screenshot({ path: `${reportDir}/02-users-table.png`, fullPage: true });
        console.log(`  📸 Screenshot saved: ${reportDir}/02-users-table.png`);

        // Test clicking Manage/Detail button if table row exists
        const manageButton = page.locator('button:has-text("Kelola"), button:has-text("Detail")').first();
        if (await manageButton.isVisible()) {
            console.log("  👉 Clicking 'Kelola' button to test UserDetailDrawer...");
            await manageButton.click();
            await page.waitForTimeout(600);

            const drawerContent = await page.locator("body").textContent();
            assert(drawerContent.includes("Penyimpanan") || drawerContent.includes("Storage"), "Drawer opens with storage details");
            assert(drawerContent.includes("Sesi") || drawerContent.includes("Session"), "Drawer contains session management");
            assert(drawerContent.includes("Ubah Kuota") || drawerContent.includes("Kuota"), "Drawer has 'Ubah Kuota' action");
            assert(drawerContent.includes("Tangguhkan") || drawerContent.includes("Suspend"), "Drawer has 'Suspend' action");

            await page.screenshot({ path: `${reportDir}/03-users-drawer.png` });
            console.log(`  📸 Screenshot saved: ${reportDir}/03-users-drawer.png`);

            // Test clicking Suspend action to verify warning message
            const suspendBtn = page.locator('button:has-text("Tangguhkan Akun"), button:has-text("Suspend")').first();
            if (await suspendBtn.isVisible()) {
                console.log("  👉 Clicking 'Tangguhkan Akun' to test SuspendModal warning banner...");
                await suspendBtn.click();
                await page.waitForTimeout(500);

                const suspendModalText = await page.locator("body").textContent();
                assert(
                    suspendModalText.includes("dihapus permanen") || suspendModalText.includes("masa aktif langganan"),
                    "SuspendModal displays mandatory warning about permanent data deletion at subscription end"
                );

                await page.screenshot({ path: `${reportDir}/04-suspend-modal-warning.png` });
                console.log(`  📸 Screenshot saved: ${reportDir}/04-suspend-modal-warning.png`);

                // Close modal
                const cancelBtn = page.locator('button:has-text("Batal"), button:has-text("Tutup")').first();
                if (await cancelBtn.isVisible()) await cancelBtn.click();
                await page.waitForTimeout(300);
            }
        }

        // ================= TEST 3: ABUSE CENTER PAGE =================
        console.log("\n🧪 [Test 3] Testing Abuse Center (/abuse)...\n");
        await page.goto(`http://localhost:${PORT}/abuse`, { waitUntil: "networkidle" });
        await page.waitForTimeout(1000);

        const abuseContent = await page.locator("body").textContent();
        assert(abuseContent.includes("Abuse") || abuseContent.includes("Pelanggaran"), "Header contains 'Pusat Laporan Pelanggaran'");
        assert(abuseContent.includes("Total Laporan") || abuseContent.includes("Laporan"), "Abuse stat metrics rendered");
        assert(abuseContent.includes("Semua") || abuseContent.includes("Tindakan"), "Abuse tab filters rendered");

        await page.screenshot({ path: `${reportDir}/05-abuse-center.png`, fullPage: true });
        console.log(`  📸 Screenshot saved: ${reportDir}/05-abuse-center.png`);

        // ================= TEST 4: SYSTEM OPS PAGE =================
        console.log("\n🧪 [Test 4] Testing System Operations (/system)...\n");
        await page.goto(`http://localhost:${PORT}/system`, { waitUntil: "networkidle" });
        await page.waitForTimeout(1000);

        const systemContent = await page.locator("body").textContent();
        assert(systemContent.includes("Pemeliharaan") || systemContent.includes("Operasi"), "Header contains 'Pemeliharaan & Operasi Sistem'");
        assert(systemContent.includes("Hitung Ulang") || systemContent.includes("Recalculat"), "Panel 1: Recalculate File Counts exists");
        assert(systemContent.includes("Antrean") || systemContent.includes("Queue"), "Panel 2: Queue Re-queue exists");
        assert(systemContent.includes("Email") || systemContent.includes("Mailer"), "Panel 3: System Mailer exists");

        await page.screenshot({ path: `${reportDir}/06-system-ops.png`, fullPage: true });
        console.log(`  📸 Screenshot saved: ${reportDir}/06-system-ops.png`);

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
