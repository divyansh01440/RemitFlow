// ============================================================
// 📄  services/rateService.js — Exchange Rate Service
//
// Fetches live USDC exchange rates from CoinGecko's free API.
// Used to show users how much their transfer is worth in their
// local currency (e.g. "100 USDC = ₹8,310 INR").
//
// Key design decisions:
//   - In-memory cache (5 minutes) to avoid hitting CoinGecko
//     rate limits (50 calls/minute on free tier)
//   - Hardcoded fallback rates so the app works even if
//     CoinGecko is down
//   - Never throws — always returns something usable
// ============================================================

const axios = require("axios");


// ============================================================
// 💾  IN-MEMORY CACHE
// Stores the last successful API response + when we got it.
// Avoids calling CoinGecko more than once per 5 minutes.
//
// Why in-memory instead of Redis/DB?
//   - Simpler — no extra infrastructure needed
//   - Fast — no network hop to retrieve
//   - Fine for this use case — rates don't change second-to-second
//   - Resets on server restart, which is acceptable
// ============================================================
let cache = {
  data:      null,   // The last rates object { USD, EUR, GBP, ... }
  timestamp: 0,      // Unix ms timestamp of when we last fetched
};

/** Cache TTL: 5 minutes in milliseconds */
const CACHE_TTL_MS = 5 * 60 * 1000; // 300,000ms

/** Check if the cache is still valid */
const isCacheValid = () =>
  cache.data !== null && (Date.now() - cache.timestamp) < CACHE_TTL_MS;


// ============================================================
// 🔢  FALLBACK RATES
// Used when CoinGecko is unreachable or returns an error.
// These are approximate rates — not live, but better than crashing.
// Update these periodically if they drift too far from reality.
// ============================================================
const FALLBACK_RATES = {
  USD: 1.00,    // US Dollar (USDC is pegged 1:1 to USD)
  EUR: 0.92,    // Euro
  GBP: 0.79,    // British Pound
  INR: 83.10,   // Indian Rupee
  MXN: 17.10,   // Mexican Peso
  PHP: 56.40,   // Philippine Peso (major remittance corridor)
  NGN: 780.00,  // Nigerian Naira (major remittance corridor)
  BRL: 4.97,    // Brazilian Real
  PKR: 278.50,  // Pakistani Rupee
  BDT: 110.00,  // Bangladeshi Taka
};

/**
 * Maps our uppercase currency keys to CoinGecko's lowercase format.
 * CoinGecko returns: { "usd-coin": { "usd": 1.0, "eur": 0.92, ... } }
 * We return:        { USD: 1.0, EUR: 0.92, ... }
 */
const CURRENCY_MAP = {
  usd: "USD",
  eur: "EUR",
  gbp: "GBP",
  inr: "INR",
  mxn: "MXN",
  php: "PHP",
  ngn: "NGN",
  brl: "BRL",
  pkr: "PKR",
  bdt: "BDT",
};

/** CoinGecko API base URL */
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

/** Timeout for CoinGecko requests (5 seconds) */
const REQUEST_TIMEOUT_MS = 5000;


// ============================================================
// 💱  EXPORTED FUNCTIONS
// ============================================================

/**
 * getUSDCRates
 *
 * Returns the current USDC exchange rates in major fiat currencies.
 * Uses cached data if available (within last 5 minutes).
 * Falls back to hardcoded rates if API is unavailable.
 *
 * @returns {Promise<object>} Rate object like { USD: 1.00, EUR: 0.92, INR: 83.1, ... }
 *
 * Usage:
 *   const rates = await getUSDCRates();
 *   console.log(rates.INR); // 83.1 — means 1 USDC = 83.1 INR
 */
