// ──────────────────────────────────────────────
// NexusGuard — app.js (Phase 7: Supabase Migration)
// ──────────────────────────────────────────────

const supabaseUrl = 'https://ivyrhwlsqhhuxwjrcmmm.supabase.co';
const supabaseKey = 'sb_publishable_SQLDL_7WpZ6U3ieAbB7j2A_Dd7IP4JT';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let userProfile = {};

const THRESHOLD = 100_000;

// ── OAuth Configuration ──
const SHOPIFY_CONFIG = {
  clientId: "REMOVED_FOR_GITHUB",
  scopes: "read_orders",
  redirectUri: "https://nexusguard.puter.site/",
  workerUrl: "https://nexusguard-auth.omisrani19.workers.dev",
};

// ── Stripe Configuration ──
const STRIPE_CONFIG = {
  publishableKey: "pk_live_51TEx0sCqoSS6frfTXT9dYD8Lnb0g1MxY1ueeOkoTY4QF8rcqyekv5RVA7QxxKPhaBl7BPth7j4gSgIU6dOKWtxVp00Mp2Iu1Dc",
  workerUrl: "https://nexusguard-billing.omisrani19.workers.dev",
};

const BASE_FREE_STATES = 3;

// ── Helper: build a generic state entry ──
function makeState(abbr, name, flag, portalUrl) {
  const noTax = portalUrl === null;
  return {
    key: `nexus_${abbr.toLowerCase()}`,
    name,
    abbr,
    flag,
    portalUrl,
    filingFreq: noTax ? "N/A — No State Sales Tax" : "Quarterly",
    steps: noTax
      ? [
          `${name} does not impose a statewide sales tax.`,
          `You are generally not required to register for sales tax collection in ${name}.`,
          `Note: Some local jurisdictions may levy their own taxes — check local requirements.`,
        ]
      : [
          `Visit the ${name} Department of Revenue website and register for a Sales Tax Permit.`,
          `Complete the online registration application for ${name}.`,
          `Once approved, begin collecting the applicable state + local sales tax rates.`,
          `File and remit sales tax returns quarterly via the ${name} online tax portal.`,
        ],
  };
}

