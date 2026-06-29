"use client";

// ============================================================
// 📄  hooks/useYield.ts — Yield / Savings Pool Hook
//
// This hook manages everything related to a user's yield deposit:
//   - How much USDC they've deposited (principal)
//   - How much yield/interest they've earned so far
//   - A live-updating estimate between blockchain reads
//   - Total value (principal + yield)
//
// Why do we estimate yield locally?
//   Reading from the blockchain costs an RPC call and takes ~1s.
//   We can't do that every second. Instead, we:
//     1. Fetch the real yield from chain every 30 seconds
//     2. Between fetches, calculate an ESTIMATE locally using
//        the same formula as the smart contract
//   This gives a "live ticker" feel without hammering the RPC.
//
// Usage:
//   const { depositedAmount, pendingYield, totalValue } = useYield(address)
// ============================================================

import { useEffect, useState, useCallback, useRef } from "react";
import { useReadContract, useChainId }               from "wagmi";
import { REMITFLOW_ABI, getContractAddress }         from "../lib/contract";
import { calculateEstimatedYield }                   from "../lib/utils";


// ============================================================
// 📐  TYPES
// ============================================================

export interface UseYieldReturn {
  /** How much USDC the user has deposited (principal, raw 6-decimal units) */
  depositedAmount: bigint;

  /**
   * Pending yield earned since deposit (raw 6-decimal units).
   * Updates locally every second for a live ticker effect.
   * Syncs with blockchain every 30 seconds.
   */
  pendingYield: bigint;

  /** Total value = depositedAmount + pendingYield (raw 6-decimal units) */
  totalValue: bigint;

  /** Annual Percentage Yield — always 5% for RemitFlow */
  apy: number;

  /** True while fetching deposit or yield data from the blockchain */
  isLoading: boolean;

  /** Manually trigger a fresh blockchain read for both deposit and yield */
  refetch: () => void;

  /** Unix timestamp (seconds) of when the user last deposited */
  depositTimestamp: number;

  /** True if the user has an active yield deposit */
  hasDeposit: boolean;
}


// ============================================================
// 🔢  CONSTANTS
// Match these exactly with RemitFlow.sol to keep estimates accurate
// ============================================================

/** 5% APY — matches APY_RATE in RemitFlow.sol */
const APY = 5;

/** How often to refetch yield from blockchain (milliseconds) */
const BLOCKCHAIN_REFETCH_INTERVAL_MS = 30_000; // 30 seconds

/** How often to update the local yield estimate (milliseconds) */
const LOCAL_ESTIMATE_INTERVAL_MS = 10_000; // 10 seconds


// ============================================================
// 🎣  THE HOOK
// ============================================================