const getUSDCRates = async () => {

  // ── Return cached data if still fresh ────────────────────
  if (isCacheValid()) {
    return cache.data;
  }

  // ── Fetch fresh rates from CoinGecko ─────────────────────
  try {
    console.log("📡  rateService: Fetching fresh USDC rates from CoinGecko...");

    const response = await axios.get(`${COINGECKO_BASE}/simple/price`, {
      params: {
        ids:           "usd-coin",
        vs_currencies: "usd,eur,gbp,inr,mxn,php,ngn,brl,pkr,bdt",
      },
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        // CoinGecko prefers a User-Agent header to identify your app
        "User-Agent": "RemitFlow/1.0 (remittance app)",
      },
    });

    // CoinGecko response shape:
    // { "usd-coin": { "usd": 1.0, "eur": 0.919, "inr": 83.12, ... } }
    const rawRates = response.data?.["usd-coin"];

    if (!rawRates || typeof rawRates !== "object") {
      throw new Error("Unexpected CoinGecko response shape");
    }

    // Transform from CoinGecko format to our format
    // { "usd": 1.0 } → { USD: 1.0 }
    const rates = {};
    for (const [geckoKey, ourKey] of Object.entries(CURRENCY_MAP)) {
      if (rawRates[geckoKey] !== undefined) {
        rates[ourKey] = rawRates[geckoKey];
      }
    }

    // Ensure USD is always exactly 1.00 (USDC is pegged)
    rates.USD = 1.00;

    // Fill in any missing currencies with fallback values
    for (const [currency, fallbackRate] of Object.entries(FALLBACK_RATES)) {
      if (rates[currency] === undefined) {
        rates[currency] = fallbackRate;
      }
    }

    // ── Store in cache ──────────────────────────────────────
    cache = {
      data:      rates,
      timestamp: Date.now(),
    };

    console.log(`✅  rateService: Rates updated — 1 USDC = ${rates.INR} INR, ${rates.EUR} EUR`);
    return rates;

  } catch (error) {
    // ── CoinGecko failed — use fallback rates ───────────────
    console.warn(
      "⚠️  rateService: CoinGecko API unavailable, using fallback rates.\n" +
      `   Reason: ${error.message}`
    );

    // If we have stale cached data, prefer it over hardcoded fallback
    if (cache.data) {
      console.warn("   Using stale cached rates as secondary fallback.");
      return cache.data;
    }

    // Last resort: return hardcoded fallback rates
    return { ...FALLBACK_RATES };
  }
};


/**
 * convertAmount
 *
 * Converts a USDC amount to or from a fiat currency.
 *
 * Since USDC is pegged to USD (1 USDC = 1 USD), conversion is:
 *   USDC → fiat:  multiply by fiat rate
 *   fiat → USDC:  divide by fiat rate
 *
 * @param  {number} amount       - The amount to convert
 * @param  {string} fromCurrency - Source currency (e.g. "USD", "INR")
 * @param  {string} toCurrency   - Target currency (e.g. "EUR", "NGN")
 * @returns {Promise<{ inputAmount, outputAmount, rate, fromCurrency, toCurrency }>}
 *
 * Usage:
 *   // Convert 100 USD to INR
 *   const result = await convertAmount(100, "USD", "INR");
 *   // { inputAmount: 100, outputAmount: 8310, rate: 83.10, ... }
 *
 *   // Convert 8310 INR to USDC
 *   const result = await convertAmount(8310, "INR", "USD");
 *   // { inputAmount: 8310, outputAmount: 100, rate: 0.01203, ... }
 */
const convertAmount = async (amount, fromCurrency, toCurrency) => {

  // ── Input validation ──────────────────────────────────────
  const parsedAmount = Number(amount);
  if (isNaN(parsedAmount) || parsedAmount < 0) {
    return {
      inputAmount:  amount,
      outputAmount: 0,
      rate:         0,
      fromCurrency: fromCurrency?.toUpperCase(),
      toCurrency:   toCurrency?.toUpperCase(),
      error:        "Invalid amount — must be a positive number",
    };
  }

  const from = (fromCurrency || "USD").toUpperCase().trim();
  const to   = (toCurrency   || "USD").toUpperCase().trim();

  // ── Same currency — no conversion needed ─────────────────
  if (from === to) {
    return {
      inputAmount:  parsedAmount,
      outputAmount: parsedAmount,
      rate:         1,
      fromCurrency: from,
      toCurrency:   to,
    };
  }

  try {
    const rates = await getUSDCRates();

    const fromRate = rates[from];
    const toRate   = rates[to];

    if (fromRate === undefined) {
      throw new Error(`Unsupported currency: ${from}`);
    }
    if (toRate === undefined) {
      throw new Error(`Unsupported currency: ${to}`);
    }

    // ── Conversion logic ──────────────────────────────────
    // Strategy: convert everything through USD as the base currency
    // Step 1: Convert from → USD:    amount / fromRate
    // Step 2: Convert USD → to:      usdAmount * toRate
    //
    // Special case: since USDC = USD = 1.0, USD conversions are direct.
    //
    // Examples:
    //   100 USD → INR: (100 / 1.0) * 83.1  = 8,310 INR
    //   8310 INR → USD: (8310 / 83.1) * 1.0 = 100 USD
    //   100 EUR → INR: (100 / 0.92) * 83.1  = 9,032.6 INR

    const amountInUSD  = parsedAmount / fromRate;
    const outputAmount = amountInUSD  * toRate;

    // The "rate" is how much 1 unit of fromCurrency is worth in toCurrency
    const rate = toRate / fromRate;

    return {
      inputAmount:  parsedAmount,
      outputAmount: Math.round(outputAmount * 100) / 100, // Round to 2 decimal places
      rate:         Math.round(rate * 100000) / 100000,   // Round to 5 decimal places
      fromCurrency: from,
      toCurrency:   to,
    };

  } catch (error) {
    console.warn(`⚠️  rateService.convertAmount error: ${error.message}`);

    // Return a safe response even on error
    return {
      inputAmount:  parsedAmount,
      outputAmount: 0,
      rate:         0,
      fromCurrency: from,
      toCurrency:   to,
      error:        error.message,
    };
  }
};