// State configuration — all 50 US States
const STATES = [
  // ── Top 5 with bespoke details ──
  {
    key: "nexus_tx", name: "Texas", abbr: "TX", flag: "🤠",
    portalUrl: "https://comptroller.texas.gov/taxes/sales/", filingFreq: "Quarterly",
    steps: [
      "Visit the Texas Comptroller website and apply for a Sales Tax Permit.",
      "Complete Form AP-201 (Texas Application).",
      "Once approved, begin collecting 6.25% state sales tax (+ local rates).",
      "File returns quarterly via Webfile.",
    ],
  },
  {
    key: "nexus_ca", name: "California", abbr: "CA", flag: "🌴",
    portalUrl: "https://www.cdtfa.ca.gov/taxes-and-fees/sales-use-tax.htm", filingFreq: "Quarterly",
    steps: [
      "Register with the California CDTFA for a Seller's Permit.",
      "Complete the online registration at cdtfa.ca.gov.",
      "Begin collecting 7.25% base state sales tax (+ district taxes).",
      "File and remit quarterly via the CDTFA online portal.",
    ],
  },
  {
    key: "nexus_ny", name: "New York", abbr: "NY", flag: "🗽",
    portalUrl: "https://www.tax.ny.gov/bus/st/stidx.htm", filingFreq: "Quarterly",
    steps: [
      "Register with the NY Dept. of Taxation via the Online Tax Center.",
      "Obtain a Certificate of Authority.",
      "Collect 4% state sales tax (+ local jurisdiction taxes).",
      "File returns quarterly using NY DTF e-services.",
    ],
  },
  {
    key: "nexus_fl", name: "Florida", abbr: "FL", flag: "🌞",
    portalUrl: "https://floridarevenue.com/taxes/taxesfees/Pages/sales_tax.aspx", filingFreq: "Monthly or Quarterly",
    steps: [
      "Register with the Florida Dept. of Revenue online.",
      "Complete Form DR-1 (Application to Collect and/or Report Tax).",
      "Begin collecting 6% state sales tax (+ county discretionary surtax).",
      "File returns monthly or quarterly based on your liability.",
    ],
  },
  {
    key: "nexus_il", name: "Illinois", abbr: "IL", flag: "🏙️",
    portalUrl: "https://tax.illinois.gov/research/taxinformation/sales.html", filingFreq: "Monthly or Quarterly",
    steps: [
      "Register with the Illinois Dept. of Revenue for a Retailer's Occupation Tax license.",
      "Complete Form REG-1 online.",
      "Begin collecting 6.25% state sales tax (+ local rates up to 10%+).",
      "File returns monthly or quarterly via MyTax Illinois.",
    ],
  },
  // ── Remaining 45 states with official .gov tax portal URLs ──
  // (AK, DE, MT, NH, OR have no statewide sales tax → portalUrl = null)
  makeState("AL", "Alabama",        "🏈", "https://myalabamataxes.alabama.gov/"),
  makeState("AK", "Alaska",         "🏔️", null),
  makeState("AZ", "Arizona",        "🌵", "https://azdor.gov/transaction-privilege-tax"),
  makeState("AR", "Arkansas",       "💎", "https://www.dfa.arkansas.gov/sales-and-use-tax"),
  makeState("CO", "Colorado",       "⛷️", "https://tax.colorado.gov/sales-tax"),
  makeState("CT", "Connecticut",    "🏛️", "https://portal.ct.gov/DRS/Sales-Tax/Sales-and-Use-Tax"),
  makeState("DE", "Delaware",       "🐔", null),
  makeState("GA", "Georgia",        "🍑", "https://dor.georgia.gov/sales-use-tax"),
  makeState("HI", "Hawaii",         "🌺", "https://tax.hawaii.gov/geninfo/get/"),
  makeState("ID", "Idaho",          "🥔", "https://tax.idaho.gov/taxes/sales-use-tax/"),
  makeState("IN", "Indiana",        "🏎️", "https://www.in.gov/dor/business-tax/sales-tax/"),
  makeState("IA", "Iowa",           "🌽", "https://tax.iowa.gov/iowa-sales-and-use-tax"),
  makeState("KS", "Kansas",         "🌻", "https://www.ksrevenue.gov/salesanduse.html"),
  makeState("KY", "Kentucky",       "🐴", "https://revenue.ky.gov/Business/Sales-Use-Tax/Pages/default.aspx"),
  makeState("LA", "Louisiana",      "⚜️", "https://revenue.louisiana.gov/SalesTax"),
  makeState("ME", "Maine",          "🦞", "https://www.maine.gov/revenue/taxes/sales-use-tax"),
  makeState("MD", "Maryland",       "🦀", "https://www.marylandtaxes.gov/business/sales-use/"),
  makeState("MA", "Massachusetts",  "🎓", "https://www.mass.gov/sales-and-use-tax"),
  makeState("MI", "Michigan",       "🚗", "https://www.michigan.gov/taxes/business-taxes/sales-use-tax"),
  makeState("MN", "Minnesota",      "❄️", "https://www.revenue.state.mn.us/sales-and-use-tax"),
  makeState("MS", "Mississippi",    "🎸", "https://www.dor.ms.gov/sales-and-use-tax"),
  makeState("MO", "Missouri",       "🏹", "https://dor.mo.gov/taxation/business/tax-types/sales-use/"),
  makeState("MT", "Montana",        "🦌", null),
  makeState("NE", "Nebraska",       "🌾", "https://revenue.nebraska.gov/businesses/sales-and-use-tax"),
  makeState("NV", "Nevada",         "🎰", "https://tax.nv.gov/FAQs/Sales_Tax_Information/"),
  makeState("NH", "New Hampshire",  "🏔️", null),
  makeState("NJ", "New Jersey",     "🏖️", "https://www.nj.gov/treasury/taxation/su_over.shtml"),
  makeState("NM", "New Mexico",     "🎨", "https://www.tax.newmexico.gov/businesses/gross-receipts-overview/"),
  makeState("NC", "North Carolina", "🏀", "https://www.ncdor.gov/taxes-forms/sales-and-use-tax"),
  makeState("ND", "North Dakota",   "🦬", "https://www.tax.nd.gov/business/sales-and-use-tax"),
  makeState("OH", "Ohio",           "🌰", "https://tax.ohio.gov/sales-and-use-tax"),
  makeState("OK", "Oklahoma",       "🤠", "https://oklahoma.gov/tax/businesses/sales-use.html"),
  makeState("OR", "Oregon",         "🌲", null),
  makeState("PA", "Pennsylvania",   "🔔", "https://www.revenue.pa.gov/TaxTypes/SUT/Pages/default.aspx"),
  makeState("RI", "Rhode Island",   "⛵", "https://tax.ri.gov/tax-sections/sales-and-use-tax"),
  makeState("SC", "South Carolina", "🌙", "https://dor.sc.gov/tax/sales-and-use"),
  makeState("SD", "South Dakota",   "🗿", "https://dor.sd.gov/businesses/taxes/sales-use-tax/"),
  makeState("TN", "Tennessee",      "🎵", "https://www.tn.gov/revenue/taxes/sales-and-use-tax.html"),
  makeState("UT", "Utah",           "🏜️", "https://tax.utah.gov/sales"),
  makeState("VT", "Vermont",        "🍁", "https://tax.vermont.gov/business/sales-and-use-tax"),
  makeState("VA", "Virginia",       "🏛️", "https://www.tax.virginia.gov/retail-sales-and-use-tax"),
  makeState("WA", "Washington",     "🌧️", "https://dor.wa.gov/taxes-rates/sales-use-tax-rates"),
  makeState("WV", "West Virginia",  "⛰️", "https://tax.wv.gov/Business/SalesAndUseTax/Pages/SalesAndUseTax.aspx"),
  makeState("WI", "Wisconsin",      "🧀", "https://www.revenue.wi.gov/Pages/FAQS/pcs-sales.aspx"),
  makeState("WY", "Wyoming",        "🤠", "https://revenue.wyo.gov/tax-types/sales-and-use-tax"),
];

// Map province codes → state keys (all 50)
const PROVINCE_TO_KEY = {};
for (const s of STATES) {
  PROVINCE_TO_KEY[s.abbr] = s.key;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/** Show a floating toast notification */
function showToast(message, durationMs = 4000) {
  const toast = document.createElement("div");
  toast.className = "fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl text-sm font-semibold text-white shadow-2xl transition-all duration-500 opacity-0 translate-y-4";
  toast.style.background = "linear-gradient(135deg, #1b57f5 0%, #7c3aed 100%)";
  toast.style.border = "1px solid rgba(255,255,255,0.15)";
  toast.style.backdropFilter = "blur(12px)";
  toast.textContent = message;
  document.body.appendChild(toast);
  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
  });
  // Animate out
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(16px)";
    setTimeout(() => toast.remove(), 500);
  }, durationMs);
}

/** Reusable loading spinner SVG markup */
const SPINNER_SVG = `<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10" />`;

