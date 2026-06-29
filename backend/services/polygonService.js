// ============================================================
// ⚠️  LOAD ENV FIRST
// ============================================================
require("dotenv").config({ path: "../.env" });

const { ethers }    = require("ethers");
const Transaction   = require("../models/Transaction");

// ============================================================
// 🔌  PROVIDER SETUP
// JsonRpcProvider connects to Polygon via your Alchemy RPC URL.
//
// HOW TO GET YOUR RPC URL:
//   1. Go to https://alchemy.com → create app → Polygon PoS
//   2. Copy the HTTPS URL
//   3. Add to .env: POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
//      or for testnet: POLYGON_AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
// ============================================================
const RPC_URL = process.env.POLYGON_RPC_URL
             || process.env.POLYGON_AMOY_RPC_URL
             || "https://polygon-rpc.com"; // Public fallback (slower)

const provider = new ethers.JsonRpcProvider(RPC_URL);


// ============================================================
// 📋  REMITFLOW CONTRACT ABI (minimal)
// Only the functions and events we actually call in this file.
// Full ABI lives in frontend/lib/contract.ts — keep them in sync.
// ============================================================
const REMITFLOW_ABI = [

  // ── FUNCTIONS ──────────────────────────────────────────────

  {
    name:            "sendRemittance",
    type:            "function",
    stateMutability: "nonpayable",
    inputs:  [
      { name: "recipient", type: "address" },
      { name: "amount",    type: "uint256" },
    ],
    outputs: [
      { name: "transferId", type: "bytes32" },
    ],
  },

  {
    name:            "getUserBalance",
    type:            "function",
    stateMutability: "view",
    inputs:  [{ name: "user", type: "address" }],
    outputs: [{ name: "",     type: "uint256" }],
  },

  {
    name:            "calculateYield",
    type:            "function",
    stateMutability: "view",
    inputs:  [{ name: "user", type: "address" }],
    outputs: [{ name: "",     type: "uint256" }],
  },

  {
    name:            "getTransferStatus",
    type:            "function",
    stateMutability: "view",
    inputs:  [{ name: "transferId", type: "bytes32" }],
    outputs: [{ name: "",           type: "uint8"   }],
  },

  // ── EVENTS ─────────────────────────────────────────────────

  {
    name: "RemittanceSent",
    type: "event",
    inputs: [
      { name: "sender",     type: "address", indexed: true  },
      { name: "recipient",  type: "address", indexed: true  },
      { name: "amount",     type: "uint256", indexed: false },
      { name: "fee",        type: "uint256", indexed: false },
      { name: "transferId", type: "bytes32", indexed: false },
    ],
  },

];


// ============================================================
// 📍  CONTRACT INSTANCE
// ============================================================
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

if (!CONTRACT_ADDRESS) {
  console.warn(
    "⚠️  polygonService: NEXT_PUBLIC_CONTRACT_ADDRESS not set in .env\n" +
    "   Deploy the contract first, then add the address to .env"
  );
}

// Create contract instance (read-only — no signer needed for queries)
const contract = CONTRACT_ADDRESS
  ? new ethers.Contract(CONTRACT_ADDRESS, REMITFLOW_ABI, provider)
  : null;

// ============================================================
// 🔧  INTERNAL HELPERS
// ============================================================

/**
 * Determine the current network name from the chain ID.
 * Used to tag transactions with the right network label.
 */
const getNetworkName = async () => {
  try {
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    if (chainId === 137)   return "polygon";
    if (chainId === 80002) return "amoy";
    if (chainId === 80001) return "mumbai";
    return "polygon";
  } catch {
    return "polygon";
  }
};

/**
 * Formats a raw ethers event log into a plain JS object
 * that matches our Transaction MongoDB schema.
 */
const formatEventToTx = (event, networkName = "polygon") => ({
  transferId:      event.args.transferId,
  sender:          event.args.sender.toLowerCase(),
  recipient:       event.args.recipient.toLowerCase(),
  amount:          event.args.amount.toString(),
  amountFormatted: Number(event.args.amount) / 1_000_000,
  fee:             event.args.fee.toString(),
  feeFormatted:    Number(event.args.fee) / 1_000_000,
  status:          1,  // RemittanceSent means it completed successfully
  txHash:          event.transactionHash,
  blockNumber:     event.blockNumber,
  network:         networkName,
  timestamp:       new Date(),  // Will be overwritten with block timestamp if available
});


// ============================================================
// 📡  EXPORTED FUNCTIONS
// ============================================================

/**
 * getTransactionsByAddress
 *
 * Fetches all RemittanceSent events where the given address
 * was either the sender OR the recipient.
 *
 * Uses two separate event queries (one per indexed topic) because
 * ethers v6 can't OR-filter different indexed parameters in one call.
 *
 * @param  {string} address - Ethereum wallet address
 * @returns {Promise<object[]>} Formatted transaction objects, newest first
 */
