// ============================================================
// 📄  api/transactions.js — Transaction API Router
//
// Handles all API endpoints related to RemitFlow transfers.
// Mounted at /api/transactions in server.js.
//
// Routes:
//   GET  /api/transactions/:address         → Get tx history
//   GET  /api/transactions/tx/:transferId   → Get single tx
//   POST /api/transactions/sync/:txHash     → Sync from chain
//   GET  /api/transactions/stats/:address   → Get wallet stats
// ============================================================

const router         = require("express").Router();
const { ethers }     = require("ethers");
const Transaction    = require("../models/Transaction");
const polygonService = require("../services/polygonService");


// ============================================================
// 🔧  HELPERS
// ============================================================

/**
 * validateAddress — checks if a string is a valid Ethereum address.
 * Returns true if valid, false if not.
 * Uses ethers.isAddress which handles checksummed + lowercase addresses.
 */
const validateAddress = (address) => {
  if (!address || typeof address !== "string") return false;
  return ethers.isAddress(address);
};

/**
 * validateTxHash — checks if a string looks like a valid tx hash.
 * Must be "0x" + 64 hex characters = 66 chars total.
 */
const validateTxHash = (hash) => {
  if (!address || typeof hash !== "string") return false;
  return /^0x[0-9a-fA-F]{64}$/.test(hash);
};

/**
 * upsertTransactions — saves on-chain transactions to MongoDB.
 * Uses bulkWrite with upsert so it's safe to call repeatedly.
 * Silently skips errors so the main response isn't affected.
 *
 * @param {object[]} onChainTxs - Formatted transactions from polygonService
 */
const upsertTransactions = async (onChainTxs) => {
  if (!onChainTxs || onChainTxs.length === 0) return;

  try {
    const ops = onChainTxs.map(tx => ({
      updateOne: {
        filter: { transferId: tx.transferId },
        update: { $setOnInsert: tx },  // Only set fields on INSERT, not update
        upsert: true,
      },
    }));

    const result = await Transaction.bulkWrite(ops, { ordered: false });

    if (result.upsertedCount > 0) {
      console.log(`💾  Indexed ${result.upsertedCount} new transaction(s) from chain`);
    }
  } catch (error) {
    // Don't crash the route if indexing fails
    console.warn("⚠️  upsertTransactions: failed to save some transactions:", error.message);
  }
};