function fmtCurrency(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function pct(sales) {
  return Math.min(Math.round((sales / THRESHOLD) * 100), 100);
}

function statusColor(sales) {
  const p = (sales / THRESHOLD) * 100;
  if (p >= 100) return { bar: "from-red-500 to-rose-600", barBg: "bg-red-500/10", text: "text-red-400", badge: "bg-red-500/15 text-red-400", label: "Exceeded" };
  if (p >= 80) return { bar: "from-amber-400 to-orange-500", barBg: "bg-amber-500/10", text: "text-amber-400", badge: "bg-amber-500/15 text-amber-400", label: "Approaching" };
  return { bar: "from-emerald-400 to-green-500", barBg: "bg-emerald-500/10", text: "text-emerald-400", badge: "bg-emerald-500/15 text-emerald-400", label: "On Track" };
}

// ──────────────────────────────────────────────
// Supabase Database helpers
// ──────────────────────────────────────────────
async function kvGet(key) {
  if (userProfile[key] !== undefined && userProfile[key] !== null) {
    const val = Number(userProfile[key]);
    return isNaN(val) ? null : val;
  }
  return null;
}

async function kvSet(key, value) {
  userProfile[key] = value;
  if (currentUser) {
    try {
      await supabase.from('user_profiles').update({ [key]: value }).eq('id', currentUser.id);
    } catch (err) {
      console.warn("Supabase update failed:", err);
    }
  }
}

async function kvGetString(key) {
  if (userProfile[key] !== undefined && userProfile[key] !== null) {
    return String(userProfile[key]);
  }
  return null;
}

// ──────────────────────────────────────────────
// Real Shopify Orders API
// ──────────────────────────────────────────────
async function fetchShopifyOrders(shop, accessToken) {
  const apiUrl = `https://${shop}/admin/api/2024-01/orders.json?status=any&limit=250&fields=total_price,shipping_address,created_at`;

  console.log(`[NexusGuard] Fetching orders from ${shop}...`);

  const response = await fetch(apiUrl, {
    method: "GET",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    // Expired or revoked token — prompt user to reconnect
    if (response.status === 401 || response.status === 403) {
      await kvSet("shopify_connected", "false");
      await kvSet("shopify_access_token", "");
      throw new Error("Access token expired or revoked. Please reconnect Shopify.");
    }

    throw new Error(`Shopify API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log(`[NexusGuard] Fetched ${data.orders.length} orders.`);
  return data.orders;
}

// ──────────────────────────────────────────────
// Simulated Orders (Demo Mode)
// ──────────────────────────────────────────────
function fetchDemoOrders() {
  const provinces = [];
  for (let i = 0; i < 30; i++) provinces.push("TX");
  for (let i = 0; i < 35; i++) provinces.push("CA");
  for (let i = 0; i < 20; i++) provinces.push("NY");
  for (let i = 0; i < 5; i++)  provinces.push("FL");
  for (let i = 0; i < 5; i++)  provinces.push("WA");
  for (let i = 0; i < 5; i++)  provinces.push("IL");

  const orders = [];
  const now = Date.now();
  for (let i = 0; i < 50; i++) {
    const province = provinces[Math.floor(Math.random() * provinces.length)];
    const totalPrice = Math.round((Math.random() * 7950 + 50) * 100) / 100;
    const daysAgo = Math.floor(Math.random() * 90);
    orders.push({
      order_id: 1001 + i,
      total_price: totalPrice,
      created_at: new Date(now - daysAgo * 86400000).toISOString(),
      shipping_address: { province_code: province, country_code: "US" },
    });
  }
  return orders;
}

function calculateStateTotals(orders) {
  // Dynamically initialise totals for every tracked state
  const totals = {};
  for (const s of STATES) totals[s.key] = 0;

  for (const order of orders) {
    const addr = order.shipping_address || order.billing_address;
    if (!addr) continue;
    const code = addr.province_code;
    const key = PROVINCE_TO_KEY[code];
    if (key) {
      const price = parseFloat(order.total_price) || 0;
      totals[key] = (totals[key] || 0) + price;
    }
  }
  for (const k of Object.keys(totals)) totals[k] = Math.round(totals[k]);
  return totals;
}

// ──────────────────────────────────────────────
// Sync Real Orders (for re-sync after OAuth)
// ──────────────────────────────────────────────
async function syncRealOrders() {
  const shop = await kvGetString("shopify_shop");
  const token = await kvGetString("shopify_access_token");

  if (!shop || !token) {
    alert("No Shopify connection found. Please connect your store first.");
    return;
  }

  setShopifyUIState("exchanging"); // reuse loading state

  try {
    const orders = await fetchShopifyOrders(shop, token);
    const totals = calculateStateTotals(orders);

    for (const [key, val] of Object.entries(totals)) {
      await kvSet(key, val);
    }

    const syncTime = new Date().toLocaleString();
    await kvSet("shopify_last_sync", syncTime);
    await kvSet("shopify_order_count", orders.length);

    setShopifyUIState("connected", shop, null, orders.length, syncTime);
    await renderDashboard();
  } catch (err) {
    console.error("[NexusGuard] Order sync failed:", err);

    // If the token was invalidated, reset to disconnected so user can reconnect
    if (err.message.includes("expired") || err.message.includes("revoked")) {
      setShopifyUIState("disconnected");
      alert("Your Shopify access token has expired. Please click 'Connect Shopify' to reconnect.");
    } else {
      setShopifyUIState("error", null, err.message);
    }
  }
}

// ──────────────────────────────────────────────
// OAuth Flow — Step 1: Redirect to Shopify
// ──────────────────────────────────────────────

/** Redirect to Shopify OAuth using a given shop domain string */
function startShopifyOAuth(shopDomain) {
  let shop = shopDomain.trim().toLowerCase();
  if (!shop.endsWith(".myshopify.com")) {
    shop = `${shop}.myshopify.com`;
  }

  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
    const errEl = document.querySelector("#shopify-input-error");
    if (errEl) {
      errEl.textContent = "Invalid store name. Use letters, numbers, and hyphens only.";
      errEl.classList.remove("hidden");
    }
    return;
  }

  kvSet("shopify_shop", shop);
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_CONFIG.clientId}&scope=${SHOPIFY_CONFIG.scopes}&redirect_uri=${encodeURIComponent(SHOPIFY_CONFIG.redirectUri)}`;
  window.location.href = authUrl;
}

/** Legacy prompt-based connect (fallback for modal) */
function connectShopify() {
  const input = prompt("Enter your Shopify store domain (e.g. mystore.myshopify.com):");
  if (!input) return;
  startShopifyOAuth(input);
}

/** Connect Shopify from the embedded input field with loading spinner */
async function connectShopifyFromInput() {
  const inputEl = document.querySelector("#shopify-store-input");
  const connectBtn = document.querySelector("#btn-shopify-connect");
  const manualBtn = document.querySelector("#btn-manual-entry");
  const errEl = document.querySelector("#shopify-input-error");
  if (!inputEl || !connectBtn) return;

  const storeName = inputEl.value.trim();
  if (!storeName) {
    if (errEl) {
      errEl.textContent = "Please enter your store name.";
      errEl.classList.remove("hidden");
    }
    return;
  }

  if (errEl) errEl.classList.add("hidden");

  // Loading state
  connectBtn.disabled = true;
  inputEl.disabled = true;
  if (manualBtn) manualBtn.disabled = true;
  connectBtn.innerHTML = `
    <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">${SPINNER_SVG}</svg>
    <span>Connecting...</span>
  `;

  await new Promise((r) => setTimeout(r, 1500));
  startShopifyOAuth(storeName);
}

/** Enable manual data entry mode */
async function enableManualMode() {
  const manualBtn = document.querySelector("#btn-manual-entry");
  const connectBtn = document.querySelector("#btn-shopify-connect");
  const inputEl = document.querySelector("#shopify-store-input");
  if (!manualBtn) return;

  // Loading state
  manualBtn.disabled = true;
  if (connectBtn) connectBtn.disabled = true;
  if (inputEl) inputEl.disabled = true;
  manualBtn.innerHTML = `
    <svg class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">${SPINNER_SVG}</svg>
    <span>Preparing Dashboard...</span>
  `;
  manualBtn.className = "w-full flex items-center justify-center gap-2 text-brand-400 text-xs font-medium py-2 rounded-lg bg-white/5 cursor-wait transition-all duration-200";

  await new Promise((r) => setTimeout(r, 1500));

  await kvSet("shopify_connected", "manual");
  setShopifyUIState("manual");
  await renderDashboard();
}

function closeShopifyModal() {
  const modal = $("#modal-shopify");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

/** Generate a random nonce for OAuth state param (CSRF protection) */
function generateNonce(length = 16) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (const byte of array) result += chars[byte % chars.length];
  return result;
}

// ──────────────────────────────────────────────
// OAuth Flow — Step 2: Handle Callback
// ──────────────────────────────────────────────
async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const shop = params.get("shop");

  if (!code || !shop) return false;

  console.log("[NexusGuard] OAuth callback detected. Exchanging code...");
  setShopifyUIState("exchanging");

  try {
    const response = await fetch(SHOPIFY_CONFIG.workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop, code }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Token exchange failed (${response.status})`);
    }

    const data = await response.json();

    await kvSet("shopify_access_token", data.access_token);
    await kvSet("shopify_shop", shop);
    await kvSet("shopify_connected", "true");

    console.log("[NexusGuard] OAuth successful. Token saved. Fetching orders...");

    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    try {
      const orders = await fetchShopifyOrders(shop, data.access_token);
      const totals = calculateStateTotals(orders);
      for (const [key, val] of Object.entries(totals)) {
        await kvSet(key, val);
      }
      const syncTime = new Date().toLocaleString();
      await kvSet("shopify_last_sync", syncTime);
      await kvSet("shopify_order_count", orders.length);
      setShopifyUIState("connected", shop, null, orders.length, syncTime);
    } catch (fetchErr) {
      console.warn("[NexusGuard] Order fetch after OAuth failed:", fetchErr);
      setShopifyUIState("connected", shop, null, 0, new Date().toLocaleString());
    }

    return true;
  } catch (err) {
    console.error("[NexusGuard] OAuth token exchange failed:", err);
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
    setShopifyUIState("error", null, err.message);
    return false;
  }
}

// ──────────────────────────────────────────────
// Demo Mode (Simulation Fallback)
// ──────────────────────────────────────────────
async function runDemoMode() {
  closeShopifyModal();

  // Show loading state in action area
  const actionArea = document.querySelector("#shopify-action-area");
  if (actionArea) {
    actionArea.innerHTML = `
      <button disabled class="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-brand-600/25 cursor-wait">
        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">${SPINNER_SVG}</svg>
        <span>Generating Data...</span>
      </button>
    `;
  }

  await new Promise((r) => setTimeout(r, 1500));

  const orders = fetchDemoOrders();
  const totals = calculateStateTotals(orders);

  for (const [key, val] of Object.entries(totals)) {
    await kvSet(key, val);
  }

  const syncTime = new Date().toLocaleString();
  await kvSet("shopify_last_sync", syncTime);
  await kvSet("shopify_order_count", orders.length);
  await kvSet("shopify_connected", "demo");

  setShopifyUIState("demo", null, null, orders.length, syncTime);
  await renderDashboard();
}

// ──────────────────────────────────────────────
// Exit Demo Mode
// ──────────────────────────────────────────────
async function exitDemoMode() {
  const exitBtn = document.querySelector("#btn-exit-demo");
  if (exitBtn) {
    exitBtn.disabled = true;
    exitBtn.innerHTML = `
      <svg class="w-3.5 h-3.5 animate-spin inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">${SPINNER_SVG}</svg>
      Clearing Data...
    `;
    exitBtn.className = "w-full text-center text-xs text-amber-400 mt-2 py-1.5 rounded-lg bg-white/5 transition-all duration-200 cursor-wait flex items-center justify-center gap-1";
  }

  await new Promise((r) => setTimeout(r, 1500));

  for (const s of STATES) {
    await kvSet(s.key, 0);
  }
  await kvSet("shopify_connected", "false");
  await kvSet("shopify_last_sync", "");
  await kvSet("shopify_order_count", 0);
  await kvSet("shopify_access_token", "");
  await kvSet("shopify_shop", "");

  setShopifyUIState("disconnected");
  await renderDashboard();
  console.log("[NexusGuard] Demo mode exited. All data cleared.");
}

// ──────────────────────────────────────────────
// Shopify UI State Manager
// ──────────────────────────────────────────────
function setShopifyUIState(state, shop = null, error = null, orderCount = 0, syncTime = null) {
  const actionArea = document.querySelector("#shopify-action-area");
  const statusText = document.querySelector("#shopify-status-text");
  const badge = document.querySelector("#shopify-status-badge");
  const syncEl = document.querySelector("#shopify-last-sync");

  if (!actionArea) return;

  switch (state) {
    case "disconnected":
      statusText.textContent = "Not connected";
      badge.textContent = "Offline";
      badge.className = "text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 text-gray-500";
      syncEl.classList.add("hidden");

      actionArea.innerHTML = `
        <button
          id="btn-shopify-connect"
          class="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-gray-400 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 hover:bg-white/8 hover:border-white/15 cursor-pointer"
        >
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          <span>Connect Shopify</span>
          <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">Soon</span>
        </button>
        <button
          id="btn-manual-entry"
          class="w-full flex items-center justify-center gap-2 mt-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-brand-600/25 cursor-pointer"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          <span>Enter Data Manually</span>
        </button>
      `;

      document.querySelector("#btn-shopify-connect").addEventListener("click", () => {
        showToast("🚀 We are currently finalizing our Shopify App Store approval! Click 'Enter Data Manually' below to use the calculator in the meantime.");
      });
      document.querySelector("#btn-manual-entry").addEventListener("click", enableManualMode);
      break;

    case "exchanging":
      statusText.textContent = "Exchanging token...";
      badge.textContent = "Auth";
      badge.className = "text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-brand-500/15 text-brand-400";
      actionArea.innerHTML = `
        <button disabled class="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-brand-600/25 cursor-wait">
          <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">${SPINNER_SVG}</svg>
          <span>Authenticating...</span>
        </button>
      `;
      break;

    case "connected":
      statusText.textContent = shop ? `Connected to ${shop}` : "Connected via OAuth";
      badge.textContent = "Live";
      badge.className = "text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 pulse-dot";
      actionArea.innerHTML = `
        <button id="btn-resync" class="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-brand-600/25">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          <span>↻ Re-sync Shopify</span>
        </button>
      `;
      document.querySelector("#btn-resync").addEventListener("click", syncRealOrders);
      if (syncTime) {
        syncEl.textContent = `Last synced: ${syncTime}`;
        syncEl.classList.remove("hidden");
      }
      break;

    case "demo":
      statusText.textContent = `${orderCount} demo orders synced`;
      badge.textContent = "Demo";
      badge.className = "text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400";
      actionArea.innerHTML = `
        <button id="btn-resync-demo" class="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-brand-600/25">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          <span>↻ Re-sync Demo</span>
        </button>
        <button id="btn-exit-demo" class="w-full text-center text-xs text-gray-400 hover:text-white mt-2 py-1.5 rounded-lg hover:bg-white/5 transition-all duration-200 cursor-pointer">
          Exit Demo Mode
        </button>
      `;
      document.querySelector("#btn-resync-demo").addEventListener("click", runDemoMode);
      document.querySelector("#btn-exit-demo").addEventListener("click", exitDemoMode);
      if (syncTime) {
        syncEl.textContent = `Last synced: ${syncTime}`;
        syncEl.classList.remove("hidden");
      }
      break;

    case "manual":
      statusText.textContent = "Manual entry active";
      badge.textContent = "Manual";
      badge.className = "text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-brand-500/15 text-brand-400";
      actionArea.innerHTML = `
        <div class="flex items-center gap-2 py-1">
          <div class="w-2 h-2 rounded-full bg-brand-400 animate-pulse"></div>
          <span class="text-xs text-brand-400 font-medium">Manual Mode Active — enter sales data below</span>
        </div>
        <button id="btn-exit-manual" class="w-full text-center text-xs text-gray-400 hover:text-white mt-1.5 py-1.5 rounded-lg hover:bg-white/5 transition-all duration-200 cursor-pointer">
          Exit Manual Mode
        </button>
      `;
      document.querySelector("#btn-exit-manual").addEventListener("click", async () => {
        await kvSet("shopify_connected", "false");
        for (const s of STATES) await kvSet(s.key, 0);
        setShopifyUIState("disconnected");
        await renderDashboard();
      });
      syncEl.classList.add("hidden");
      break;

    case "error":
      statusText.textContent = error || "Connection failed";
      badge.textContent = "Error";
      badge.className = "text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-red-500/15 text-red-400";
      actionArea.innerHTML = `
        <button id="btn-retry" class="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#7ab55c] to-[#95bf47] hover:from-[#8cc45e] hover:to-[#a6d157] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-[#95bf47]/25">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          <span>Retry Connection</span>
        </button>
      `;
      document.querySelector("#btn-retry").addEventListener("click", () => setShopifyUIState("disconnected"));
      break;
  }
}

/** Restore Shopify UI state from KV if previously connected */
async function restoreShopifyState() {
  const connected = await kvGetString("shopify_connected");
  if (!connected || connected === "false") {
    // Initialize to disconnected so the Demo Mode button gets injected
    setShopifyUIState("disconnected");
    return;
  }

  const syncTime = await kvGetString("shopify_last_sync");
  const shop = await kvGetString("shopify_shop");

  if (connected === "demo") {
    const orderCount = await kvGet("shopify_order_count");
    setShopifyUIState("demo", null, null, orderCount || 0, syncTime);
  } else if (connected === "true") {
    setShopifyUIState("connected", shop, null, 0, syncTime);
  }
}

// ──────────────────────────────────────────────
// Render
// ──────────────────────────────────────────────
function renderCard(state, sales, index) {
  const p = pct(sales);
  const c = statusColor(sales);
  const exceeded = sales >= THRESHOLD;

  return `
    <div class="glass-card rounded-2xl p-6 transition-all duration-300 hover:border-white/12 animate-fade-up delay-${(index + 3) * 100} ${exceeded ? "glow-red border-red-500/20" : ""}">
      <div class="flex items-start justify-between mb-5">
        <div class="flex items-center gap-3">
          <span class="text-2xl">${state.flag}</span>
          <div>
            <h4 class="text-white font-bold text-lg leading-tight">${state.name}</h4>
            <p class="text-xs text-gray-500 mt-0.5">Filing: ${state.filingFreq}</p>
          </div>
        </div>
        <span class="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${c.badge}">
          ${c.label}
        </span>
      </div>

      <div class="mb-4">
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-extrabold text-white">${fmtCurrency(sales)}</span>
          <span class="text-xs text-gray-500">/ ${fmtCurrency(THRESHOLD)}</span>
        </div>
      </div>

      <div class="w-full h-3 rounded-full ${c.barBg} overflow-hidden mb-4">
        <div class="h-full rounded-full bg-gradient-to-r ${c.bar} bar-shimmer transition-all duration-700 ease-out" style="width: ${p}%;"></div>
      </div>
      <p class="${c.text} text-xs font-semibold mb-5">${p}% of threshold</p>

      <div class="flex items-center gap-2 mb-4">
        <span class="text-gray-500 text-sm">$</span>
        <input
          type="number"
          id="input-${state.key}"
          value="${sales}"
          min="0"
          max="500000"
          step="1000"
          class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 transition-all"
          placeholder="Enter sales amount"
        />
        <button
          onclick="updateSales('${state.key}')"
          class="bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors duration-200 shadow shadow-brand-600/25"
        >Save</button>
      </div>

      ${exceeded && state.portalUrl ? `
      <button
        onclick="openGuide('${state.key}')"
        id="btn-guide-${state.key}"
        class="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-red-600/25"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        Registration Guide
      </button>` : ""}
      ${exceeded && !state.portalUrl ? `
      <div class="w-full flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold px-4 py-2.5 rounded-xl">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        No State Sales Tax — Registration Not Required
      </div>` : ""}
    </div>
  `;
}

async function renderDashboard() {
  const container = $("#state-cards");
  const proUser = await isPro();
  const earnedStates = (await kvGet("earned_states")) ?? 0;
  const freeStates = proUser ? STATES.length : BASE_FREE_STATES + earnedStates;

  // Get search query
  const searchInput = $("#state-search");
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

  let html = "";
  let approaching = 0;
  let exceeded = 0;
  let visibleCount = 0;

  for (let i = 0; i < STATES.length; i++) {
    const s = STATES[i];

    // Filter by search query
    if (query && !s.name.toLowerCase().includes(query) && !s.abbr.toLowerCase().includes(query)) {
      continue;
    }

    const sales = (await kvGet(s.key)) ?? 0;
    const locked = !proUser && i >= freeStates;

    if (locked) {
      html += `
        <div class="relative rounded-2xl overflow-hidden animate-fade-up">
          <div class="glass-card rounded-2xl p-6 filter blur-[6px] pointer-events-none select-none opacity-60">
            <div class="flex items-start justify-between mb-5">
              <div class="flex items-center gap-3">
                <span class="text-2xl">${s.flag}</span>
                <div>
                  <h4 class="text-white font-bold text-lg leading-tight">${s.name}</h4>
                  <p class="text-xs text-gray-500 mt-0.5">Filing: ${s.filingFreq}</p>
                </div>
              </div>
            </div>
            <div class="mb-4">
              <span class="text-2xl font-extrabold text-white">$—,—</span>
            </div>
            <div class="w-full h-3 rounded-full bg-white/5 mb-4"><div class="h-full rounded-full bg-gray-600 w-1/3"></div></div>
          </div>
          <div class="absolute inset-0 flex flex-col items-center justify-center bg-surface-900/60 backdrop-blur-sm rounded-2xl">
            <div class="w-12 h-12 rounded-full bg-purple-500/15 flex items-center justify-center mb-3">
              <svg class="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <p class="text-white font-bold text-sm mb-1">Pro Only</p>
            <p class="text-gray-400 text-xs mb-3">${s.name} tracking</p>
            <button onclick="handleStripeUpgrade()" class="text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-500 px-4 py-1.5 rounded-lg shadow-lg shadow-purple-600/25 hover:from-purple-500 hover:to-indigo-400 transition-all">
              Unlock with Pro
            </button>
          </div>
        </div>
      `;
    } else {
      html += renderCard(s, sales, i);
    }

    visibleCount++;
    const p = (sales / THRESHOLD) * 100;
    if (p >= 100) exceeded++;
    else if (p >= 80) approaching++;
  }

  if (visibleCount === 0 && query) {
    html = `<div class="col-span-full text-center py-12 text-gray-500"><p class="text-lg">No states matching "${query}"</p></div>`;
  }

  container.innerHTML = html;
  $("#stat-tracked").textContent = proUser ? STATES.length : Math.min(freeStates, STATES.length);
  $("#stat-approaching").textContent = approaching;
  $("#stat-exceeded").textContent = exceeded;

  // Update tier badge + CTA visibility
  updateTierBadge(proUser);
}

// ──────────────────────────────────────────────
// Actions
// ──────────────────────────────────────────────
async function updateSales(key) {
  const input = $(`#input-${key}`);
  const val = Math.max(0, parseInt(input.value, 10) || 0);
  await kvSet(key, val);
  await renderDashboard();
}

function openGuide(key) {
  const state = STATES.find((s) => s.key === key);
  if (!state) return;

  $("#modal-state-name").textContent = `${state.flag} ${state.name} (${state.abbr})`;
  $("#modal-body").innerHTML = `
    <p class="text-gray-400">Your sales in ${state.name} have exceeded the <strong class="text-white">$100,000</strong> economic nexus threshold. You are required to register for sales tax collection.</p>
    <ol class="list-decimal list-inside space-y-2 mt-3 text-gray-300">
      ${state.steps.map((s) => `<li>${s}</li>`).join("")}
    </ol>
  `;
  const modalLink = $("#modal-link");
  if (state.portalUrl) {
    modalLink.href = state.portalUrl;
    modalLink.classList.remove("hidden");
  } else {
    modalLink.href = "#";
    modalLink.classList.add("hidden");
  }

  const modal = $("#modal-guide");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeGuide() {
  const modal = $("#modal-guide");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

async function resetData() {
  for (const s of STATES) {
    await kvSet(s.key, 0);
  }
  // Clear all Shopify state
  await kvSet("shopify_connected", "false");
  await kvSet("shopify_last_sync", "");
  await kvSet("shopify_order_count", 0);
  await kvSet("shopify_access_token", "");
  await kvSet("shopify_shop", "");

  setShopifyUIState("disconnected");
  await renderDashboard();
}

// ──────────────────────────────────────────────
// Stripe — Pro Tier Logic
// ──────────────────────────────────────────────

/** Check if user has active Pro subscription */
async function isPro() {
  const status = await kvGetString("is_pro");
  return status === "true";
}

/** Redirect to Stripe Checkout via our worker */
async function handleStripeUpgrade() {
  console.log("[NexusGuard] Stripe Upgrade Initiated...");
  const btn = $("#btn-go-pro");
  const originalText = btn ? btn.innerHTML : "";
  if (btn) {
    btn.innerHTML = "Processing...";
    btn.disabled = true;
  }

  try {
    // 1. Call the worker
    const response = await fetch("https://nexusguard-billing.omisrani19.workers.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    // 2. Parse the response
    const session = await response.json();

    // 🌟 Log what the worker ACTUALLY sent back
    console.log("Worker Response:", session);

    // 3. Check if the worker sent an error message instead of an ID
    if (session.error) {
      console.error("Worker failed because:", session.error);
      alert("Server Error: " + session.error);
      if (btn) {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
      return;
    }

    // 4. If we have an ID, go to Stripe!
    const stripe = Stripe(STRIPE_CONFIG.publishableKey);
    await stripe.redirectToCheckout({ sessionId: session.id });
  } catch (err) {
    console.error("[NexusGuard] Network/Fetch error:", err);
    alert("Payment Gateway Error: " + err.message);
    if (btn) {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }
}

/** Detect ?payment=success in URL and activate Pro */
async function handlePaymentSuccess() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");

  if (payment === "success") {
    console.log("[NexusGuard] Payment success detected. Activating Pro...");
    await kvSet("is_pro", "true");

    // Clean URL
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }
}

/** Update the header tier badge and upgrade CTA visibility */
function updateTierBadge(proUser) {
  const badge = $("#tier-badge");
  const cta = $("#upgrade-cta");

  if (proUser) {
    badge.textContent = "Pro";
    badge.className = "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30";
    if (cta) cta.style.display = "none";
  } else {
    badge.textContent = "Free";
    badge.className = "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 text-gray-500 border border-white/10";
    if (cta) cta.style.display = "";
  }
}

// ──────────────────────────────────────────────
// Events
// ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  $("#modal-close")?.addEventListener("click", closeGuide);
  $("#modal-guide")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeGuide();
  });
  $("#modal-shopify-close")?.addEventListener("click", closeShopifyModal);
  $("#modal-shopify")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeShopifyModal();
  });
  $("#btn-reset")?.addEventListener("click", resetData);

  // State search filter
  $("#state-search")?.addEventListener("input", () => {
    renderDashboard();
  });

  // Copy referral link button
  $("#btn-copy-referral")?.addEventListener("click", async () => {
    const linkEl = $("#referral-link");
    if (linkEl) {
      try {
        await navigator.clipboard.writeText(linkEl.textContent);
        const btn = $("#btn-copy-referral");
        const orig = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = orig; }, 2000);
      } catch {
        // Fallback: select the text
        const range = document.createRange();
        range.selectNodeContents(linkEl);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      }
    }
  });

  // Supabase Auth Form (landing page)
  const authForm = document.getElementById("auth-form");
  if (authForm) {
    const btnSignup = document.getElementById("btn-signup");
    const btnSignin = document.getElementById("btn-signin");
    const emailInput = document.getElementById("auth-email");
    const pwInput = document.getElementById("auth-password");
    const errDiv = document.getElementById("auth-error");

    const handleAuth = async (action) => {
      const email = emailInput.value.trim();
      const password = pwInput.value;
      if (!email || !password) {
        errDiv.textContent = "Please enter email and password.";
        errDiv.classList.remove("hidden");
        return;
      }
      
      errDiv.classList.add("hidden");
      const btn = action === 'signup' ? btnSignup : btnSignin;
      const originalText = btn.innerHTML;
      btn.innerHTML = "Processing...";
      btn.disabled = true;

      try {
        let authError = null;
        if (action === 'signup') {
          const { error } = await supabase.auth.signUp({ email, password });
          authError = error;
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          authError = error;
        }

        if (authError) throw authError;

        window.location.href = "dashboard.html";
      } catch (err) {
        errDiv.textContent = err.message;
        errDiv.classList.remove("hidden");
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    };

    btnSignup.addEventListener("click", () => handleAuth('signup'));
    authForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleAuth('signin');
    });
  }

  // Stripe upgrade button
  const proBtn = $("#btn-go-pro");
  if (proBtn) {
    proBtn.addEventListener("click", handleStripeUpgrade);
  }
});