const getTransactionsByAddress = async (address) => {
  if (!contract) {
    throw new Error("polygonService: contract not initialized — check NEXT_PUBLIC_CONTRACT_ADDRESS");
  }
  if (!address) {
    throw new Error("polygonService: address is required");
  }

  try {
    const normalized = address.toLowerCase();

    // Get current block for range (query last 100,000 blocks ≈ ~7 days on Polygon)
    const currentBlock = await provider.getBlockNumber();
    const fromBlock    = Math.max(0, currentBlock - 100_000);

    console.log(`📡  Fetching events for ${normalized} from block ${fromBlock} to ${currentBlock}`);

    // ── Query 1: Events where address is SENDER ───────────────
    // Filter on the first indexed topic (sender)
    const sentFilter = contract.filters.RemittanceSent(normalized, null);
    const sentEvents = await contract.queryFilter(sentFilter, fromBlock, currentBlock);

    // ── Query 2: Events where address is RECIPIENT ────────────
    // Filter on the second indexed topic (recipient)
    const receivedFilter = contract.filters.RemittanceSent(null, normalized);
    const receivedEvents = await contract.queryFilter(receivedFilter, fromBlock, currentBlock);

    console.log(`    Found ${sentEvents.length} sent + ${receivedEvents.length} received events`);

    // ── Merge and deduplicate by txHash ───────────────────────
    const allEvents  = [...sentEvents, ...receivedEvents];
    const seen       = new Set();
    const networkName = await getNetworkName();

    const formatted = allEvents
      .filter(event => {
        // Deduplicate: skip if we've already processed this txHash
        if (seen.has(event.transactionHash)) return false;
        seen.add(event.transactionHash);
        return true;
      })
      .map(event => formatEventToTx(event, networkName));

    // ── Enrich with block timestamps ──────────────────────────
    // Fetch timestamps in batches to avoid overwhelming the RPC
    const BATCH_SIZE = 10;
    for (let i = 0; i < formatted.length; i += BATCH_SIZE) {
      const batch = formatted.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (tx) => {
          try {
            const block = await provider.getBlock(tx.blockNumber);
            if (block) {
              tx.timestamp = new Date(Number(block.timestamp) * 1000);
            }
          } catch {
            // Keep default timestamp if block fetch fails
          }
        })
      );
    }

    // Sort newest first (by blockNumber descending)
    return formatted.sort((a, b) => b.blockNumber - a.blockNumber);

  } catch (error) {
    console.error("❌  getTransactionsByAddress error:", error.message);
    throw new Error(`Failed to fetch transactions for ${address}: ${error.message}`);
  }
};


/**
 * getYieldBalance
 *
 * Reads the current yield deposit balance and pending yield
 * for a given address directly from the smart contract.
 *
 * These are "view" functions — free to call, no gas needed.
 *
 * @param  {string} address - Ethereum wallet address
 * @returns {Promise<{ deposited: string, pendingYield: string }>}
 *          Raw USDC amounts as strings (6 decimal places)
 *
 * Usage:
 *   const { deposited, pendingYield } = await getYieldBalance("0x...");
 *   // deposited = "1000000000" (1000 USDC in raw units)
 */
const getYieldBalance = async (address) => {
  if (!contract) {
    throw new Error("polygonService: contract not initialized");
  }
  if (!address) {
    throw new Error("polygonService: address is required");
  }

  try {
    console.log(`📡  Fetching yield balance for ${address}`);

    // Call both contract functions in parallel for speed
    const [rawDeposited, rawYield] = await Promise.all([
      contract.getUserBalance(address),
      contract.calculateYield(address),
    ]);

    const deposited   = rawDeposited.toString();
    const pendingYield = rawYield.toString();

    console.log(`    Deposited: ${deposited}, Pending yield: ${pendingYield}`);

    return {
      deposited,
      pendingYield,
      // Also return human-readable versions for convenience
      depositedFormatted:    (Number(rawDeposited) / 1_000_000).toFixed(6),
      pendingYieldFormatted: (Number(rawYield)     / 1_000_000).toFixed(6),
    };

  } catch (error) {
    console.error("❌  getYieldBalance error:", error.message);
    throw new Error(`Failed to fetch yield balance for ${address}: ${error.message}`);
  }
};


/**
 * syncTransactionToDb
 *
 * Fetches a transaction from the blockchain by its hash,
 * parses the RemittanceSent event log, and upserts it into MongoDB.
 *
 * Called by the frontend after sendRemittance() completes,
 * to make sure the transaction is indexed in our database.
 *
 * Uses "upsert" so it's safe to call multiple times with the
 * same txHash — it will update rather than duplicate.
 *
 * @param  {string} txHash - Polygon transaction hash ("0x...")
 * @returns {Promise<object>} The saved/updated Transaction document
 */