export function useYield(userAddress: string | undefined): UseYieldReturn {

  // ----------------------------------------------------------
  // 🌐  NETWORK
  // Get chain ID to look up the right contract address
  // ----------------------------------------------------------
  const chainId = useChainId();

  // Safely get contract address (undefined if not deployed on this chain)
  let contractAddress: `0x${string}` | undefined;
  try {
    contractAddress = getContractAddress(chainId) as `0x${string}`;
  } catch {
    contractAddress = undefined;
  }

  // Whether queries should run — need both address and contract
  const isEnabled = !!userAddress && !!contractAddress;


  // ----------------------------------------------------------
  // 📊  LOCAL STATE
  // pendingYield is kept in local state so we can update it
  // both from blockchain reads AND local estimates
  // ----------------------------------------------------------

  /** Live-updating yield estimate (starts at 0n, updated by interval) */
  const [pendingYield, setPendingYield] = useState<bigint>(0n);

  /**
   * The Unix timestamp when the user deposited.
   * We need this to calculate local yield estimates.
   * Fetched from the contract's yieldTimestamp mapping.
   */
  const [depositTimestamp, setDepositTimestamp] = useState<number>(0);

  /**
   * Ref to track the latest rawYield from blockchain.
   * Using a ref instead of state to avoid re-render loops
   * inside the setInterval callback.
   */
  const rawYieldRef          = useRef<bigint>(0n);
  const depositTimestampRef  = useRef<number>(0);
  const depositedAmountRef   = useRef<bigint>(0n);


  // ----------------------------------------------------------
  // 📖  READ: DEPOSITED AMOUNT (Principal)
  // Calls getUserBalance(userAddress) on the contract.
  // Returns how much USDC the user has deposited.
  // Does NOT include pending yield.
  // ----------------------------------------------------------
  const {
    data:      depositedAmountData,
    isLoading: isLoadingBalance,
    refetch:   refetchBalance,
  } = useReadContract({
    address:      contractAddress,
    abi:          REMITFLOW_ABI,
    functionName: "getUserBalance",
    args:         userAddress ? [userAddress as `0x${string}`] : undefined,
    query: {
      enabled:         isEnabled,
      refetchInterval: BLOCKCHAIN_REFETCH_INTERVAL_MS,
      // Refetch when user returns to the tab
      refetchOnWindowFocus: true,
    },
  });

  // Convert to bigint safely
  const depositedAmount: bigint = depositedAmountData
    ? BigInt(depositedAmountData.toString())
    : 0n;

  // Keep ref in sync for use inside intervals
  depositedAmountRef.current = depositedAmount;


  // ----------------------------------------------------------
  // 📖  READ: YIELD TIMESTAMP
  // Reads yieldTimestamp[userAddress] from the contract.
  // This is when the user last deposited/compounded.
  // We need it to calculate local yield estimates.
  // ----------------------------------------------------------
  const {
    data: yieldTimestampData,
  } = useReadContract({
    address:      contractAddress,
    abi:          REMITFLOW_ABI,
    functionName: "yieldTimestamp" as any, // Public mapping auto-generates getter
    args:         userAddress ? [userAddress as `0x${string}`] : undefined,
    query: {
      enabled:         isEnabled,
      refetchInterval: BLOCKCHAIN_REFETCH_INTERVAL_MS,
    },
  });

  // Sync timestamp to state and ref
  useEffect(() => {
    if (yieldTimestampData) {
      const ts = Number(yieldTimestampData.toString());
      setDepositTimestamp(ts);
      depositTimestampRef.current = ts;
    }
  }, [yieldTimestampData]);


  // ----------------------------------------------------------
  // 📖  READ: RAW YIELD FROM BLOCKCHAIN
  // Calls calculateYield(userAddress) on the contract.
  // This is the authoritative yield value — our local estimate
  // is just an approximation between these blockchain reads.
  // ----------------------------------------------------------
  const {
    data:      rawYieldData,
    isLoading: isLoadingYield,
    refetch:   refetchYield,
  } = useReadContract({
    address:      contractAddress,
    abi:          REMITFLOW_ABI,
    functionName: "calculateYield",
    args:         userAddress ? [userAddress as `0x${string}`] : undefined,
    query: {
      enabled:         isEnabled,
      // Refetch from blockchain on this interval
      refetchInterval: BLOCKCHAIN_REFETCH_INTERVAL_MS,
      refetchOnWindowFocus: true,
    },
  });

  // When we get a fresh yield from the blockchain, update our state
  // This "resets" the local estimate to the authoritative value
  useEffect(() => {
    if (rawYieldData !== undefined) {
      const yieldBigInt = BigInt(rawYieldData.toString());
      rawYieldRef.current = yieldBigInt;
      setPendingYield(yieldBigInt);
    }
  }, [rawYieldData]);


  // ----------------------------------------------------------
  // ⏱️  LOCAL YIELD ESTIMATE INTERVAL
  // Every 10 seconds, recalculate an estimated yield locally.
  // This uses the same formula as the smart contract:
  //   yield = principal × 5% × (elapsed / secondsPerYear)
  //
  // This gives the UI a "live updating" feel without needing
  // a blockchain call every second.
  //
  // The estimate will slightly diverge from the real value,
  // but it syncs back to accurate every 30 seconds when we
  // refetch from the blockchain.
  // ----------------------------------------------------------
  useEffect(() => {
    // Don't start interval if user has no deposit
    if (!userAddress || depositedAmountRef.current === 0n) {
      setPendingYield(0n);
      return;
    }

    // Update estimate immediately (don't wait for first interval tick)
    const updateEstimate = () => {
      const ts = depositTimestampRef.current;

      // If we don't have a timestamp yet, can't estimate
      if (ts === 0) return;

      const estimated = calculateEstimatedYield(
        depositedAmountRef.current,
        ts
      );

      // Only update if the estimate is higher than last known blockchain value
      // (yield can only go up, never down — prevents display flickering)
      if (estimated >= rawYieldRef.current) {
        setPendingYield(estimated);
      } else {
        // If estimate is somehow lower (shouldn't happen), use blockchain value
        setPendingYield(rawYieldRef.current);
      }
    };

    // Run immediately on mount / when address changes
    updateEstimate();

    // Then run on interval
    const intervalId = setInterval(updateEstimate, LOCAL_ESTIMATE_INTERVAL_MS);

    // ── CLEANUP ──────────────────────────────────────────────
    // This runs when:
    //   - userAddress changes (user switches wallets)
    //   - Component unmounts (user navigates away)
    // Without cleanup, the interval keeps running in background
    // and may try to update state on an unmounted component.
    return () => {
      clearInterval(intervalId);
    };

  }, [userAddress, depositedAmount, depositTimestamp]);
  // ↑ Re-run this effect when address or deposit changes


  // ----------------------------------------------------------
  // 🔄  REFETCH FUNCTION
  // Manually triggers fresh reads from both contract functions.
  // Called when user wants to see the latest data immediately
  // (e.g. after making a deposit or withdrawal).
  // ----------------------------------------------------------
  const refetch = useCallback(() => {
    refetchBalance();
    refetchYield();
  }, [refetchBalance, refetchYield]);


  // ----------------------------------------------------------
  // 🚫  GUARD: No address
  // If no wallet is connected, return all zeros immediately.
  // No blockchain reads will be made.
  // ----------------------------------------------------------
  if (!userAddress) {
    return {
      depositedAmount:  0n,
      pendingYield:     0n,
      totalValue:       0n,
      apy:              APY,
      isLoading:        false,
      refetch:          () => {},
      depositTimestamp: 0,
      hasDeposit:       false,
    };
  }


  // ----------------------------------------------------------
  // 📤  RETURN
  // ----------------------------------------------------------
  const totalValue = depositedAmount + pendingYield;

  return {
    depositedAmount,
    pendingYield,
    totalValue,
    apy:     APY,
    isLoading: isLoadingBalance || isLoadingYield,
    refetch,
    depositTimestamp,
    hasDeposit: depositedAmount > 0n,
  };
}

export default useYield;