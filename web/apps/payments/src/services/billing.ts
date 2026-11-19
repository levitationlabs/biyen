import { loadStripe } from "@stripe/stripe-js";
import * as fb from "./fossbilling";
import type { FOSSBillingCheckoutRequest, PendingPaymentContext, StripeAccountCountry } from "./fossbilling";

export * from "./fossbilling";

const PAYMENT_INTENT_POLL_INTERVAL_MS = 2_000;
const PAYMENT_INTENT_POLL_TIMEOUT_MS = 300_000;
const STRIPE_PROVIDER_NAME = "stripe";
const DEFAULT_STRIPE_US_KEY =
    "pk_live_51LZ9P4G1ITnQlpAnrP6pcS7NiuJo3SnJ7gibjJlMRatkrd2EY1zlMVTVQG5RkSpLPbsHQzFfnEtgHnk1PiylIFkk00tC0LWXwi";
const DEFAULT_STRIPE_IN_KEY =
    "pk_live_51HAhqDK59oeucIMOiTI6MDDM2UWUbCAJXJCGsvjJhiO8nYJz38rQq5T4iyQLDMKxqEDUfU5Hopuj4U5U4dff23oT00fHvZeodC";

type StripeJS = NonNullable<Awaited<ReturnType<typeof loadStripe>>>;
type PaymentStatus = "success" | "requires_action" | "requires_payment_method";

interface UpdateStripeSubscriptionResponse {
    status: PaymentStatus;
    clientSecret: string;
}

const isStripeProviderConfigured = (): boolean =>
    import.meta.env.VITE_PAYMENT_PROVIDER === STRIPE_PROVIDER_NAME;

export const parseAndHandleRequest = async (): Promise<void> => {
    if (window.location.pathname === fb.DESKTOP_REDIRECT_PATH) {
        fb.redirectDesktopGallery(window.location.search);
        return;
    }

    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (fb.handleFOSSBillingReturnCallback(urlParams)) return;

        if (urlParams.get("payment_intent_client_secret")) {
            await handlePaymentIntentCallback(urlParams);
            return;
        }

        const productID = urlParams.get("productID");
        const paymentToken = urlParams.get("paymentToken");
        const action = urlParams.get("action");
        const redirectURL = urlParams.get("redirectURL");

        if (!action && !paymentToken && !productID && !redirectURL) {
            fb.redirectHome();
            return;
        }
        if (!action || !paymentToken || !productID || !redirectURL) {
            throw new Error("Required query parameter was not provided");
        }
        if (!fb.isCheckoutAction(action)) {
            throw new Error(`Unsupported action ${action}`);
        }

        const req: FOSSBillingCheckoutRequest = { productID, paymentToken, action, redirectURL };
        if (!isStripeProviderConfigured()) {
            await fb.handleFOSSBillingCheckout(req);
            return;
        }
        if (action === "buy") {
            await buySubscription(req);
            return;
        }
        await updateSubscription(req);
    } catch (error) {
        console.error(error);
        throw fb.ensureError(error);
    }
};

const handlePaymentIntentCallback = async (urlParams: URLSearchParams): Promise<void> => {
    const clientSecret = urlParams.get("payment_intent_client_secret") ?? "";
    const redirectURL = urlParams.get("redirectURL");
    const accountCountry = urlParams.get("accountCountry");
    const pending = fb.getPendingPaymentContext();
    const clientRedirectURL = redirectURL ?? pending?.redirectURL ?? null;
    const clientAccountCountry = fb.isStripeAccountCountry(accountCountry)
        ? accountCountry
        : (pending?.accountCountry ?? null);

    try {
        await handlePaymentIntentRedirect(clientSecret, clientAccountCountry, clientRedirectURL);
    } catch (error) {
        console.error(error);
        fb.clearPendingPaymentContext();
        if (clientRedirectURL) {
            fb.redirectToApp(clientRedirectURL, "fail", "server_error");
            return;
        }
        throw fb.ensureError(error);
    }
};

const stripePublishableKey = (accountCountry: StripeAccountCountry): string =>
    accountCountry === "US"
        ? (import.meta.env.VITE_STRIPE_US_PUBLISHABLE_KEY ?? DEFAULT_STRIPE_US_KEY)
        : (import.meta.env.VITE_STRIPE_IN_PUBLISHABLE_KEY ?? DEFAULT_STRIPE_IN_KEY);

const getUserStripeAccountCountry = async (paymentToken: string): Promise<StripeAccountCountry> => {
    const url = `${fb.getApiOrigin()}/billing/stripe-account-country`;
    const res = await fetch(url, { headers: { "X-Auth-Token": paymentToken } });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
    const json: unknown = await res.json();
    if (fb.isRecord(json) && fb.isStripeAccountCountry(json.stripeAccountCountry)) {
        return json.stripeAccountCountry;
    }
    throw new Error(`Unexpected response for ${url}: ${JSON.stringify(json)}`);
};

const getStripe = async (
    redirectURL: string,
    accountCountry: StripeAccountCountry,
): Promise<StripeJS> => {
    try {
        const stripe = await loadStripe(stripePublishableKey(accountCountry));
        if (!stripe) throw new Error("Failed to load Stripe");
        return stripe;
    } catch (error) {
        fb.redirectToApp(redirectURL, "fail", "stripe_error");
        throw fb.ensureError(error);
    }
};

const buySubscription = async (req: FOSSBillingCheckoutRequest): Promise<void> => {
    try {
        const country = await getUserStripeAccountCountry(req.paymentToken);
        const stripe = await getStripe(req.redirectURL, country);
        const sessionId = await createStripeCheckoutSession(req);
        await stripe.redirectToCheckout({ sessionId });
    } catch (error) {
        fb.redirectToApp(req.redirectURL, "fail", "server_error");
        throw fb.ensureError(error);
    }
};

