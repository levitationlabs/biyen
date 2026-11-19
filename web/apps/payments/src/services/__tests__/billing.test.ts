import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseAndHandleRequest } from "../billing";
import {
    type FOSSBillingCheckoutRequest,
    createFOSSBillingCheckoutSession,
    handleFOSSBillingCheckout,
    isBiyenHostname,
    isEnteHostname,
    redirectToApp,
} from "../fossbilling";

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_BAD_GATEWAY = 502;
const PAYMENTS_ORIGIN = "https://payments-biyen.levitation.web.id";
const APP_GALLERY_URL = "https://app-biyen.levitation.web.id/gallery";
const API_ORIGIN = "https://api-biyen.levitation.web.id";
const SAMPLE_CHECKOUT_URL =
    "https://pay-biyen.levitation.web.id/order/checkout/session-42";

interface MockWindowLocation {
    href: string;
    origin: string;
    protocol: string;
    hostname: string;
    port: string;
    pathname: string;
    search: string;
}

const createMockLocation = (rawUrl: string): MockWindowLocation => {
    const parsed = new URL(rawUrl);
    return {
        href: parsed.href,
        origin: parsed.origin,
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port,
        pathname: parsed.pathname,
        search: parsed.search,
    };
};

const installWindowMock = (rawUrl: string): MockWindowLocation => {
    const location = createMockLocation(rawUrl);
    vi.stubGlobal("window", { location });
    return location;
};

const createJsonFetchResponse = (
    body: unknown,
    status: number = HTTP_STATUS_OK,
): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });

describe("FOSSBilling checkout & Biyen payment redirects", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe("createFOSSBillingCheckoutSession", () => {
        const sampleRequest: FOSSBillingCheckoutRequest = {
            productID: "biyen-pro-monthly",
            paymentToken: "tok_secret_123",
            action: "buy",
            redirectURL: APP_GALLERY_URL,
        };

        it("should POST checkout request with auth header and return validated checkoutURL", async () => {
            const fetchMock = vi
                .fn<typeof fetch>()
                .mockResolvedValue(
                    createJsonFetchResponse({ checkoutURL: SAMPLE_CHECKOUT_URL }),
                );
            vi.stubGlobal("fetch", fetchMock);

            const checkoutURL = await createFOSSBillingCheckoutSession(
                sampleRequest,
                `${API_ORIGIN}/`,
            );

            expect(checkoutURL).toBe(SAMPLE_CHECKOUT_URL);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock).toHaveBeenCalledWith(
                `${API_ORIGIN}/billing/fossbilling/checkout-session`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Auth-Token": "tok_secret_123",
                    },
                    body: JSON.stringify({
                        productID: "biyen-pro-monthly",
                        action: "buy",
                        redirectURL: APP_GALLERY_URL,
                    }),
                },
            );
        });

        it("should throw descriptive error when backend returns non-2xx HTTP status", async () => {
            const fetchMock = vi
                .fn<typeof fetch>()
                .mockResolvedValue(
                    createJsonFetchResponse(
                        { error: "upstream failure" },
                        HTTP_STATUS_BAD_GATEWAY,
                    ),
                );
            vi.stubGlobal("fetch", fetchMock);

            await expect(
                createFOSSBillingCheckoutSession(sampleRequest, API_ORIGIN),
            ).rejects.toThrow("HTTP 502");
        });

        it("should reject non-HTTP(S) checkoutURL schemes", async () => {
            const fetchMock = vi
                .fn<typeof fetch>()
                .mockResolvedValue(
                    createJsonFetchResponse({ checkoutURL: "javascript:alert(1)" }),
                );
            vi.stubGlobal("fetch", fetchMock);

            await expect(
                createFOSSBillingCheckoutSession(sampleRequest, API_ORIGIN),
            ).rejects.toThrow("Invalid checkout URL protocol");
        });
    });

    describe("handleFOSSBillingCheckout", () => {
        it("should redirect back to app with status=fail&reason=server_error when session creation fails", async () => {
            const location = installWindowMock(PAYMENTS_ORIGIN);
            const fetchMock = vi
                .fn<typeof fetch>()
                .mockResolvedValue(
                    createJsonFetchResponse({}, HTTP_STATUS_BAD_GATEWAY),
                );
            vi.stubGlobal("fetch", fetchMock);

            await handleFOSSBillingCheckout({
                productID: "biyen-pro-yearly",
                paymentToken: "tok_456",
                action: "buy",
                redirectURL: APP_GALLERY_URL,
            });

            expect(location.href).toBe(
                "https://app-biyen.levitation.web.id/gallery?status=fail&reason=server_error",
            );
        });
    });

    describe("parseAndHandleRequest", () => {
        it("should route action=buy to FOSSBilling checkout session and navigate to checkoutURL", async () => {
            const query = new URLSearchParams({
                productID: "biyen-starter",
                paymentToken: "tok_buy_1",
                action: "buy",
                redirectURL: APP_GALLERY_URL,
            });
            const location = installWindowMock(
                `${PAYMENTS_ORIGIN}/?${query.toString()}`,
            );
            const fetchMock = vi
                .fn<typeof fetch>()
                .mockResolvedValue(
                    createJsonFetchResponse({ checkoutURL: SAMPLE_CHECKOUT_URL }),
                );
            vi.stubGlobal("fetch", fetchMock);

            await parseAndHandleRequest();

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(location.href).toBe(SAMPLE_CHECKOUT_URL);
        });

        it("should route action=update to FOSSBilling checkout session and navigate to checkoutURL", async () => {
            const updateCheckoutURL =
                "https://pay-biyen.levitation.web.id/order/upgrade/session-99";
            const query = new URLSearchParams({
                productID: "biyen-family-2tb",
                paymentToken: "tok_update_2",
                action: "update",
                redirectURL: APP_GALLERY_URL,
            });
            const location = installWindowMock(
                `${PAYMENTS_ORIGIN}/?${query.toString()}`,
            );
            const fetchMock = vi
                .fn<typeof fetch>()
                .mockResolvedValue(
                    createJsonFetchResponse({ checkoutURL: updateCheckoutURL }),
                );
            vi.stubGlobal("fetch", fetchMock);

            await parseAndHandleRequest();

            expect(fetchMock).toHaveBeenCalledWith(
                expect.stringContaining("/billing/fossbilling/checkout-session"),
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify({
                        productID: "biyen-family-2tb",
                        action: "update",
                        redirectURL: APP_GALLERY_URL,
                    }),
                }),
            );
            expect(location.href).toBe(updateCheckoutURL);
        });

        it("should redirect /desktop-redirect directly to biyen://app/gallery preserving query string", async () => {
            const location = installWindowMock(
                `${PAYMENTS_ORIGIN}/desktop-redirect?status=success&order_id=77`,
            );

            await parseAndHandleRequest();

            expect(location.href).toBe(
                "biyen://app/gallery?status=success&order_id=77",
            );
        });

        it("should forward FOSSBilling return callback (fb_return=1) to redirectToApp", async () => {
            const query = new URLSearchParams({
                fb_return: "1",
                status: "success",
                redirectURL: APP_GALLERY_URL,
            });
            const location = installWindowMock(
                `${PAYMENTS_ORIGIN}/?${query.toString()}`,
            );

            await parseAndHandleRequest();

            expect(location.href).toBe(
                "https://app-biyen.levitation.web.id/gallery?status=success",
            );
        });

        it("should forward FOSSBilling return callback (fb_return=1) with pending status", async () => {
            const query = new URLSearchParams({
                fb_return: "1",
                status: "pending",
                redirectURL: APP_GALLERY_URL,
            });
            const location = installWindowMock(
                `${PAYMENTS_ORIGIN}/?${query.toString()}`,
            );

            await parseAndHandleRequest();

            expect(location.href).toBe(
                "https://app-biyen.levitation.web.id/gallery?status=pending",
            );
        });

        it("should convert /desktop-redirect in FOSSBilling return callback to biyen://app/gallery", async () => {
            const query = new URLSearchParams({
                fb_return: "1",
                status: "success",
                redirectURL: `${PAYMENTS_ORIGIN}/desktop-redirect`,
            });
            const location = installWindowMock(
                `${PAYMENTS_ORIGIN}/?${query.toString()}`,
            );

            await parseAndHandleRequest();

            expect(location.href).toBe("biyen://app/gallery?status=success");
        });
    });

    describe("cross-subdomain redirect validation", () => {
        it("should allow cross-subdomain redirects from payments-biyen.levitation.web.id to app-biyen.levitation.web.id/gallery", () => {
            const location = installWindowMock(PAYMENTS_ORIGIN);

            redirectToApp(APP_GALLERY_URL, "success");

            expect(location.href).toBe(
                "https://app-biyen.levitation.web.id/gallery?status=success",
            );
            expect(isBiyenHostname("app-biyen.levitation.web.id")).toBe(true);
            expect(isEnteHostname("web.ente.io")).toBe(true);
        });

        it("should reject untrusted external domains in redirectToApp", () => {
            installWindowMock(PAYMENTS_ORIGIN);

            expect(() =>
                redirectToApp("https://malicious.example.com/gallery", "success"),
            ).toThrow("Invalid payment redirect URL");
        });
    });
});
