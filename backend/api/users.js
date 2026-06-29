// ============================================================
// 📄  api/users.js — User Profile API Router
//
// Handles all user profile endpoints for RemitFlow.
// Mounted at /api/users in server.js.
//
// User identity = Ethereum wallet address (no passwords).
// A user document is auto-created on first access.
//
// Routes:
//   GET    /api/users/:address                          → Get/create profile
//   PATCH  /api/users/:address                          → Update profile
//   POST   /api/users/:address/favorites                → Add favorite recipient
//   DELETE /api/users/:address/favorites/:recipient     → Remove favorite
//   GET    /api/users/:address/stats                    → Get wallet stats
// ============================================================

const router         = require("express").Router();
const { ethers }     = require("ethers");
const User           = require("../models/User");
const polygonService = require("../services/polygonService");


// ============================================================
// 🔒  MIDDLEWARE: validateAddress
// Applied to ALL routes via router.use() below.
// Rejects any request where :address is not a valid Ethereum address.
//
// Valid:   0x742d35Cc6634C0532925a3b844Bc454e4438f44e
// Invalid: "hello", "0x123", undefined
// ============================================================
const validateAddress = (req, res, next) => {
  const { address } = req.params;

  if (!address) {
    return res.status(400).json({
      error:   "Missing address",
      message: "Wallet address is required in the URL path.",
      example: "/api/users/0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    });
  }

  if (!ethers.isAddress(address)) {
    return res.status(400).json({
      error:   "Invalid Ethereum address",
      message: `"${address}" is not a valid Ethereum address.`,
      hint:    "Address must start with 0x and be 42 characters long.",
    });
  }

  // Normalize to lowercase and attach to req for use in route handlers
  req.normalizedAddress = address.toLowerCase();
  next();
};

// Apply validateAddress middleware to ALL routes in this router
// Any route with :address will be validated automatically
router.use("/:address", validateAddress);
router.use("/:address/*", validateAddress);


// ============================================================
// 📡  ROUTE 1: GET /:address
// Gets a user profile, creating it if it doesn't exist yet.
//
// This is the Web3 "login" pattern:
//   - No sign-up step needed
//   - First request creates the profile automatically
//   - Subsequent requests return the existing profile
//
// Example: GET /api/users/0x742d35...
// ============================================================
router.get("/:address", async (req, res, next) => {
  try {
    const { normalizedAddress } = req;

    const { user, created } = await User.findOrCreate(normalizedAddress);

    // Add created flag to response so frontend knows if this is a new user
    return res.status(created ? 201 : 200).json({
      ...user.toJSON(),
      isNewUser: created,
    });

  } catch (error) {
    next(error);
  }
});


// ============================================================
// 📡  ROUTE 2: PATCH /:address
// Updates a user's profile fields.
//
// Only fields present in the request body are updated.
// Unknown fields are silently ignored.
//
// Updatable fields:
//   displayName          — string, max 30 chars
//   email                — string, valid email format
//   notificationsEnabled — boolean
//
// Example: PATCH /api/users/0x742d35...
// Body: { "displayName": "Alice", "email": "alice@example.com" }
// ============================================================
router.patch("/:address", async (req, res, next) => {
  try {
    const { normalizedAddress } = req;
    const { displayName, email, notificationsEnabled } = req.body;

    // ── Build update object ───────────────────────────────
    // Only include fields that were actually sent in the request body
    const updates = {};
    const errors  = [];

    // Validate and add displayName
    if (displayName !== undefined) {
      if (typeof displayName !== "string") {
        errors.push("displayName must be a string");
      } else if (displayName.trim().length > 30) {
        errors.push("displayName cannot exceed 30 characters");
      } else {
        updates.displayName = displayName.trim();
      }
    }

    // Validate and add email
    if (email !== undefined) {
      if (typeof email !== "string") {
        errors.push("email must be a string");
      } else if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        errors.push(`"${email}" is not a valid email address`);
      } else {
        updates.email = email.trim().toLowerCase();
      }
    }

    // Validate and add notificationsEnabled
    if (notificationsEnabled !== undefined) {
      if (typeof notificationsEnabled !== "boolean") {
        errors.push("notificationsEnabled must be a boolean (true or false)");
      } else {
        updates.notificationsEnabled = notificationsEnabled;
      }
    }

    // ── Return validation errors if any ──────────────────
    if (errors.length > 0) {
      return res.status(400).json({
        error:   "Validation failed",
        message: "One or more fields are invalid.",
        errors,
      });
    }

    // ── Nothing to update ─────────────────────────────────
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error:   "No valid fields provided",
        message: "Request body must contain at least one of: displayName, email, notificationsEnabled",
      });
    }

    // ── Update lastSeen ───────────────────────────────────
    updates.lastSeen = new Date();

    // ── Perform update ────────────────────────────────────
    const updatedUser = await User.findOneAndUpdate(
      { address: normalizedAddress },
      { $set: updates },
      {
        new:          true,   // Return the updated document
        upsert:       true,   // Create if doesn't exist
        runValidators: true,  // Run Mongoose schema validators
      }
    );

    return res.json(updatedUser.toJSON());

  } catch (error) {
    // Handle Mongoose validation errors specifically
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error:   "Validation error",
        message: error.message,
      });
    }
    next(error);
  }
});


