const mongoose = require("mongoose");

// ============================================================
// 📄  Transaction.js — Mongoose Model
//
// Stores every RemitFlow remittance transfer on MongoDB.
// Each document represents ONE on-chain transfer event.
//
// Data flow:
//   Polygon blockchain → polygonService.js → this model → API
//
// Key design decisions:
//   - amount/fee stored as STRING to avoid BigInt precision loss
//     (JavaScript numbers can't handle large uint256 values safely)
//   - amountFormatted/feeFormatted pre-calculated for display
//   - sender/recipient always lowercase for reliable comparison
//   - transferId is the bytes32 keccak256 hash from the contract
// ============================================================


// ============================================================
// 📐  SCHEMA DEFINITION
// ============================================================
const TransactionSchema = new mongoose.Schema(
  {

    // ── BLOCKCHAIN IDENTITY ───────────────────────────────────

    /**
     * Unique transfer ID — the bytes32 keccak256 hash returned
     * by RemitFlow.sendRemittance() on the blockchain.
     * Used to look up transfer status and deduplicate records.
     * Example: "0xabc123...def456" (66 characters)
     */
    transferId: {
      type:     String,
      required: [true, "transferId is required"],
      unique:   true,
      index:    true,
      trim:     true,
    },

    /**
     * Ethereum wallet address of the person who sent USDC.
     * Stored lowercase for case-insensitive comparisons.
     * Example: "0x742d35cc6634c0532925a3b844bc454e4438f44e"
     */
    sender: {
      type:      String,
      required:  [true, "sender address is required"],
      index:     true,
      lowercase: true,
      trim:      true,
    },

    /**
     * Ethereum wallet address of the person who received USDC.
     * Stored lowercase for case-insensitive comparisons.
     */
    recipient: {
      type:      String,
      required:  [true, "recipient address is required"],
      index:     true,
      lowercase: true,
      trim:      true,
    },


    // ── AMOUNTS ───────────────────────────────────────────────

    /**
     * Raw USDC amount as a string (preserves BigInt precision).
     * USDC has 6 decimal places: "1000000" = 1 USDC
     *
     * Why string?
     *   uint256 values from Solidity can exceed Number.MAX_SAFE_INTEGER
     *   (9,007,199,254,740,991). Storing as string prevents precision loss.
     *
     * Example: "100500000" = 100.50 USDC
     */
    amount: {
      type:     String,
      required: [true, "amount is required"],
      default:  "0",
    },

    /**
     * Human-readable amount as a float (pre-calculated for display).
     * Example: 100.5 (for 100.50 USDC)
     * Calculated by: Number(amount) / 1_000_000
     */
    amountFormatted: {
      type:    Number,
      default: 0,
      min:     0,
    },

    /**
     * Raw fee amount as string (same reasoning as amount).
     * Example: "300000" = 0.30 USDC fee (0.3% of 100 USDC)
     */
    fee: {
      type:    String,
      default: "0",
    },

    /**
     * Human-readable fee as a float.
     * Example: 0.30 (for 0.30 USDC fee)
     */
    feeFormatted: {
      type:    Number,
      default: 0,
      min:     0,
    },


    // ── TRANSFER STATUS ───────────────────────────────────────

    /**
     * Transfer status code — mirrors the contract's enum:
     *   0 = Pending   (created, awaiting confirmation)
     *   1 = Completed (transfer successful, funds delivered)
     *   2 = Refunded  (transfer reversed, funds returned)
     *
     * Use the virtual "statusLabel" for a human-readable string.
     */
    status: {
      type:    Number,
      enum:    {
        values:  [0, 1, 2],
        message: "status must be 0 (pending), 1 (completed), or 2 (refunded)",
      },
      default: 0,
    },


    // ── BLOCKCHAIN METADATA ───────────────────────────────────

    /**
     * The Polygon transaction hash (not the same as transferId).
     * Use this to link to Polygonscan: polygonscan.com/tx/{txHash}
     * Example: "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
     */
    txHash: {
      type:  String,
      index: true,
      trim:  true,
    },

    /**
     * The Polygon block number this transaction was included in.
     * Used to fetch transaction history from a specific block onwards.
     * Example: 52847291
     */
    blockNumber: {
      type: Number,
      min:  0,
    },

    /**
     * Which Polygon network this transaction is on.
     * "polygon" = mainnet (real money)
     * "mumbai"  = testnet (test money) — kept for historical records
     * Note: Amoy testnet transactions are stored as "mumbai" for
     *       backward compatibility
     */
    network: {
      type:    String,
      enum:    {
        values:  ["polygon", "mumbai", "amoy"],
        message: "network must be polygon, mumbai, or amoy",
      },
      default: "polygon",
    },

    /**
     * When the transfer happened on the blockchain.
     * Set from block.timestamp (Unix seconds → converted to Date).
     * Indexed for efficient sorting by newest first.
     */
    timestamp: {
      type:    Date,
      default: Date.now,
      index:   true,
    },

  },

  {
    // ── SCHEMA OPTIONS ─────────────────────────────────────────

    /**
     * timestamps: true automatically adds:
     *   - createdAt: when this MongoDB document was created
     *   - updatedAt: when this MongoDB document was last modified
     *
     * Note: "timestamp" field above = blockchain event time
     *       "createdAt" = when we saved it to our database
     *       These are different and both useful!
     */
    timestamps: true,

    /**
     * toJSON: include virtuals when converting to JSON
     * (so statusLabel appears in API responses)
     */
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);


// ============================================================
// 🔮  VIRTUAL FIELDS
// Virtuals are computed properties — they're not stored in
// MongoDB but appear when you call .toJSON() or .toObject().
// ============================================================

/**
 * statusLabel — human-readable status string
 *
 * Returns "pending", "completed", or "refunded" based on status code.
 * Used in API responses and frontend display.
 *
 * Usage:
 *   const tx = await Transaction.findOne({ transferId });
 *   console.log(tx.statusLabel); // "completed"
 */
TransactionSchema.virtual("statusLabel").get(function () {
  switch (this.status) {
    case 0:  return "pending";
    case 1:  return "completed";
    case 2:  return "refunded";
    default: return "unknown";
  }
});

/**
 * polygonscanUrl — direct link to this transaction on Polygonscan
 *
 * Usage:
 *   console.log(tx.polygonscanUrl);
 *   // "https://polygonscan.com/tx/0x..."
 */
TransactionSchema.virtual("polygonscanUrl").get(function () {
  if (!this.txHash) return null;

  const base = this.network === "polygon"
    ? "https://polygonscan.com"
    : "https://amoy.polygonscan.com";

  return `${base}/tx/${this.txHash}`;
});


// ============================================================
// 🔧  STATIC METHODS
// Called on the Model class itself (not on instances).
// Example: Transaction.findByAddress("0x123...")
// ============================================================

/**
 * findByAddress — finds all transactions for a wallet address
 *
 * Searches both sender AND recipient fields so you get the
 * complete transaction history for any wallet.
 *
 * Results sorted by timestamp descending (newest first).
 *
 * @param {string} address - Ethereum wallet address (any case)
 * @returns {Promise<Transaction[]>} Array of transaction documents
 *
 * Usage:
 *   const txs = await Transaction.findByAddress("0x742d35...");
 *   // Returns all sends AND receives for that address
 */
TransactionSchema.statics.findByAddress = async function (address) {
  if (!address) return [];

  // Normalize to lowercase for consistent matching
  const normalized = address.toLowerCase().trim();

  return this.find({
    $or: [
      { sender:    normalized },
      { recipient: normalized },
    ],
  })
    .sort({ timestamp: -1 }) // Newest first
    .lean();                  // Return plain JS objects (faster than Mongoose docs)
};

/**
 * findByTransferId — looks up a single transfer by its bytes32 ID
 *
 * @param {string} transferId - The keccak256 hash from the contract
 * @returns {Promise<Transaction|null>}
 *
 * Usage:
 *   const tx = await Transaction.findByTransferId("0xabc123...");
 */
TransactionSchema.statics.findByTransferId = async function (transferId) {
  if (!transferId) return null;
  return this.findOne({ transferId: transferId.toLowerCase() });
};

/**
 * getStats — returns aggregate stats for a wallet address
 *
 * @param {string} address - Ethereum wallet address
 * @returns {{ totalSent: number, totalReceived: number, count: number }}
 *
 * Usage:
 *   const stats = await Transaction.getStats("0x742d35...");
 *   // { totalSent: 500.50, totalReceived: 200.00, count: 15 }
 */
TransactionSchema.statics.getStats = async function (address) {
  if (!address) return { totalSent: 0, totalReceived: 0, count: 0 };

  const normalized = address.toLowerCase().trim();

  const [sentResult, receivedResult, count] = await Promise.all([
    // Total USDC sent
    this.aggregate([
      { $match: { sender: normalized, status: 1 } },
      { $group: { _id: null, total: { $sum: "$amountFormatted" } } },
    ]),

    // Total USDC received
    this.aggregate([
      { $match: { recipient: normalized, status: 1 } },
      { $group: { _id: null, total: { $sum: "$amountFormatted" } } },
    ]),

    // Total transaction count
    this.countDocuments({
      $or: [{ sender: normalized }, { recipient: normalized }],
    }),
  ]);

  return {
    totalSent:     sentResult[0]?.total     ?? 0,
    totalReceived: receivedResult[0]?.total ?? 0,
    count,
  };
};


// ============================================================
// 🪝  MIDDLEWARE (PRE-SAVE HOOKS)
// Runs automatically before each document is saved.
// ============================================================

/**
 * Pre-save: auto-calculate amountFormatted and feeFormatted
 * so we don't have to do it manually every time we save.
 */
TransactionSchema.pre("save", function (next) {
  // Calculate human-readable amount from raw string
  if (this.amount) {
    try {
      this.amountFormatted = Number(BigInt(this.amount)) / 1_000_000;
    } catch {
      this.amountFormatted = 0;
    }
  }

  // Calculate human-readable fee from raw string
  if (this.fee) {
    try {
      this.feeFormatted = Number(BigInt(this.fee)) / 1_000_000;
    } catch {
      this.feeFormatted = 0;
    }
  }

  next();
});


// ============================================================
// 📤  EXPORT
// ============================================================
module.exports = mongoose.model("Transaction", TransactionSchema);