// ============================================================
// ⚠️  LOAD ENV FIRST — must be before any other imports
// Reads your .env file and makes all variables available
// via process.env throughout the entire application.
// ============================================================
require("dotenv").config({ path: "../.env" });

const express      = require("express");
const cors         = require("cors");
const helmet       = require("helmet");
const morgan       = require("morgan");
const rateLimit    = require("express-rate-limit");
const mongoose     = require("mongoose");


// ============================================================
// 🏗️  CREATE EXPRESS APP
// ============================================================
const app = express();


// ============================================================
// 🗄️  DATABASE CONNECTION
// Connects to MongoDB Atlas using the URI from your .env file.
//
// HOW TO GET YOUR URI:
//   1. Go to https://mongodb.com → your cluster → Connect
//   2. Choose "Connect your application"
//   3. Copy the connection string
//   4. Add to .env: MONGODB_URI=mongodb+srv://user:pass@cluster...
//
// mongoose.connect() returns a Promise — we use async/await
// to wait for it before starting the server.
// ============================================================
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      // These options suppress deprecation warnings
      serverSelectionTimeoutMS: 5000,  // Fail fast if DB unreachable
    });
    console.log("✅  MongoDB connected successfully");
  } catch (error) {
    console.error("❌  MongoDB connection failed:", error.message);
    console.error("    Check your MONGODB_URI in .env");
    // Exit process — server is useless without the database
    process.exit(1);
  }
};

// Listen for connection events after initial connect
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️   MongoDB disconnected. Attempting to reconnect...");
});
mongoose.connection.on("reconnected", () => {
  console.log("✅  MongoDB reconnected");
});


// ============================================================
// 🔒  SECURITY MIDDLEWARE
//
// helmet() sets secure HTTP response headers automatically:
//   - X-Frame-Options: prevents clickjacking
//   - X-Content-Type-Options: prevents MIME sniffing
//   - Strict-Transport-Security: enforces HTTPS
//   - And many more...
// ============================================================
app.use(helmet({
  // Allow cross-origin requests for our frontend
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));


// ============================================================
// 🌐  CORS — Cross-Origin Resource Sharing
// Tells the browser which origins are allowed to call this API.
//
// Without this, the browser would block requests from
// http://localhost:3000 (the Next.js frontend) to
// http://localhost:4000 (this backend).
// ============================================================
const allowedOrigins = [
  "http://localhost:3000",          // Local Next.js dev server
  "http://localhost:3001",          // Alternate local port
  process.env.FRONTEND_URL,         // Production frontend URL from .env
].filter(Boolean);                  // Remove undefined/empty values

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  methods:     ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,  // Allow cookies to be sent cross-origin
}));