// ──────────────────────────────────────────────
// Shopify Embedded App Auto-Sync
// ──────────────────────────────────────────────
async function handleShopifyEmbed() {
  const params = new URLSearchParams(window.location.search);
  const shop = params.get("shop");

  // Only trigger when ?shop= is present WITHOUT ?code= (code is handled by OAuth callback)
  if (!shop || params.has("code")) return false;

  console.log(`[NexusGuard] Shopify embed detected for shop: ${shop}`);

  // Show loading state immediately — bypass the disconnected UI
  setShopifyUIState("exchanging");
  const statusText = document.querySelector("#shopify-status-text");
  if (statusText) statusText.textContent = "Syncing with Shopify...";

  // Persist the shop name
  await kvSet("shopify_shop", shop);

  // Clean the URL so params don't re-trigger on refresh
  const cleanUrl = window.location.origin + window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);

  // Attempt real sync if we already have an access token, otherwise use demo data
  const token = await kvGetString("shopify_access_token");
  try {
    let orders;
    if (token) {
      orders = await fetchShopifyOrders(shop, token);
    } else {
      console.log("[NexusGuard] No access token found — populating with demo data.");
      orders = fetchDemoOrders();
    }

    const totals = calculateStateTotals(orders);
    for (const [key, val] of Object.entries(totals)) {
      await kvSet(key, val);
    }

    const syncTime = new Date().toLocaleString();
    await kvSet("shopify_last_sync", syncTime);
    await kvSet("shopify_order_count", orders.length);

    if (token) {
      await kvSet("shopify_connected", "true");
      setShopifyUIState("connected", shop, null, orders.length, syncTime);
    } else {
      await kvSet("shopify_connected", "demo");
      setShopifyUIState("demo", null, null, orders.length, syncTime);
    }

    showToast(`✅ Synced ${orders.length} orders from ${shop}`);
  } catch (err) {
    console.error("[NexusGuard] Embedded auto-sync failed:", err);
    setShopifyUIState("error", null, err.message);
  }

  return true;
}