const syncTransactionToDb = async (txHash) => {
  if (!contract) {
    throw new Error("polygonService: contract not initialized");
  }
  if (!txHash) {
    throw new Error("polygonService: txHash is required");
  }

  try {
    console.log(`📡  Syncing transaction: ${txHash}`);

    // ── Fetch receipt from blockchain ─────────────────────────
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      throw new Error(`Transaction ${txHash} not found or not yet mined`);
    }

    console.log(`    Receipt found — block ${receipt.blockNumber}, status: ${receipt.status}`);

    // ── Parse RemittanceSent log from receipt ─────────────────
    // The receipt contains raw logs — we need to decode them using the ABI
    let parsedEvent = null;

    const contractInterface = new ethers.Interface(REMITFLOW_ABI);

    for (const log of receipt.logs) {
      // Skip logs from other contracts
      if (log.address.toLowerCase() !== CONTRACT_ADDRESS?.toLowerCase()) continue;

      try {
        const parsed = contractInterface.parseLog({
          topics: log.topics,
          data:   log.data,
        });

        if (parsed && parsed.name === "RemittanceSent") {
          parsedEvent = parsed;
          break; // Found our event — stop looking
        }
      } catch {
        // This log is from a different event — skip it
        continue;
      }
    }

    if (!parsedEvent) {
      throw new Error(
        `No RemittanceSent event found in transaction ${txHash}. ` +
        "Make sure this is a RemitFlow transaction."
      );
    }

    // ── Get block timestamp ───────────────────────────────────
    let timestamp = new Date();
    try {
      const block = await provider.getBlock(receipt.blockNumber);
      if (block) {
        timestamp = new Date(Number(block.timestamp) * 1000);
      }
    } catch {
      console.warn("    Could not fetch block timestamp, using current time");
    }

    const networkName = await getNetworkName();

    // ── Build transaction data object ─────────────────────────
    const txData = {
      transferId:      parsedEvent.args.transferId,
      sender:          parsedEvent.args.sender.toLowerCase(),
      recipient:       parsedEvent.args.recipient.toLowerCase(),
      amount:          parsedEvent.args.amount.toString(),
      amountFormatted: Number(parsedEvent.args.amount) / 1_000_000,
      fee:             parsedEvent.args.fee.toString(),
      feeFormatted:    Number(parsedEvent.args.fee) / 1_000_000,
      status:          receipt.status === 1 ? 1 : 0,
      // receipt.status: 1 = success, 0 = reverted
      txHash:          txHash.toLowerCase(),
      blockNumber:     receipt.blockNumber,
      network:         networkName,
      timestamp,
    };

    // ── Upsert into MongoDB ───────────────────────────────────
    // findOneAndUpdate with upsert:true creates if not found,
    // updates if found — safe to call multiple times.
    const saved = await Transaction.findOneAndUpdate(
      { transferId: txData.transferId }, // Find by unique transferId
      { $set: txData },                  // Update all fields
      {
        upsert:    true,   // Create if doesn't exist
        new:       true,   // Return the updated document
        runValidators: true,
      }
    );

    console.log(`✅  Transaction synced: ${txData.transferId}`);
    return saved;

  } catch (error) {
    console.error("❌  syncTransactionToDb error:", error.message);
    throw new Error(`Failed to sync transaction ${txHash}: ${error.message}`);
  }
};


/**
 * getTransferStatus
 *
 * Reads the on-chain status of a transfer by its transferId.
 *
 * @param  {string} transferId - bytes32 transfer ID from the contract
 * @returns {Promise<{ status: number, label: string }>}
 */
const getTransferStatus = async (transferId) => {
  if (!contract) {
    throw new Error("polygonService: contract not initialized");
  }
  if (!transferId) {
    throw new Error("polygonService: transferId is required");
  }

  try {
    const statusCode = await contract.getTransferStatus(transferId);
    const status     = Number(statusCode);
    const labels     = ["pending", "completed", "refunded"];

    return {
      status,
      label: labels[status] ?? "unknown",
    };

  } catch (error) {
    console.error("❌  getTransferStatus error:", error.message);
    throw new Error(`Failed to get transfer status for ${transferId}: ${error.message}`);
  }
};


// ============================================================
// 📤  EXPORTS
// ============================================================
module.exports = {
  getTransactionsByAddress,
  getYieldBalance,
  syncTransactionToDb,
  getTransferStatus,
  // Export provider and contract for use in other services
  provider,
  contract,
};