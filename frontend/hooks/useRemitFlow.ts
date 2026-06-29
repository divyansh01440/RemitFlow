"use client";

// ============================================================
// 📄  hooks/useRemitFlow.ts — Smart Contract Interaction Hook
//
// This hook is the bridge between the React frontend and the
// RemitFlow smart contract on the Polygon blockchain.
//
// Every blockchain "write" action follows this 2-step flow:
//   Step 1: Approve USDC spending
//           (tell the USDC contract "RemitFlow can spend my tokens")
//   Step 2: Call the RemitFlow function
//           (actually send/deposit/withdraw)
//
// Why 2 steps?
//   ERC20 tokens (like USDC) require explicit permission before
//   another contract can move them. This is a security feature —
//   you must "approve" each contract that touches your tokens.
//
// Usage:
//   const { sendRemittance, feePercent, isLoading } = useRemitFlow()
//   await sendRemittance("0x123...", 100_000_000n) // Send 100 USDC
// ============================================================

import { useState, useCallback }           from "react";
import toast                                from "react-hot-toast";
import {
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
}                                           from "wagmi";
import {
  REMITFLOW_ABI,
  USDC_ABI,
  getContractAddress,
  getUSDCAddress,
  USDC_ADDRESSES,
}                                           from "../lib/contract";


// ============================================================
// 📐  RETURN TYPE
// ============================================================

export interface UseRemitFlowReturn {
  /** Current fee in basis points (30 = 0.3%). undefined while loading. */
  feePercent: bigint | undefined;

  /**
   * Sends USDC to a recipient via the RemitFlow contract.
   * Handles USDC approval automatically before sending.
   * @returns Transaction hash string, or undefined if failed
   */
  sendRemittance: (recipient: string, amount: bigint) => Promise<string | undefined>;

  /**
   * Deposits USDC into the yield/savings pool.
   * Handles USDC approval automatically before depositing.
   * @returns Transaction hash string, or undefined if failed
   */
  depositYield: (amount: bigint) => Promise<string | undefined>;

  /**
   * Withdraws USDC + earned yield from the savings pool.
   * @returns Transaction hash string, or undefined if failed
   */
  withdrawYield: (amount: bigint) => Promise<string | undefined>;

  /**
   * Returns how much USDC a user has deposited in the yield pool.
   * @param address - Wallet address to check
   */
  getUserBalance: (address: string) => bigint;

  /**
   * Returns pending yield (interest earned) for a user.
   * @param address - Wallet address to check
   */
  getPendingYield: (address: string) => bigint;

  /** True if any blockchain write transaction is currently pending */
  isLoading: boolean;

  /** The hash of the most recent transaction (for linking to Polygonscan) */
  lastTxHash: string | undefined;
}


// ============================================================
// 🎣  THE HOOK
// ============================================================

