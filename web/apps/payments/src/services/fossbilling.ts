export type CheckoutAction = "buy" | "update";
export type RedirectStatus = "success" | "fail" | "pending";
export type StripeAccountCountry = "US" | "IN";
export type FailureReason =
    | "authentication_failed"
    | "requires_payment_method"
    | "stripe_error"
    | "canceled"
    | "server_error";

export interface FOSSBillingCheckoutRequest {
    productID: string;
    paymentToken: string;
    action: CheckoutAction;
    redirectURL: string;
}

export interface PendingPaymentContext {
    accountCountry: StripeAccountCountry;
    redirectURL: string;
}

const DEFAULT_API_ORIGIN = "https://api-biyen.levitation.web.id";
const DEFAULT_APP_HOME_URL = "https://app-biyen.levitation.web.id";
export const DESKTOP_REDIRECT_PATH = "/desktop-redirect";
export const DESKTOP_APP_GALLERY_URL = "biyen://app/gallery";
const FOSSBILLING_CHECKOUT_PATH = "/billing/fossbilling/checkout-session";
const FOSSBILLING_RETURN_FLAG = "1";
const PENDING_PAYMENT_CONTEXT_STORAGE_KEY = "biyen.payments.pending-context";
const BIYEN_DOMAIN_ROOT = "levitation.web.id";
const BIYEN_DOMAIN_SUFFIX = ".levitation.web.id";
const ENTE_DOMAIN_SUFFIXES = [".ente.com", ".ente.io", ".ente.sh"] as const;

const PAYMENT_INTENT_FAILURE_REASONS: Readonly<Record<string, FailureReason | undefined>> = {
    processing: "server_error",
    requires_payment_method: "requires_payment_method",
    requires_action: "authentication_failed",
    canceled: "canceled",
};

export const isRecord = (val: unknown): val is Record<string, unknown> =>
    Boolean(val) && typeof val === "object";

export const getApiOrigin = (): string =>
    import.meta.env.VITE_ENTE_ENDPOINT ??
    import.meta.env.VITE_BIYEN_ENDPOINT ??
    DEFAULT_API_ORIGIN;

export const ensureError = (error: unknown): Error =>
    error instanceof Error ? error : new Error(String(error));

export const isCheckoutAction = (value: unknown): value is CheckoutAction =>
    value === "buy" || value === "update";

export const isStripeAccountCountry = (c: unknown): c is StripeAccountCountry =>
    c === "US" || c === "IN";

export const isRedirectStatus = (value: unknown): value is RedirectStatus =>
    value === "success" || value === "fail" || value === "pending";

export const isFailureReason = (value: unknown): value is FailureReason =>
    value === "authentication_failed" ||
    value === "requires_payment_method" ||
    value === "stripe_error" ||
    value === "canceled" ||
    value === "server_error";

export const isBiyenHostname = (hostname: string): boolean =>
    hostname === BIYEN_DOMAIN_ROOT || hostname.endsWith(BIYEN_DOMAIN_SUFFIX);

export const isEnteHostname = (hostname: string): boolean =>
    ENTE_DOMAIN_SUFFIXES.some((suffix) => hostname.endsWith(suffix));

const isTrustedRedirectHostname = (hostname: string): boolean =>
    isBiyenHostname(hostname) || isEnteHostname(hostname);

