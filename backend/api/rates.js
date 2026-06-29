// ============================================================
// 📄  api/rates.js — Exchange Rate API Router
//
// Provides live USDC exchange rates and currency conversion.
// Mounted at /api/rates in server.js.
//
// Routes:
//   GET /api/rates              → Current rates for all currencies
//   GET /api/rates/convert      → Convert between two currencies
//   GET /api/rates/history/:currency → Rate history for charting
//
// Data source: CoinGecko free API (via rateService)
// Caching: 5 minutes in rateService memory cache
// ============================================================

const router      = require("express").Router();
const rateService = require("../services/rateService");


// ============================================================
// 🔧  HELPERS
// ============================================================

/**
 * isValidCurrencyCode — basic validation for currency codes.
 * Must be 2-5 uppercase letters.
 * Examples: "USD", "INR", "NGN" are valid. "usd123" is not.
 *
 * @param  {string} code - Currency code to validate
 * @returns {boolean}
 */
const isValidCurrencyCode = (code) => {
  if (!code || typeof code !== "string") return false;
  return /^[A-Z]{2,5}$/.test(code.trim().toUpperCase());
};

/**
 * isPositiveNumber — checks if a value is a valid positive number.
 *
 * @param  {*} value - Any value to check
 * @returns {boolean}
 */
const isPositiveNumber = (value) => {
  const num = Number(value);
  return !isNaN(num) && num > 0 && isFinite(num);
};


// ============================================================
// 📡  ROUTE 1: GET /
// Returns current USDC exchange rates for all currencies.
//
// Response is cached at the HTTP level (Cache-Control header)
// AND at the service level (5-minute in-memory cache).
// This means browsers/CDNs won't re-request for 5 minutes.
//
// Example response:
//   {
//     rates: { USD: 1.00, EUR: 0.92, INR: 83.1, ... },
//     updatedAt: "2024-01-15T10:30:00.000Z",
//     supportedCurrencies: ["USD", "EUR", "GBP", ...]
//   }
// ============================================================
router.get("/", async (req, res, next) => {
  try {
    const rates = await rateService.getUSDCRates();

    // Cache-Control: tell browsers and CDNs to cache for 5 minutes
    // "public" = safe to cache in shared caches (CDN, proxy)
    // "max-age=300" = 300 seconds = 5 minutes
    res.set("Cache-Control", "public, max-age=300");

    // Also set stale-while-revalidate so CDNs serve stale while fetching fresh
    res.set("Vary", "Accept-Encoding");

    return res.json({
      rates,
      updatedAt:           new Date().toISOString(),
      supportedCurrencies: rateService.getSupportedCurrencies(),
      note:                "1 USDC = 1 USD. Rates show how many local currency units equal 1 USDC.",
    });

  } catch (error) {
    next(error);
  }
});


