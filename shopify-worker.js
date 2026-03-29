/**
 * NexusGuard — shopify-worker.js
 * Cloudflare Worker: Shopify OAuth 2.0 token exchange
 *
 * Deploy: npx wrangler deploy shopify-worker.js
 * Local:  npx wrangler dev shopify-worker.js  (runs at http://localhost:8787)
 */

const CLIENT_ID = "57555175c71b9e183626a3a8b27db12c";
const CLIENT_SECRET = "REMOVED_FOR_GITHUB";

// ── Allowed origins ──
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
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

function isValidShopDomain(shop) {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    // ── CORS preflight ──
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    // ── Route: POST /auth (or POST /) ──
    if (request.method === "POST" && (url.pathname === "/auth" || url.pathname === "/")) {
      try {
        const body = await request.json();
        const { shop, code } = body;

        if (!shop || !code) {
          return jsonResponse({ error: "Missing required fields: shop, code" }, 400, origin);
        }

        if (!isValidShopDomain(shop)) {
          return jsonResponse({ error: "Invalid shop domain. Must be a .myshopify.com domain." }, 400, origin);
        }

        // Exchange authorization code for access token
        const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error("Shopify token exchange failed:", tokenResponse.status, errorText);
          return jsonResponse(
            { error: "Token exchange failed", status: tokenResponse.status, detail: errorText },
            tokenResponse.status,
            origin
          );
        }

        const tokenData = await tokenResponse.json();

        return jsonResponse(
          { access_token: tokenData.access_token, scope: tokenData.scope },
          200,
          origin
        );
      } catch (err) {
        console.error("Worker error:", err);
        return jsonResponse({ error: "Internal server error", detail: err.message }, 500, origin);
      }
    }

    return jsonResponse({ error: "Not found" }, 404, origin);
  },
};