/**
 * getRateHistory
 *
 * Fetches historical USDC price data for a given fiat currency.
 * Used to render exchange rate charts on the frontend.
 *
 * @param  {string} currency - Fiat currency code (e.g. "INR", "EUR")
 * @param  {number} days     - Number of days of history (default: 7, max: 30)
 * @returns {Promise<Array<{ date: string, rate: number }>>}
 *          Array of daily rates, oldest first
 *          Returns empty array on failure (never throws)
 *
 * Usage:
 *   const history = await getRateHistory("INR", 7);
 *   // [{ date: "2024-01-08", rate: 83.05 }, ...]
 */
const getRateHistory = async (currency = "INR", days = 7) => {

  // ── Validate inputs ───────────────────────────────────────
  const currencyUpper  = (currency || "INR").toUpperCase().trim();
  const clampedDays    = Math.min(Math.max(Number(days) || 7, 1), 30);
  const geckoVsCurrency = currencyUpper.toLowerCase();

  try {
    console.log(`📡  rateService: Fetching ${clampedDays}-day history for USDC/${currencyUpper}`);

    const response = await axios.get(
      `${COINGECKO_BASE}/coins/usd-coin/market_chart`,
      {
        params: {
          vs_currency: geckoVsCurrency,
          days:        clampedDays,
          interval:    "daily",
        },
        timeout: REQUEST_TIMEOUT_MS,
        headers: { "User-Agent": "RemitFlow/1.0" },
      }
    );

    // CoinGecko returns: { prices: [[timestamp_ms, price], ...] }
    const prices = response.data?.prices;

    if (!Array.isArray(prices) || prices.length === 0) {
      throw new Error("No price data in CoinGecko response");
    }

    // Transform to our format: [{ date: "2024-01-08", rate: 83.05 }, ...]
    const history = prices.map(([timestampMs, rate]) => ({
      date: new Date(timestampMs).toISOString().split("T")[0], // "2024-01-08"
      rate: Math.round(rate * 10000) / 10000,                  // 4 decimal places
    }));

    console.log(`✅  rateService: Got ${history.length} data points for ${currencyUpper}`);
    return history;

  } catch (error) {
    // Log the failure but never crash — just return empty array
    console.warn(
      `⚠️  rateService.getRateHistory: Failed to fetch ${currencyUpper} history.\n` +
      `   Reason: ${error.message}`
    );

    // Return empty array — frontend should handle this gracefully
    return [];
  }
};


/**
 * getSupportedCurrencies
 *
 * Returns the list of currencies this service supports.
 * Useful for frontend dropdowns and validation.
 *
 * @returns {string[]} Array of currency codes
 */
const getSupportedCurrencies = () => Object.keys(FALLBACK_RATES);


/**
 * clearCache
 *
 * Forces the next getUSDCRates() call to fetch fresh data.
 * Useful for testing or admin endpoints.
 */
const clearCache = () => {
  cache = { data: null, timestamp: 0 };
  console.log("🗑️   rateService: Cache cleared");
};


// ============================================================
// 📤  EXPORTS
// ============================================================
module.exports = {
  getUSDCRates,
  convertAmount,
  getRateHistory,
  getSupportedCurrencies,
  clearCache,
};