export const validateHttpURL = (rawURL: string): string => {
    let parsed: URL;
    try {
        parsed = new URL(rawURL);
    } catch {
        throw new Error(`Invalid checkout URL: ${rawURL}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error(`Invalid checkout URL protocol: ${parsed.protocol}`);
    }
    return rawURL;
};

const extractNestedCheckoutURL = (nested: unknown): string | null =>
    isRecord(nested) && typeof nested.checkoutURL === "string" ? nested.checkoutURL : null;

const extractCheckoutURL = (payload: unknown): string => {
    if (!isRecord(payload)) throw new Error("Unexpected checkout session response");
    const rawCheckoutURL =
        typeof payload.checkoutURL === "string"
            ? payload.checkoutURL
            : extractNestedCheckoutURL(payload.data ?? payload.result);
    if (!rawCheckoutURL) {
        throw new Error(`Unexpected checkout session response: ${JSON.stringify(payload)}`);
    }
    return validateHttpURL(rawCheckoutURL);
};

export const createFOSSBillingCheckoutSession = async (
    req: FOSSBillingCheckoutRequest,
    apiOrigin: string = getApiOrigin(),
): Promise<string> => {
    const url = `${apiOrigin.replace(/\/+$/, "")}${FOSSBILLING_CHECKOUT_PATH}`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Auth-Token": req.paymentToken,
        },
        body: JSON.stringify({
            productID: req.productID,
            action: req.action,
            redirectURL: req.redirectURL,
        }),
    });
    if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
    const payload: unknown = await response.json();
    return extractCheckoutURL(payload);
};

const defaultNavigate = (url: string): void => {
    window.location.href = url;
};

export const handleFOSSBillingCheckout = async (
    req: FOSSBillingCheckoutRequest,
    navigate: (url: string) => void = defaultNavigate,
): Promise<void> => {
    try {
        const checkoutURL = await createFOSSBillingCheckoutSession(req);
        navigate(checkoutURL);
    } catch (error) {
        console.error(error);
        redirectToApp(req.redirectURL, "fail", "server_error");
    }
};

export const handleFOSSBillingReturnCallback = (urlParams: URLSearchParams): boolean => {
    const redirectURL = urlParams.get("redirectURL");
    const fbReturn = urlParams.get("fb_return");
    const rawStatus = urlParams.get("status");
    const isCallback = fbReturn === FOSSBILLING_RETURN_FLAG || isRedirectStatus(rawStatus);
    if (!isCallback || !redirectURL) return false;

    const status: RedirectStatus = isRedirectStatus(rawStatus) ? rawStatus : "success";
    const rawReason = urlParams.get("reason");
    const reason = status === "fail" && isFailureReason(rawReason) ? rawReason : undefined;
    redirectToApp(redirectURL, status, reason);
    return true;
};

const parseRedirectTarget = (redirectURL: string): URL =>
    redirectURL.startsWith("/")
        ? new URL(redirectURL, window.location.origin)
        : new URL(redirectURL);

export const redirectToApp = (
    redirectURL: string,
    status: RedirectStatus,
    reason?: FailureReason | undefined,
): void => {
    let url = parseRedirectTarget(redirectURL);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Invalid payment redirect URL");
    }
    const isSameOrigin = url.origin === window.location.origin;
    const isDevURL = import.meta.env.DEV && url.hostname === window.location.hostname;
    const isTrustedHTTPS =
        url.protocol === "https:" &&
        url.port === "" &&
        isTrustedRedirectHostname(url.hostname);
    if (!isSameOrigin && !isDevURL && !isTrustedHTTPS) {
        throw new Error("Invalid payment redirect URL");
    }
    if (url.pathname === DESKTOP_REDIRECT_PATH) {
        url = new URL(DESKTOP_APP_GALLERY_URL);
    }
    url.searchParams.set("status", status);
    if (reason) url.searchParams.set("reason", reason);
    else url.searchParams.delete("reason");
    window.location.href = url.href;
};

export const redirectForPaymentIntentStatus = (redirectURL: string, status: string): void => {
    if (status === "succeeded") {
        redirectToApp(redirectURL, "success");
        return;
    }
    redirectToApp(redirectURL, "fail", PAYMENT_INTENT_FAILURE_REASONS[status]);
};

export const getPendingPaymentContext = (): PendingPaymentContext | null => {
    try {
        const value = sessionStorage.getItem(PENDING_PAYMENT_CONTEXT_STORAGE_KEY);
        if (!value) return null;
        const json: unknown = JSON.parse(value);
        if (
            isRecord(json) &&
            isStripeAccountCountry(json.accountCountry) &&
            typeof json.redirectURL === "string"
        ) {
            return { accountCountry: json.accountCountry, redirectURL: json.redirectURL };
        }
    } catch (error) {
        console.error("Failed to read pending payment context", error);
    }
    return null;
};

export const setPendingPaymentContext = (context: PendingPaymentContext): void => {
    try {
        sessionStorage.setItem(PENDING_PAYMENT_CONTEXT_STORAGE_KEY, JSON.stringify(context));
    } catch (error) {
        console.error("Failed to persist pending payment context", error);
    }
};

export const clearPendingPaymentContext = (): void => {
    try {
        sessionStorage.removeItem(PENDING_PAYMENT_CONTEXT_STORAGE_KEY);
    } catch (error) {
        console.error("Failed to clear pending payment context", error);
    }
};

export const redirectDesktopGallery = (search: string): void => {
    const desktopRedirectURL = new URL(DESKTOP_APP_GALLERY_URL);
    desktopRedirectURL.search = search;
    window.location.href = desktopRedirectURL.href;
};

export const redirectHome = (): void => {
    window.location.href = DEFAULT_APP_HOME_URL;
};