// ============================================================
// 🚦  RATE LIMITING
// Prevents abuse by limiting how many requests a single IP
// can make within a time window.
//
// 100 requests per 15 minutes is generous for normal use
// but blocks scrapers and brute force attempts.
// ============================================================
const limiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes in milliseconds
  max:              100,             // Max requests per window per IP
  message: {
    error:   "Too many requests",
    message: "You have exceeded the rate limit. Please wait 15 minutes.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,   // Send RateLimit-* headers in response
  legacyHeaders:   false,  // Don't send X-RateLimit-* headers (deprecated)

  // Custom handler for when limit is exceeded
  handler: (req, res) => {
    console.warn(`⚠️  Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error:   "Too many requests",
      message: "Rate limit exceeded. Try again in 15 minutes.",
    });
  },
});

app.use(limiter);


// ============================================================
// 📝  REQUEST LOGGING
// morgan('dev') logs every request in a colored format:
//   GET /api/transactions 200 45ms - 1234b
//
// Only use 'dev' format in development.
// In production, use 'combined' for Apache-style logs.
// ============================================================
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));


// ============================================================
// 📦  BODY PARSING
// express.json() parses incoming request bodies with
// Content-Type: application/json into req.body.
//
// Without this, req.body would be undefined on POST/PATCH requests.
// ============================================================
app.use(express.json({
  limit: "10mb", // Max request body size (prevent large payload attacks)
}));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));


// ============================================================
// 🏥  HEALTH CHECK ROUTE
// Simple endpoint that returns server status.
// Used by:
//   - Load balancers to check if server is alive
//   - Monitoring tools (UptimeRobot, etc.)
//   - Developers to verify the server is running
//
// Test with: curl http://localhost:4000/health
// ============================================================
app.get("/health", (req, res) => {
  res.json({
    status:    "ok",
    timestamp: Date.now(),
    version:   "1.0.0",
    uptime:    Math.floor(process.uptime()),      // Seconds since server started
    database:  mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    environment: process.env.NODE_ENV || "development",
  });
});


// ============================================================
// 🛣️  API ROUTES
// Each router handles a group of related endpoints.
//
// Transactions: GET/POST for remittance transfer records
// Rates:        GET for live USDC exchange rates
// Users:        GET/PATCH for wallet-based user profiles
// ============================================================
app.use("/api/transactions", require("./api/transactions"));
app.use("/api/rates",        require("./api/rates"));
app.use("/api/users",        require("./api/users"));


// ============================================================
// 🔍  404 HANDLER
// Catches any request that didn't match a route above.
// Must be placed AFTER all route definitions.
// ============================================================
app.use((req, res) => {
  res.status(404).json({
    error:   "Not found",
    message: `Cannot ${req.method} ${req.path}`,
    availableRoutes: [
      "GET  /health",
      "GET  /api/transactions/:address",
      "POST /api/transactions/sync/:txHash",
      "GET  /api/rates",
      "GET  /api/rates/convert",
      "GET  /api/users/:address",
      "PATCH /api/users/:address",
    ],
  });
});


// ============================================================
// 🚨  GLOBAL ERROR HANDLER
// Catches ANY error thrown or passed to next(err) in routes.
// Must have exactly 4 arguments — Express uses the argument
// count to identify this as an error handler.
//
// Usage in routes:
//   try { ... } catch (err) { next(err); }
// ============================================================
app.use((err, req, res, next) => {      // eslint-disable-line no-unused-vars
  // Log the full error for debugging
  console.error("❌  Server error:", {
    message: err.message,
    path:    req.path,
    method:  req.method,
    // Only log stack trace in development
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });

  // Handle specific error types
  if (err.name === "ValidationError") {
    // Mongoose validation error
    return res.status(400).json({
      error:   "Validation error",
      message: err.message,
      fields:  Object.keys(err.errors || {}),
    });
  }

  if (err.code === 11000) {
    // MongoDB duplicate key error
    return res.status(409).json({
      error:   "Duplicate entry",
      message: "A record with this value already exists.",
    });
  }

  if (err.message?.includes("CORS")) {
    return res.status(403).json({
      error:   "CORS error",
      message: err.message,
    });
  }

  // Generic 500 error — don't leak internal details in production
  res.status(err.status || 500).json({
    error:   "Internal server error",
    message: process.env.NODE_ENV === "production"
      ? "Something went wrong. Please try again."
      : err.message,
  });
});


// ============================================================
// 🚀  START SERVER
// We connect to MongoDB first, then start listening for
// HTTP requests. This ensures the database is ready before
// any requests can come in.
// ============================================================
const PORT = process.env.PORT || 4000;

const startServer = async () => {
  // 1. Connect to database first
  await connectDB();

  // 2. Start HTTP server
  app.listen(PORT, () => {
    console.log("");
    console.log("🚀  RemitFlow backend running on port", PORT);
    console.log(`    Local:   http://localhost:${PORT}`);
    console.log(`    Health:  http://localhost:${PORT}/health`);
    console.log(`    API:     http://localhost:${PORT}/api`);
    console.log(`    Env:     ${process.env.NODE_ENV || "development"}`);
    console.log("");
  });
};

// Start the server and catch any startup errors
startServer().catch(error => {
  console.error("❌  Failed to start server:", error.message);
  process.exit(1);
});


// ============================================================
// 🛑  GRACEFUL SHUTDOWN
// When the server receives SIGTERM (e.g. from Ctrl+C or
// a deployment system), close the database connection cleanly
// before exiting. This prevents data corruption.
// ============================================================
process.on("SIGTERM", async () => {
  console.log("\n🛑  SIGTERM received — shutting down gracefully...");
  await mongoose.connection.close();
  console.log("    MongoDB connection closed.");
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("\n🛑  SIGINT received — shutting down gracefully...");
  await mongoose.connection.close();
  console.log("    MongoDB connection closed.");
  process.exit(0);
});

module.exports = app;