// ──────────────────────────────────────────────
// App Initialization & Session Check
// ──────────────────────────────────────────────
(async function globalInit() {
  const { data: { session } } = await supabase.auth.getSession();
  const isDashboard = !!document.getElementById("state-cards");

  if (session) {
    currentUser = session.user;

    // Fast redirect if logged in on landing page
    if (!isDashboard) {
       window.location.href = "dashboard.html";
       return;
    }

    // Load profile
    const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', currentUser.id).single();
    if (profile) {
      userProfile = profile;
    } else {
      await supabase.from('user_profiles').insert([{ id: currentUser.id }]);
      userProfile = { id: currentUser.id };
    }
  } else {
    // Not logged in. If on dashboard, redirect.
    if (isDashboard) {
      window.location.href = "index.html";
      return;
    }
  }

  // Dashboard specific init
  if (isDashboard) {
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Step 0: Generate a unique referral user ID if not present
    let userId = await kvGetString("user_id");
    if (!userId) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      userId = "";
      const arr = new Uint8Array(6);
      crypto.getRandomValues(arr);
      for (const b of arr) userId += chars[b % chars.length];
      await kvSet("user_id", userId);
      console.log("[NexusGuard] Generated user ID:", userId);
    }

    // Step 0b: Populate referral link in the Refer & Earn card
    const referralLinkEl = $("#referral-link");
    if (referralLinkEl) {
      referralLinkEl.textContent = `https://nexusguard.puter.site/?ref=${userId}`;
    }

    // Step 0c: Capture ?ref= parameter if present
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref");
    if (refCode) {
      const existing = await kvGetString("referred_by");
      if (!existing) {
        await kvSet("referred_by", refCode);
        console.log("[NexusGuard] Referred by:", refCode);

        // Instantly award 1 bonus state to the referred user
        const currentEarned = (await kvGet("earned_states")) ?? 0;
        await kvSet("earned_states", currentEarned + 1);
        showToast("🎉 You were referred! You get 1 bonus state unlocked.");

        // Send referral to backend to credit the referrer
        try {
          await fetch(STRIPE_CONFIG.workerUrl + "/referral", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ referrer_code: refCode }),
          });
          console.log("[NexusGuard] Referral credit sent for:", refCode);
        } catch (err) {
          console.warn("[NexusGuard] Referral API call failed (non-blocking):", err);
        }
      }
      // Clean ref from URL
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    // Step 1: Check if this is a Stripe payment callback
    await handlePaymentSuccess();

    // Step 2: Check if this is an OAuth callback
    const wasCallback = await handleOAuthCallback();

    // Step 2b: Check if loaded inside Shopify Admin (?shop= without ?code=)
    const wasEmbed = !wasCallback && (await handleShopifyEmbed());

    // Step 3: Restore UI state from KV (skip if already handled above)
    if (!wasCallback && !wasEmbed) {
      await restoreShopifyState();
    }

    // Step 4: Render dashboard
    await renderDashboard();
  }
})();
