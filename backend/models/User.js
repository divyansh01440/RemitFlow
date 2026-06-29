const mongoose = require("mongoose");

// ============================================================
// 📄  models/User.js — Mongoose Model
//
// Stores RemitFlow user profiles keyed by Ethereum address.
// There are NO passwords or usernames — the wallet address
// IS the user identity (Web3 authentication pattern).
//
// A user document is created automatically the first time
// a wallet address interacts with the RemitFlow API.
// ============================================================


const UserSchema = new mongoose.Schema(
  {

    // ── IDENTITY ──────────────────────────────────────────────

    /**
     * Ethereum wallet address — this IS the user's unique ID.
     * Always stored lowercase for case-insensitive lookups.
     *
     * Example: "0x742d35cc6634c0532925a3b844bc454e4438f44e"
     *
     * Why use address as ID instead of MongoDB _id?
     *   - No login required — wallet IS the identity
     *   - Consistent across all Web3 apps
     *   - Can be verified cryptographically (signature)
     */
    address: {
      type:      String,
      required:  [true, "Wallet address is required"],
      unique:    true,
      index:     true,
      lowercase: true,
      trim:      true,
      validate: {
        validator: (v) => /^0x[0-9a-f]{40}$/i.test(v),
        message:   "Invalid Ethereum address format",
      },
    },


    // ── PROFILE ───────────────────────────────────────────────

    /**
     * Optional display name set by the user.
     * Shows instead of shortened address in the UI.
     * Example: "Alice" or "remitflow.eth"
     */
    displayName: {
      type:      String,
      default:   "",
      trim:      true,
      maxlength: [50, "Display name cannot exceed 50 characters"],
    },

    /**
     * Optional email address for transaction notifications.
     * Not required — users can use the app without providing email.
     * Set emailVerified = false whenever this changes.
     */
    email: {
      type:      String,
      default:   "",
      trim:      true,
      lowercase: true,
      maxlength: [254, "Email address too long"],
      validate: {
        validator: (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message:   "Invalid email address format",
      },
    },

    /**
     * Whether the user wants email/push notifications.
     * Controls whether notificationService sends emails on transfer.
     */
    notificationsEnabled: {
      type:    Boolean,
      default: true,
    },


    // ── STATISTICS ────────────────────────────────────────────
    // Stored as strings to handle large USDC BigInt values safely.
    // Use recordTransaction() to update these — never manually.

    /**
     * Cumulative USDC sent (raw string, 6 decimals).
     * Example: "1500000000" = 1,500 USDC sent total
     * Updated by recordTransaction('sent', amount)
     */
    totalSent: {
      type:    String,
      default: "0",
    },

    /**
     * Cumulative USDC received (raw string, 6 decimals).
     * Example: "500000000" = 500 USDC received total
     * Updated by recordTransaction('received', amount)
     */
    totalReceived: {
      type:    String,
      default: "0",
    },

    /**
     * Total number of transactions (sent + received).
     * Incremented by recordTransaction().
     */
    transactionCount: {
      type:    Number,
      default: 0,
      min:     0,
    },

    /**
     * Total USDC ever deposited into yield pool (raw string).
     * Updated by the yield deposit API route.
     * Example: "2000000000" = 2,000 USDC deposited total
     */
    yieldDeposited: {
      type:    String,
      default: "0",
    },


    // ── FAVORITE RECIPIENTS ───────────────────────────────────

    /**
     * Array of frequently used recipient addresses.
     * Max 10 entries — enforced by the instance method and API.
     * Stored lowercase for consistent comparison.
     *
     * Usage in UI: show as quick-pick buttons in Send form.
     */
    favoriteRecipients: {
      type:     [String],
      default:  [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message:   "Cannot have more than 10 favorite recipients",
      },
    },


    // ── ACTIVITY TRACKING ─────────────────────────────────────

    /**
     * When this user was first seen (first API call from this address).
     * Set once at creation — never updated.
     */
    firstSeen: {
      type:    Date,
      default: Date.now,
    },

    /**
     * When this user last made any API call.
     * Updated by recordTransaction() and can be updated by the API.
     * Used to identify inactive users.
     */
    lastSeen: {
      type:    Date,
      default: Date.now,
    },

  },

  {
    // ── SCHEMA OPTIONS ────────────────────────────────────────
    timestamps: true,         // Adds createdAt + updatedAt automatically
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);


// ============================================================
// 🔮  VIRTUALS
// ============================================================

/**
 * totalSentFormatted — human-readable total sent amount.
 *
 * Usage: user.totalSentFormatted  →  "1500.00"
 */
UserSchema.virtual("totalSentFormatted").get(function () {
  try {
    return (Number(BigInt(this.totalSent || "0")) / 1_000_000).toFixed(2);
  } catch {
    return "0.00";
  }
});

/**
 * totalReceivedFormatted — human-readable total received amount.
 *
 * Usage: user.totalReceivedFormatted  →  "500.00"
 */
UserSchema.virtual("totalReceivedFormatted").get(function () {
  try {
    return (Number(BigInt(this.totalReceived || "0")) / 1_000_000).toFixed(2);
  } catch {
    return "0.00";
  }
});

/**
 * shortAddress — shortened display address.
 *
 * Usage: user.shortAddress  →  "0x742d...f44e"
 */
UserSchema.virtual("shortAddress").get(function () {
  if (!this.address || this.address.length < 10) return this.address;
  return `${this.address.slice(0, 6)}...${this.address.slice(-4)}`;
});


// ============================================================
// 🔧  STATIC METHODS
// Called on the Model class: User.findOrCreate("0x...")
// ============================================================

/**
 * findOrCreate — finds a user by address, or creates one if not found.
 *
 * This is the primary way to get a user in the API.
 * Calling this on every request ensures new wallets are
 * automatically onboarded without any sign-up step.
 *
 * @param  {string} address - Ethereum wallet address (any case)
 * @returns {Promise<{ user: object, created: boolean }>}
 *
 * Usage:
 *   const { user, created } = await User.findOrCreate("0x742d35...");
 *   if (created) console.log("New user!");
 */
UserSchema.statics.findOrCreate = async function (address) {
  if (!address) {
    throw new Error("findOrCreate: address is required");
  }

  const normalized = address.toLowerCase().trim();

  // Try to find existing user first
  let user = await this.findOne({ address: normalized });

  if (user) {
    // User exists — update lastSeen and return
    user.lastSeen = new Date();
    await user.save();
    return { user, created: false };
  }

  // User doesn't exist — create a new one
  user = new this({
    address:   normalized,
    firstSeen: new Date(),
    lastSeen:  new Date(),
  });

  await user.save();

  console.log(`👤  New user created: ${normalized}`);
  return { user, created: true };
};


// ============================================================
// 🔧  INSTANCE METHODS
// Called on a document instance: user.recordTransaction(...)
// ============================================================

/**
 * recordTransaction — updates stats when a transfer is made.
 *
 * Increments transactionCount, adds amount to the correct
 * running total (totalSent or totalReceived), and updates lastSeen.
 *
 * Uses BigInt arithmetic to avoid floating point precision issues
 * when adding large USDC amounts.
 *
 * @param  {"sent" | "received"} type   - Direction of the transfer
 * @param  {string}              amount - Raw USDC amount string (e.g. "1000000")
 * @returns {Promise<void>}
 *
 * Usage:
 *   await user.recordTransaction("sent", "100500000"); // Sent 100.50 USDC
 *   await user.recordTransaction("received", "97000000"); // Received 97.00 USDC
 */
UserSchema.methods.recordTransaction = async function (type, amount) {
  // Validate type
  if (type !== "sent" && type !== "received") {
    throw new Error(`recordTransaction: type must be "sent" or "received", got "${type}"`);
  }

  // Validate and parse amount
  let amountBigInt;
  try {
    amountBigInt = BigInt(amount || "0");
    if (amountBigInt < 0n) throw new Error("Amount cannot be negative");
  } catch {
    console.warn(`recordTransaction: invalid amount "${amount}", skipping stats update`);
    amountBigInt = 0n;
  }

  // Increment transaction count
  this.transactionCount += 1;

  // Add amount to the correct running total using BigInt math
  if (type === "sent") {
    try {
      const current    = BigInt(this.totalSent || "0");
      this.totalSent   = (current + amountBigInt).toString();
    } catch {
      console.warn("recordTransaction: could not update totalSent");
    }
  } else {
    try {
      const current       = BigInt(this.totalReceived || "0");
      this.totalReceived  = (current + amountBigInt).toString();
    } catch {
      console.warn("recordTransaction: could not update totalReceived");
    }
  }

  // Update lastSeen timestamp
  this.lastSeen = new Date();

  // Save changes to database
  await this.save();
};

/**
 * addFavoriteRecipient — adds an address to the favorites list.
 *
 * Deduplicates automatically. Enforces max 10 entries by
 * removing the oldest entry when the limit is reached.
 *
 * @param  {string} recipientAddress - Ethereum address to add
 * @returns {Promise<void>}
 *
 * Usage:
 *   await user.addFavoriteRecipient("0x742d35...");
 */
UserSchema.methods.addFavoriteRecipient = async function (recipientAddress) {
  if (!recipientAddress) return;

  const normalized = recipientAddress.toLowerCase().trim();

  // Don't add if already in favorites
  if (this.favoriteRecipients.includes(normalized)) return;

  // Remove oldest entry if at limit (FIFO — first in, first out)
  if (this.favoriteRecipients.length >= 10) {
    this.favoriteRecipients.shift(); // Remove oldest (first element)
  }

  this.favoriteRecipients.push(normalized);
  await this.save();
};

/**
 * removeFavoriteRecipient — removes an address from favorites.
 *
 * @param  {string} recipientAddress - Ethereum address to remove
 * @returns {Promise<void>}
 */
UserSchema.methods.removeFavoriteRecipient = async function (recipientAddress) {
  if (!recipientAddress) return;

  const normalized = recipientAddress.toLowerCase().trim();
  this.favoriteRecipients = this.favoriteRecipients.filter(
    (addr) => addr !== normalized
  );
  await this.save();
};


// ============================================================
// 🪝  PRE-SAVE HOOK
// Normalizes data before every save.
// ============================================================
UserSchema.pre("save", function (next) {
  // Ensure favoriteRecipients are all lowercase and deduplicated
  if (this.isModified("favoriteRecipients")) {
    this.favoriteRecipients = [
      ...new Set(this.favoriteRecipients.map((a) => a.toLowerCase().trim())),
    ].slice(0, 10);
  }

  // Ensure email is lowercase
  if (this.isModified("email") && this.email) {
    this.email = this.email.toLowerCase().trim();
  }

  next();
});


// ============================================================
// 📤  EXPORT
// ============================================================
module.exports = mongoose.model("User", UserSchema);