const createStripeCheckoutSession = async (req: FOSSBillingCheckoutRequest): Promise<string> => {
    const params = new URLSearchParams({
        productID: req.productID,
        redirectURL: req.redirectURL,
    });
    const url = `${fb.getApiOrigin()}/billing/stripe/checkout-session?${params.toString()}`;
    const res = await fetch(url, { headers: { "X-Auth-Token": req.paymentToken } });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
    const json: unknown = await res.json();
    if (fb.isRecord(json) && typeof json.sessionID === "string") {
        return json.sessionID;
    }
    throw new Error(`Unexpected response for ${url}: ${JSON.stringify(json)}`);
};

const updateSubscription = async (req: FOSSBillingCheckoutRequest): Promise<void> => {
    try {
        const country = await getUserStripeAccountCountry(req.paymentToken);
        const stripe = await getStripe(req.redirectURL, country);
        const { status, clientSecret } = await updateStripeSubscription(
            req.paymentToken,
            req.productID,
        );
        if (status === "success") {
            fb.redirectToApp(req.redirectURL, "success");
            return;
        }
        if (status === "requires_payment_method") {
            fb.redirectToApp(req.redirectURL, "fail", "requires_payment_method");
            return;
        }
        await confirmStripeActionRequired(stripe, clientSecret, {
            accountCountry: country,
            redirectURL: req.redirectURL,
        });
    } catch (error) {
        fb.redirectToApp(req.redirectURL, "fail", "server_error");
        throw fb.ensureError(error);
    }
};

const confirmStripeActionRequired = async (
    stripe: StripeJS,
    clientSecret: string,
    context: PendingPaymentContext,
): Promise<void> => {
    fb.setPendingPaymentContext(context);
    const returnUrl = stripeConfirmationReturnURL(context.redirectURL, context.accountCountry);
    const result = await stripe.confirmPayment({
        clientSecret,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
    });
    if (result.error) {
        fb.clearPendingPaymentContext();
        handleStripeConfirmError(context.redirectURL, result.error);
        return;
    }
    const terminalStatus = await waitForTerminalPaymentIntentStatus(
        stripe,
        clientSecret,
        result.paymentIntent.status,
    );
    fb.clearPendingPaymentContext();
    fb.redirectForPaymentIntentStatus(context.redirectURL, terminalStatus);
};

const handleStripeConfirmError = (
    redirectURL: string,
    error: { type?: string; code?: string },
): void => {
    if (error.type === "card_error") {
        fb.redirectToApp(redirectURL, "fail", "requires_payment_method");
        return;
    }
    if (
        error.type === "authentication_error" ||
        error.code === "payment_intent_authentication_failure"
    ) {
        fb.redirectToApp(redirectURL, "fail", "authentication_failed");
        return;
    }
    fb.redirectToApp(redirectURL, "fail");
};

const isPaymentStatus = (s: unknown): s is PaymentStatus =>
    s === "success" || s === "requires_action" || s === "requires_payment_method";

const handlePaymentIntentRedirect = async (
    clientSecret: string,
    accountCountry: StripeAccountCountry | null,
    redirectURL: string | null,
): Promise<void> => {
    if (!accountCountry || !redirectURL) {
        throw new Error("Required query parameter was not provided for payment confirmation");
    }
    const stripe = await getStripe(redirectURL, accountCountry);
    const result = await stripe.retrievePaymentIntent(clientSecret);
    if (result.error) throw fb.ensureError(result.error);
    const status = await waitForTerminalPaymentIntentStatus(
        stripe,
        clientSecret,
        result.paymentIntent.status,
    );
    fb.clearPendingPaymentContext();
    fb.redirectForPaymentIntentStatus(redirectURL, status);
};

const waitForTerminalPaymentIntentStatus = async (
    stripe: StripeJS,
    clientSecret: string,
    initialStatus: string,
): Promise<string> => {
    let status = initialStatus;
    const deadline = Date.now() + PAYMENT_INTENT_POLL_TIMEOUT_MS;
    while (status === "processing" && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, PAYMENT_INTENT_POLL_INTERVAL_MS));
        const result = await stripe.retrievePaymentIntent(clientSecret);
        if (result.error) throw fb.ensureError(result.error);
        status = result.paymentIntent.status;
    }
    return status;
};

const stripeConfirmationReturnURL = (
    redirectURL: string,
    accountCountry: StripeAccountCountry,
): string => {
    const url = new URL(window.location.href);
    url.searchParams.delete("paymentToken");
    url.searchParams.delete("productID");
    url.searchParams.delete("action");
    url.searchParams.set("redirectURL", redirectURL);
    url.searchParams.set("accountCountry", accountCountry);
    return url.href;
};

const updateStripeSubscription = async (
    paymentToken: string,
    productID: string,
): Promise<UpdateStripeSubscriptionResponse> => {
    const url = `${fb.getApiOrigin()}/billing/stripe/update-subscription`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "X-Auth-Token": paymentToken },
        body: JSON.stringify({ productID }),
    });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
    const json: unknown = await res.json();
    if (
        fb.isRecord(json) &&
        fb.isRecord(json.result) &&
        isPaymentStatus(json.result.status) &&
        typeof json.result.clientSecret === "string"
    ) {
        return { status: json.result.status, clientSecret: json.result.clientSecret };
    }
    throw new Error(`Unexpected response for ${url}: ${JSON.stringify(json)}`);
};