// ============================================================
// 📡  ROUTE 1: GET /:address
// Returns paginated transaction history for a wallet address.
//
// Combines data from two sources:
//   1. MongoDB (fast, already indexed)
//   2. Polygon blockchain (fresh, catches any we haven't indexed)
//
// Query params:
//   status  — filter by status: 0, 1, or 2
//   limit   — results per page (default: 20, max: 100)
//   page    — page number (default: 1)
//   sort    — "desc" (default) or "asc"
// ============================================================
router.get("/:address", async (req, res, next) => {
  try {
    const { address }                         = req.params;
    const { status, sort = "desc" }           = req.query;
    const limit  = Math.min(Number(req.query.limit)  || 20, 100);
    const page   = Math.max(Number(req.query.page)   || 1,  1);
    const skip   = (page - 1) * limit;

    // ── Validate address ──────────────────────────────────
    if (!validateAddress(address)) {
      return res.status(400).json({
        error:   "Invalid address",
        message: `"${address}" is not a valid Ethereum address.`,
      });
    }

    const normalizedAddress = address.toLowerCase();

    // ── Fetch fresh data from blockchain (background) ─────
    // We do this BEFORE querying MongoDB so any new transactions
    // are upserted first, then returned in our DB query below.
    // We don't await this directly in the critical path — we let
    // it run and upsert what it finds.
    const onChainPromise = polygonService
      .getTransactionsByAddress(address)
      .then(txs => upsertTransactions(txs))
      .catch(err => {
        // Never crash the route if blockchain query fails
        console.warn("⚠️  Blockchain sync failed (non-fatal):", err.message);
      });

    // ── Build MongoDB query ───────────────────────────────
    const query = {
      $or: [
        { sender:    normalizedAddress },
        { recipient: normalizedAddress },
      ],
    };

    // Add status filter if provided and valid
    if (status !== undefined && [0, 1, 2].includes(Number(status))) {
      query.status = Number(status);
    }

    const sortOrder = sort === "asc" ? 1 : -1;

    // ── Wait for blockchain sync to complete ──────────────
    // This ensures freshly synced transactions appear in our response
    await onChainPromise;

    // ── Query MongoDB ─────────────────────────────────────
    const [transactions, total] = await Promise.all([
      Transaction
        .find(query)
        .sort({ timestamp: sortOrder, blockNumber: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(query),
    ]);

    // ── Return paginated response ─────────────────────────
    return res.json({
      transactions,
      total,
      page:  Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
      // Helpful metadata for the frontend
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    });

  } catch (error) {
    next(error);
  }
});


// ============================================================
// 📡  ROUTE 2: GET /tx/:transferId
// Returns a single transaction by its bytes32 transfer ID.
// The transferId is the keccak256 hash from the contract.
//
// Note: This route MUST be defined BEFORE /:address to avoid
// Express matching "tx" as an address parameter.
// ============================================================
router.get("/tx/:transferId", async (req, res, next) => {
  try {
    const { transferId } = req.params;

    // Basic validation — transferId should be a 66-char hex string
    if (!transferId || typeof transferId !== "string") {
      return res.status(400).json({
        error:   "Invalid transferId",
        message: "transferId must be a 66-character hex string starting with 0x",
      });
    }

    // ── Query MongoDB first (fast) ────────────────────────
    let transaction = await Transaction.findOne({
      transferId: transferId.toLowerCase(),
    }).lean();

    // ── If not in DB, try to fetch from blockchain ────────
    if (!transaction) {
      console.log(`🔍  transferId ${transferId} not in DB — checking blockchain...`);

      try {
        // getTransferStatus checks if the contract knows this transferId
        const statusResult = await polygonService.getTransferStatus(transferId);

        if (statusResult) {
          // Transfer exists on chain — return minimal info
          return res.json({
            transferId,
            status:      statusResult.status,
            statusLabel: statusResult.label,
            source:      "blockchain", // Indicates this came from chain, not DB
            message:     "Transaction found on blockchain but not yet indexed. Try syncing with POST /sync/:txHash",
          });
        }
      } catch {
        // Transfer not found on chain either
      }

      return res.status(404).json({
        error:   "Transaction not found",
        message: `No transaction found with transferId: ${transferId}`,
      });
    }

    return res.json(transaction);

  } catch (error) {
    next(error);
  }
});


// ============================================================
// 📡  ROUTE 3: POST /sync/:txHash
// Syncs a specific transaction from the blockchain into MongoDB.
//
// Called by the frontend immediately after sendRemittance()
// completes, to make sure the transaction is indexed.
//
// This is idempotent — safe to call multiple times with the
// same txHash. MongoDB upsert prevents duplicates.
// ============================================================
router.post("/sync/:txHash", async (req, res, next) => {
  try {
    const { txHash } = req.params;

    // ── Validate txHash format ────────────────────────────
    // Must be "0x" + exactly 64 hex characters = 66 chars total
    if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return res.status(400).json({
        error:   "Invalid transaction hash",
        message: "txHash must be a 66-character hex string starting with 0x",
        example: "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      });
    }

    // ── Sync from blockchain ──────────────────────────────
    console.log(`🔄  Syncing transaction: ${txHash}`);
    const saved = await polygonService.syncTransactionToDb(txHash);

    return res.json({
      success:     true,
      transaction: saved,
      message:     "Transaction synced successfully",
    });

  } catch (error) {
    // syncTransactionToDb throws descriptive errors — pass them through
    if (error.message?.includes("not found")) {
      return res.status(404).json({
        error:   "Transaction not found",
        message: error.message,
      });
    }
    if (error.message?.includes("No RemittanceSent event")) {
      return res.status(422).json({
        error:   "Not a RemitFlow transaction",
        message: error.message,
      });
    }
    next(error);
  }
});


// ============================================================
// 📡  ROUTE 4: GET /stats/:address
// Returns aggregate statistics for a wallet address.
//
// Uses MongoDB aggregation for efficiency — one query
// instead of fetching all transactions and summing in JS.
// ============================================================
router.get("/stats/:address", async (req, res, next) => {
  try {
    const { address } = req.params;

    // ── Validate address ──────────────────────────────────
    if (!validateAddress(address)) {
      return res.status(400).json({
        error:   "Invalid address",
        message: `"${address}" is not a valid Ethereum address.`,
      });
    }

    const normalizedAddress = address.toLowerCase();

    // ── Aggregate stats from MongoDB ──────────────────────
    // We run 3 aggregations in parallel for speed:
    //   1. Total USDC sent + sent count
    //   2. Total USDC received + received count
    //   3. Overall transaction count
    const [sentResult, receivedResult, totalCount] = await Promise.all([

      // Sent transactions
      Transaction.aggregate([
        {
          $match: {
            sender: normalizedAddress,
            status: 1,  // Only count completed transfers
          },
        },
        {
          $group: {
            _id:          null,
            totalSent:    { $sum: "$amountFormatted" },
            sentCount:    { $sum: 1 },
            lastSentAt:   { $max: "$timestamp" },
          },
        },
      ]),

      // Received transactions
      Transaction.aggregate([
        {
          $match: {
            recipient: normalizedAddress,
            status:    1,
          },
        },
        {
          $group: {
            _id:            null,
            totalReceived:  { $sum: "$amountFormatted" },
            receivedCount:  { $sum: 1 },
            lastReceivedAt: { $max: "$timestamp" },
          },
        },
      ]),

      // Total transactions (any status, either direction)
      Transaction.countDocuments({
        $or: [
          { sender:    normalizedAddress },
          { recipient: normalizedAddress },
        ],
      }),

    ]);

    // Extract values from aggregation results (may be empty arrays)
    const sent     = sentResult[0]     || { totalSent: 0,    sentCount: 0    };
    const received = receivedResult[0] || { totalReceived: 0, receivedCount: 0 };

    return res.json({
      address:          normalizedAddress,
      totalSent:        Math.round(sent.totalSent     * 100) / 100,
      totalReceived:    Math.round(received.totalReceived * 100) / 100,
      transactionCount: totalCount,
      sentCount:        sent.sentCount,
      receivedCount:    received.receivedCount,
      lastSentAt:       sent.lastSentAt     || null,
      lastReceivedAt:   received.lastReceivedAt || null,
    });

  } catch (error) {
    next(error);
  }
});


// ============================================================
// 📤  EXPORT
// ============================================================
module.exports = router;