// ============================================================
// 📡  ROUTE 3: POST /:address/favorites
// Adds a recipient address to the user's favorites list.
//
// Favorites are shown in the Send form as quick-pick buttons.
// Max 10 entries — oldest is removed when limit is reached.
// Duplicate entries are silently ignored.
//
// Example: POST /api/users/0x742d35.../favorites
// Body: { "recipientAddress": "0xRecipient..." }
// ============================================================
router.post("/:address/favorites", async (req, res, next) => {
  try {
    const { normalizedAddress } = req;
    const { recipientAddress }  = req.body;

    // ── Validate recipientAddress ─────────────────────────
    if (!recipientAddress) {
      return res.status(400).json({
        error:   "Missing field",
        message: "Request body must include 'recipientAddress'.",
        example: { recipientAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" },
      });
    }

    if (!ethers.isAddress(recipientAddress)) {
      return res.status(400).json({
        error:   "Invalid recipient address",
        message: `"${recipientAddress}" is not a valid Ethereum address.`,
      });
    }

    const normalizedRecipient = recipientAddress.toLowerCase();

    // ── Prevent adding self ───────────────────────────────
    if (normalizedRecipient === normalizedAddress) {
      return res.status(400).json({
        error:   "Invalid recipient",
        message: "You cannot add your own address as a favorite.",
      });
    }

    // ── Find or create user ───────────────────────────────
    const { user } = await User.findOrCreate(normalizedAddress);

    // ── Check for duplicate ───────────────────────────────
    if (user.favoriteRecipients.includes(normalizedRecipient)) {
      return res.json({
        message:   "Address already in favorites",
        favorites: user.favoriteRecipients,
        count:     user.favoriteRecipients.length,
      });
    }

    // ── Enforce max 10 limit (remove oldest if needed) ────
    if (user.favoriteRecipients.length >= 10) {
      user.favoriteRecipients.shift(); // Remove oldest (first element)
    }

    // ── Add to favorites and save ─────────────────────────
    user.favoriteRecipients.push(normalizedRecipient);
    await user.save();

    return res.status(201).json({
      message:   "Favorite added",
      favorites: user.favoriteRecipients,
      count:     user.favoriteRecipients.length,
    });

  } catch (error) {
    next(error);
  }
});


// ============================================================
// 📡  ROUTE 4: DELETE /:address/favorites/:recipientAddress
// Removes a recipient address from the user's favorites list.
//
// Returns the updated favorites list.
// Safe to call even if the address isn't in favorites.
//
// Example: DELETE /api/users/0x742d35.../favorites/0xRecipient...
// ============================================================
router.delete("/:address/favorites/:recipientAddress", async (req, res, next) => {
  try {
    const { normalizedAddress }       = req;
    const { recipientAddress }        = req.params;

    // ── Validate recipientAddress ─────────────────────────
    if (!ethers.isAddress(recipientAddress)) {
      return res.status(400).json({
        error:   "Invalid recipient address",
        message: `"${recipientAddress}" is not a valid Ethereum address.`,
      });
    }

    const normalizedRecipient = recipientAddress.toLowerCase();

    // ── Find user ─────────────────────────────────────────
    let user = await User.findOne({ address: normalizedAddress });

    if (!user) {
      // User doesn't exist — nothing to delete, return empty favorites
      return res.json({
        message:   "User not found — no favorites to remove",
        favorites: [],
        count:     0,
      });
    }

    // ── Remove address from favorites ─────────────────────
    const before = user.favoriteRecipients.length;
    user.favoriteRecipients = user.favoriteRecipients.filter(
      (addr) => addr !== normalizedRecipient
    );
    const after = user.favoriteRecipients.length;

    await user.save();

    return res.json({
      message:   before === after ? "Address was not in favorites" : "Favorite removed",
      favorites: user.favoriteRecipients,
      count:     user.favoriteRecipients.length,
    });

  } catch (error) {
    next(error);
  }
});


// ============================================================
// 📡  ROUTE 5: GET /:address/stats
// Returns comprehensive stats for a wallet address.
//
// Combines data from:
//   1. User model (transaction totals, counts)
//   2. polygonService (live yield balance from blockchain)
//
// Example: GET /api/users/0x742d35.../stats
// ============================================================
router.get("/:address/stats", async (req, res, next) => {
  try {
    const { normalizedAddress } = req;

    // ── Fetch user + yield in parallel ───────────────────
    // Run both queries at the same time for speed
    const [userResult, yieldResult] = await Promise.allSettled([

      // Get user from MongoDB
      User.findOrCreate(normalizedAddress),

      // Get live yield balance from Polygon blockchain
      polygonService.getYieldBalance(normalizedAddress),

    ]);

    // ── Extract user data ─────────────────────────────────
    const user = userResult.status === "fulfilled"
      ? userResult.value.user
      : null;

    if (!user) {
      return res.status(404).json({
        error:   "User not found",
        message: `No profile found for address: ${normalizedAddress}`,
      });
    }

    // ── Extract yield data ────────────────────────────────
    // Yield fetch might fail if contract not deployed — handle gracefully
    const yieldData = yieldResult.status === "fulfilled"
      ? yieldResult.value
      : { deposited: "0", pendingYield: "0" };

    if (yieldResult.status === "rejected") {
      console.warn(
        `⚠️  Could not fetch yield balance for ${normalizedAddress}:`,
        yieldResult.reason?.message
      );
    }

    // ── Build stats response ──────────────────────────────
    return res.json({
      address:          normalizedAddress,

      // Transaction stats (from MongoDB User model)
      totalSent:        user.totalSentFormatted     ?? "0.00",
      totalReceived:    user.totalReceivedFormatted ?? "0.00",
      transactionCount: user.transactionCount       ?? 0,

      // Raw string versions (for BigInt math in frontend)
      totalSentRaw:     user.totalSent     || "0",
      totalReceivedRaw: user.totalReceived || "0",

      // Yield stats (live from Polygon blockchain)
      yieldDeposited:         yieldData.deposited            || "0",
      pendingYield:           yieldData.pendingYield         || "0",
      yieldDepositedFormatted: yieldData.depositedFormatted  || "0.000000",
      pendingYieldFormatted:  yieldData.pendingYieldFormatted || "0.000000",

      // Profile info
      displayName:      user.displayName || null,
      firstSeen:        user.firstSeen,
      lastSeen:         user.lastSeen,
      favoritesCount:   user.favoriteRecipients?.length ?? 0,
    });

  } catch (error) {
    next(error);
  }
});


// ============================================================
// 📤  EXPORT
// ============================================================
module.exports = router;