// ============================================================
// 📡  ROUTE 2: GET /convert
// Converts an amount between two currencies.
//
// Query parameters:
//   amount — number to convert (required, must be positive)
//   from   — source currency code (required, e.g. "USD")
//   to     — target currency code (required, e.g. "INR")
//
// Example requests:
//   GET /api/rates/convert?amount=100&from=USD&to=INR
//   GET /api/rates/convert?amount=8310&from=INR&to=USD
//   GET /api/rates/convert?amount=50&from=USD&to=EUR
//
// Example response:
//   {
//     from: "USD",
//     to: "INR",
//     inputAmount: 100,
//     outputAmount: 8310,
//     rate: 83.10
//   }
// ============================================================
router.get("/convert", async (req, res, next) => {
  try {
    const { amount, from, to } = req.query;

    // ── Validate: amount ─────────────────────────────────
    if (amount === undefined || amount === "") {
      return res.status(400).json({
        error:   "Missing parameter",
        message: "Query parameter 'amount' is required.",
        example: "/api/rates/convert?amount=100&from=USD&to=INR",
      });
    }

    if (!isPositiveNumber(amount)) {
      return res.status(400).json({
        error:   "Invalid amount",
        message: `'amount' must be a positive number. Received: "${amount}"`,
      });
    }

    // ── Validate: from currency ───────────────────────────
    const fromCurrency = (from || "").toUpperCase().trim();

    if (!fromCurrency) {
      return res.status(400).json({
        error:   "Missing parameter",
        message: "Query parameter 'from' is required.",
        example: "/api/rates/convert?amount=100&from=USD&to=INR",
      });
    }

    if (!isValidCurrencyCode(fromCurrency)) {
      return res.status(400).json({
        error:   "Invalid currency code",
        message: `'from' must be a 2-5 letter currency code. Received: "${from}"`,
        validExamples: ["USD", "EUR", "GBP", "INR", "MXN", "PHP", "NGN"],
      });
    }

    // ── Validate: to currency ─────────────────────────────
    const toCurrency = (to || "").toUpperCase().trim();

    if (!toCurrency) {
      return res.status(400).json({
        error:   "Missing parameter",
        message: "Query parameter 'to' is required.",
        example: "/api/rates/convert?amount=100&from=USD&to=INR",
      });
    }

    if (!isValidCurrencyCode(toCurrency)) {
      return res.status(400).json({
        error:   "Invalid currency code",
        message: `'to' must be a 2-5 letter currency code. Received: "${to}"`,
        validExamples: ["USD", "EUR", "GBP", "INR", "MXN", "PHP", "NGN"],
      });
    }

    // ── Check supported currencies ────────────────────────
    const supported = rateService.getSupportedCurrencies();

    if (!supported.includes(fromCurrency)) {
      return res.status(400).json({
        error:              "Unsupported currency",
        message:            `'${fromCurrency}' is not a supported currency.`,
        supportedCurrencies: supported,
      });
    }

    if (!supported.includes(toCurrency)) {
      return res.status(400).json({
        error:              "Unsupported currency",
        message:            `'${toCurrency}' is not a supported currency.`,
        supportedCurrencies: supported,
      });
    }

    // ── Perform conversion ────────────────────────────────
    const parsedAmount = parseFloat(amount);
    const result       = await rateService.convertAmount(
      parsedAmount,
      fromCurrency,
      toCurrency
    );

    // ── Handle conversion error ───────────────────────────
    if (result.error) {
      return res.status(422).json({
        error:   "Conversion failed",
        message: result.error,
      });
    }

    // Cache conversion results briefly (1 minute)
    res.set("Cache-Control", "public, max-age=60");

    return res.json({
      from:         result.fromCurrency,
      to:           result.toCurrency,
      inputAmount:  result.inputAmount,
      outputAmount: result.outputAmount,
      rate:         result.rate,
      // Extra context for the frontend
      formatted: {
        input:  `${result.inputAmount} ${result.fromCurrency}`,
        output: `${result.outputAmount} ${result.toCurrency}`,
        rate:   `1 ${result.fromCurrency} = ${result.rate} ${result.toCurrency}`,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    next(error);
  }
});


// ============================================================
// 📡  ROUTE 3: GET /history/:currency
// Returns historical USDC rate data for a specific currency.
// Used to render exchange rate charts on the frontend.
//
// URL params:
//   currency — fiat currency code (e.g. "INR", "EUR")
//
// Query params:
//   days — number of days of history (default: 7, max: 30)
//
// Example requests:
//   GET /api/rates/history/INR
//   GET /api/rates/history/EUR?days=14
//   GET /api/rates/history/NGN?days=30
//
// Example response:
//   {
//     currency: "INR",
//     days: 7,
//     history: [
//       { date: "2024-01-08", rate: 83.05 },
//       { date: "2024-01-09", rate: 83.12 },
//       ...
//     ]
//   }
// ============================================================
router.get("/history/:currency", async (req, res, next) => {
  try {
    const { currency } = req.params;
    const { days }     = req.query;

    // ── Validate currency ─────────────────────────────────
    const currencyUpper = (currency || "").toUpperCase().trim();

    if (!isValidCurrencyCode(currencyUpper)) {
      return res.status(400).json({
        error:   "Invalid currency code",
        message: `Currency must be a 2-5 letter code. Received: "${currency}"`,
        example: "/api/rates/history/INR?days=7",
      });
    }

    // ── Validate days ─────────────────────────────────────
    const parsedDays = days !== undefined ? Number(days) : 7;

    if (isNaN(parsedDays) || parsedDays < 1) {
      return res.status(400).json({
        error:   "Invalid days parameter",
        message: "Query parameter 'days' must be a positive integer.",
        example: "/api/rates/history/INR?days=7",
      });
    }

    // Clamp to max 30 days (CoinGecko free tier limit for daily data)
    const clampedDays = Math.min(Math.floor(parsedDays), 30);

    // ── Fetch rate history ────────────────────────────────
    const history = await rateService.getRateHistory(currencyUpper, clampedDays);

    // Cache history for longer — daily data doesn't change often
    res.set("Cache-Control", "public, max-age=3600"); // 1 hour

    return res.json({
      currency: currencyUpper,
      days:     clampedDays,
      count:    history.length,
      history,
      // Summary stats for quick display
      summary:  history.length > 0 ? {
        latest:  history[history.length - 1]?.rate ?? null,
        oldest:  history[0]?.rate ?? null,
        highest: Math.max(...history.map(h => h.rate)),
        lowest:  Math.min(...history.map(h => h.rate)),
        change:  history.length >= 2
          ? Math.round(
              ((history[history.length - 1].rate - history[0].rate) / history[0].rate) * 10000
            ) / 100    // Percentage change rounded to 2 decimal places
          : 0,
      } : null,
    });

  } catch (error) {
    next(error);
  }
});


// ============================================================
// 📡  BONUS ROUTE: GET /currencies
// Returns the list of supported currency codes.
// Useful for frontend dropdowns.
// ============================================================
router.get("/currencies", (req, res) => {
  res.set("Cache-Control", "public, max-age=86400"); // Cache for 1 day
  return res.json({
    currencies: rateService.getSupportedCurrencies(),
    count:      rateService.getSupportedCurrencies().length,
  });
});


// ============================================================
// 📤  EXPORT
// ============================================================
module.exports = router;