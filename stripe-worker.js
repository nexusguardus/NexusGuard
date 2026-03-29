/**
 * NexusGuard — stripe-worker.js
 * Cloudflare Worker: Stripe Checkout Session creation
 *
 * Deploy:  npx wrangler deploy stripe-worker.js
 * Local:   npx wrangler dev stripe-worker.js
 *
 * Required secrets (set via `wrangler secret put`):
 *   - STRIPE_SECRET_KEY
 *
 * Required vars (wrangler.toml or dashboard):
 *   - STRIPE_PRICE_ID
 */

const ALLOWED_ORIGINS = [
  "http://localhost:8000",
  "https://nexusguard.puter.site",
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    // ── CORS preflight ──
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // ── POST /create-checkout-session ──
    if (url.pathname === "/create-checkout-session" && request.method === "POST") {
      try {
        const STRIPE_SECRET_KEY = env.STRIPE_SECRET_KEY;
        const STRIPE_PRICE_ID = env.STRIPE_PRICE_ID || "price_PLACEHOLDER";

        // Create Checkout Session via Stripe API
        const params = new URLSearchParams({
          "mode": "subscription",
          "line_items[0][price]": STRIPE_PRICE_ID,
          "line_items[0][quantity]": "1",
          "success_url": "https://nexusguard.puter.site/?payment=success",
          "cancel_url": "https://nexusguard.puter.site/?payment=cancelled",
        });

        const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        if (!stripeResponse.ok) {
          const errText = await stripeResponse.text();
          console.error("Stripe API error:", stripeResponse.status, errText);
          return jsonResponse(
            { error: "Stripe session creation failed", detail: errText },
            stripeResponse.status,
            origin
          );
        }

        const session = await stripeResponse.json();

        return jsonResponse({ url: session.url, sessionId: session.id }, 200, origin);
      } catch (err) {
        console.error("Worker error:", err);
        return jsonResponse({ error: "Internal server error", detail: err.message }, 500, origin);
      }
    }

    // ── POST /referral ──
    // Stub route: when a referred user signs up / connects Shopify,
    // the frontend sends the referrer's code here. The worker should
    // look up the referrer in a KV namespace and increment their
    // earned_states count by 1. For now this is a placeholder.
    if (url.pathname === "/referral" && request.method === "POST") {
      try {
        const body = await request.json();
        const referrerCode = body.referrer_code;

        if (!referrerCode) {
          return jsonResponse({ error: "Missing referrer_code" }, 400, origin);
        }

        // TODO: Implement actual referral crediting logic:
        // 1. Look up the referrer by referrerCode in a Cloudflare KV namespace
        // 2. Increment their earned_states count by 1
        // 3. Optionally send them a notification
        console.log(`[Referral] Credit request for referrer: ${referrerCode}`);

        return jsonResponse(
          { success: true, message: `Referral recorded for ${referrerCode}` },
          200,
          origin
        );
      } catch (err) {
        console.error("Referral error:", err);
        return jsonResponse({ error: "Invalid request body" }, 400, origin);
      }
    }

    return jsonResponse({ error: "Not found" }, 404, origin);
  },
};