export function useRemitFlow(): UseRemitFlowReturn {

  // ----------------------------------------------------------
  // 🌐  CURRENT NETWORK
  // Get the chain ID so we know which contract addresses to use
  // ----------------------------------------------------------
  const chainId = useChainId();

  // Get the RemitFlow contract address for current network
  // Returns "" if not configured — we handle this gracefully below
  let contractAddress: `0x${string}` | undefined;
  let usdcAddress: `0x${string}` | undefined;

  try {
    contractAddress = getContractAddress(chainId) as `0x${string}`;
    usdcAddress     = getUSDCAddress(chainId) as `0x${string}`;
  } catch {
    // Contract not deployed on this network yet — addresses stay undefined
    contractAddress = undefined;
    usdcAddress     = undefined;
  }


  // ----------------------------------------------------------
  // 📊  LOCAL STATE
  // Track loading state and last transaction hash
  // ----------------------------------------------------------
  const [isLoading,   setIsLoading]   = useState(false);
  const [lastTxHash,  setLastTxHash]  = useState<string | undefined>(undefined);

  // Track the current pending tx hash so we can wait for receipt
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>(undefined);


  // ----------------------------------------------------------
  // 📖  READ: FEE PERCENT
  // Reads the current fee from the contract.
  // This is a "view" function — free, no gas cost.
  // Auto-refreshes every 30 seconds.
  // ----------------------------------------------------------
  const { data: feePercentData } = useReadContract({
    address:      contractAddress,
    abi:          REMITFLOW_ABI,
    functionName: "feePercent",
    query: {
      enabled:         !!contractAddress,
      refetchInterval: 30_000, // Refresh every 30 seconds
    },
  });

  const feePercent = feePercentData !== undefined
    ? BigInt(feePercentData.toString())
    : undefined;


  // ----------------------------------------------------------
  // 📖  READ: USER BALANCE (yield deposits)
  // We create a reactive read for the connected user.
  // For arbitrary addresses, we use a separate pattern below.
  // ----------------------------------------------------------
  const [balanceAddress,      setBalanceAddress]      = useState<string>("");
  const [pendingYieldAddress, setPendingYieldAddress] = useState<string>("");

  const { data: userBalanceData } = useReadContract({
    address:      contractAddress,
    abi:          REMITFLOW_ABI,
    functionName: "getUserBalance",
    args:         balanceAddress ? [balanceAddress as `0x${string}`] : undefined,
    query: {
      enabled:         !!contractAddress && !!balanceAddress,
      refetchInterval: 15_000,
    },
  });

  const { data: pendingYieldData } = useReadContract({
    address:      contractAddress,
    abi:          REMITFLOW_ABI,
    functionName: "calculateYield",
    args:         pendingYieldAddress ? [pendingYieldAddress as `0x${string}`] : undefined,
    query: {
      enabled:         !!contractAddress && !!pendingYieldAddress,
      refetchInterval: 15_000,
    },
  });

  /**
   * Returns the yield pool balance for any address.
   * Triggers a reactive read — component re-renders when data arrives.
   */
  const getUserBalance = useCallback((address: string): bigint => {
    // Set the address to trigger the useReadContract above
    if (address && address !== balanceAddress) {
      setBalanceAddress(address);
    }
    return userBalanceData ? BigInt(userBalanceData.toString()) : 0n;
  }, [balanceAddress, userBalanceData]);

  /**
   * Returns pending yield for any address.
   */
  const getPendingYield = useCallback((address: string): bigint => {
    if (address && address !== pendingYieldAddress) {
      setPendingYieldAddress(address);
    }
    return pendingYieldData ? BigInt(pendingYieldData.toString()) : 0n;
  }, [pendingYieldAddress, pendingYieldData]);


  // ----------------------------------------------------------
  // ✍️  WRITE CONTRACTS
  // useWriteContract gives us a function to call contract functions
  // that change blockchain state (costs gas).
  //
  // We use ONE writeContract function for ALL writes.
  // It's called with different args each time.
  // ----------------------------------------------------------
  const { writeContractAsync: writeContract } = useWriteContract();


  // ----------------------------------------------------------
  // ⏳  WAIT FOR RECEIPT
  // After submitting a transaction, we need to wait for it
  // to be included in a block (mined/confirmed).
  // useWaitForTransactionReceipt polls until it's confirmed.
  // ----------------------------------------------------------
  const { data: txReceipt } = useWaitForTransactionReceipt({
    hash:  pendingTxHash,
    query: { enabled: !!pendingTxHash },
  });


  // ============================================================
  // 🔧  INTERNAL HELPER: APPROVE USDC
  // Called before every send/deposit action.
  // Asks the USDC contract to allow RemitFlow to spend tokens.
  //
  // Flow:
  //   1. Call USDC.approve(remitflowAddress, amount)
  //   2. MetaMask popup: "Allow RemitFlow to spend your USDC?"
  //   3. User clicks Confirm
  //   4. Wait for approval tx to be mined
  //   5. Return — now RemitFlow can move the tokens
  // ============================================================
  const approveUSDC = async (
    amount:  bigint,
    toastId: string
  ): Promise<boolean> => {

    if (!usdcAddress || !contractAddress) {
      toast.error("Contract not configured for this network.", { id: toastId });
      return false;
    }

    try {
      // Update loading toast to show approval step
      toast.loading("Step 1/2: Approving USDC spending...", { id: toastId });

      // Call USDC.approve(remitflowAddress, amount)
      // This asks MetaMask: "Allow RemitFlow to spend X USDC"
      const approveTxHash = await writeContract({
        address:      usdcAddress,
        abi:          USDC_ABI,
        functionName: "approve",
        args:         [contractAddress, amount],
        gas:          BigInt(100000),
      });

      // Wait for the approval transaction to be mined
      // (usually takes ~2-5 seconds on Polygon)
      toast.loading("Waiting for approval confirmation...", { id: toastId });
      setPendingTxHash(approveTxHash);

      // Poll until the approval tx is confirmed
      // We implement a simple wait loop since useWaitForTransactionReceipt
      // is reactive (we use it for the final tx, not intermediate ones)
      await waitForTransaction(approveTxHash);

      toast.loading("USDC approved! Proceeding...", { id: toastId });
      return true;

    } catch (error: unknown) {
      const message = getErrorMessage(error);

      // User rejected the approval in MetaMask
      if (message.includes("User rejected") || message.includes("user rejected")) {
        toast.error("Approval cancelled.", { id: toastId });
      } else {
        toast.error(`Approval failed: ${message}`, { id: toastId });
      }
      return false;
    }
  };


  // ============================================================
  // 🔧  INTERNAL HELPER: WAIT FOR TRANSACTION
  // Polls the blockchain until a transaction hash is confirmed.
  // Uses a simple timeout-based polling approach.
  // ============================================================
  const waitForTransaction = async (hash: `0x${string}`): Promise<void> => {
    // We set the pending hash which triggers useWaitForTransactionReceipt
    setPendingTxHash(hash);

    // Wait up to 60 seconds for confirmation (Polygon blocks = ~2s each)
    const MAX_WAIT_MS  = 60_000;
    const POLL_INTERVAL = 2_000;
    const startTime    = Date.now();

    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        // Check if we have a receipt for this hash
        if (txReceipt && txReceipt.transactionHash === hash) {
          clearInterval(interval);
          setPendingTxHash(undefined);
          resolve();
          return;
        }

        // Timeout after MAX_WAIT_MS
        if (Date.now() - startTime > MAX_WAIT_MS) {
          clearInterval(interval);
          setPendingTxHash(undefined);
          // Don't reject — tx might still be pending, just took long
          resolve();
        }
      }, POLL_INTERVAL);
    });
  };


  // ============================================================
  // 🔧  INTERNAL HELPER: EXTRACT ERROR MESSAGE
  // Converts various error types to a user-friendly string.
  // ============================================================
  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      // Shorten long viem/wagmi error messages
      const msg = error.message;

      if (msg.includes("User rejected") || msg.includes("user rejected")) {
        return "Transaction cancelled in wallet.";
      }
      if (msg.includes("insufficient funds")) {
        return "Insufficient MATIC for gas fees.";
      }
      if (msg.includes("execution reverted")) {
        // Try to extract the revert reason
        const match = msg.match(/reason: (.+?)(\n|$)/);
        return match ? match[1] : "Transaction reverted by contract.";
      }
      // Return first 100 chars to avoid overwhelming the user
      return msg.slice(0, 100);
    }
    return "An unknown error occurred.";
  };


  // ============================================================
  // 💸  ACTION 1: SEND REMITTANCE
  // The main feature — sends USDC to another wallet.
  //
  // Full flow:
  //   1. Show loading toast
  //   2. Approve USDC (MetaMask popup #1)
  //   3. Call sendRemittance (MetaMask popup #2)
  //   4. Wait for confirmation
  //   5. Show success/error toast
  // ============================================================
  const sendRemittance = useCallback(async (
    recipient: string,
    amount:    bigint
  ): Promise<string | undefined> => {

    if (!contractAddress) {
      toast.error("RemitFlow contract not found on this network.");
      return undefined;
    }

    // Validate inputs before touching the blockchain
    if (!recipient || !recipient.startsWith("0x") || recipient.length !== 42) {
      toast.error("Invalid recipient address.");
      return undefined;
    }
    if (amount <= 0n) {
      toast.error("Amount must be greater than zero.");
      return undefined;
    }

    const toastId = toast.loading("Preparing transaction...");
    setIsLoading(true);

    try {
      // ── Step 1: Approve USDC ─────────────────────────────
      const approved = await approveUSDC(amount, toastId);
      if (!approved) {
        setIsLoading(false);
        return undefined;
      }

      // ── Step 2: Call sendRemittance ───────────────────────
      toast.loading("Step 2/2: Sending USDC... (confirm in wallet)", { id: toastId });

      const txHash = await writeContract({
        address:      contractAddress,
        abi:          REMITFLOW_ABI,
        functionName: "sendRemittance",
        args:         [recipient as `0x${string}`, amount],
        gas:          BigInt(500000),
      });

      // ── Step 3: Wait for confirmation ─────────────────────
      toast.loading("Waiting for transaction confirmation...", { id: toastId });
      setPendingTxHash(txHash);
      await waitForTransaction(txHash);

      // ── Step 4: Success! ──────────────────────────────────
      setLastTxHash(txHash);
      toast.success(
        `✅ USDC sent successfully!\nTx: ${txHash.slice(0, 10)}...`,
        {
          id:       toastId,
          duration: 6000,
        }
      );

      return txHash;

    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast.error(`Send failed: ${message}`, { id: toastId, duration: 5000 });
      return undefined;

    } finally {
      setIsLoading(false);
    }
  }, [contractAddress, usdcAddress, writeContract]);


  // ============================================================
  // 🏦  ACTION 2: DEPOSIT YIELD
  // Deposits USDC into the savings pool to earn 5% APY.
  //
  // Flow: Approve USDC → Call depositYield → Wait → Toast
  // ============================================================
  const depositYield = useCallback(async (
    amount: bigint
  ): Promise<string | undefined> => {

    if (!contractAddress) {
      toast.error("RemitFlow contract not found on this network.");
      return undefined;
    }
    if (amount <= 0n) {
      toast.error("Deposit amount must be greater than zero.");
      return undefined;
    }

    const toastId = toast.loading("Preparing deposit...");
    setIsLoading(true);

    try {
      // ── Step 1: Approve USDC ─────────────────────────────
      const approved = await approveUSDC(amount, toastId);
      if (!approved) {
        setIsLoading(false);
        return undefined;
      }

      // ── Step 2: Call depositYield ─────────────────────────
      toast.loading("Step 2/2: Depositing USDC... (confirm in wallet)", { id: toastId });

      const txHash = await writeContract({
        address:      contractAddress,
        abi:          REMITFLOW_ABI,
        functionName: "depositYield",
        args:         [amount],
        gas:          BigInt(500000),
      });

      // ── Step 3: Wait for confirmation ─────────────────────
      toast.loading("Confirming deposit...", { id: toastId });
      setPendingTxHash(txHash);
      await waitForTransaction(txHash);

      // ── Step 4: Success ───────────────────────────────────
      setLastTxHash(txHash);
      toast.success(
        "✅ USDC deposited! You're now earning 5% APY.",
        { id: toastId, duration: 6000 }
      );

      return txHash;

    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast.error(`Deposit failed: ${message}`, { id: toastId, duration: 5000 });
      return undefined;

    } finally {
      setIsLoading(false);
    }
  }, [contractAddress, usdcAddress, writeContract]);


  // ============================================================
  // 💰  ACTION 3: WITHDRAW YIELD
  // Withdraws deposited USDC + all earned yield.
  // No approval needed — the contract already holds the tokens.
  //
  // Flow: Call withdrawYield → Wait → Toast
  // ============================================================
  const withdrawYield = useCallback(async (
    amount: bigint
  ): Promise<string | undefined> => {

    if (!contractAddress) {
      toast.error("RemitFlow contract not found on this network.");
      return undefined;
    }
    if (amount <= 0n) {
      toast.error("Withdrawal amount must be greater than zero.");
      return undefined;
    }

    const toastId = toast.loading("Preparing withdrawal... (confirm in wallet)");
    setIsLoading(true);

    try {
      // No approval needed for withdrawal — contract already holds the USDC
      // Just call withdrawYield directly
      const txHash = await writeContract({
        address:      contractAddress,
        abi:          REMITFLOW_ABI,
        functionName: "withdrawYield",
        args:         [amount],
        gas:          BigInt(500000),
      });

      // Wait for confirmation
      toast.loading("Withdrawing your USDC + yield...", { id: toastId });
      setPendingTxHash(txHash);
      await waitForTransaction(txHash);

      // Success
      setLastTxHash(txHash);
      toast.success(
        "✅ Withdrawal successful! USDC + yield sent to your wallet.",
        { id: toastId, duration: 6000 }
      );

      return txHash;

    } catch (error: unknown) {
      const message = getErrorMessage(error);
      toast.error(`Withdrawal failed: ${message}`, { id: toastId, duration: 5000 });
      return undefined;

    } finally {
      setIsLoading(false);
    }
  }, [contractAddress, writeContract]);


  // ============================================================
  // 📤  RETURN
  // ============================================================
  return {
    // Contract data
    feePercent,

    // Write actions
    sendRemittance,
    depositYield,
    withdrawYield,

    // Read functions
    getUserBalance,
    getPendingYield,

    // State
    isLoading,
    lastTxHash,
  };
}

export default useRemitFlow;