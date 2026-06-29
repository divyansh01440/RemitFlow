"use client";

// ============================================================
// 📄  hooks/useWallet.ts — Wallet Connection & Balance Hook
//
// This hook is the single source of truth for wallet state
// across the entire RemitFlow app. Import it in any component
// that needs to know about the connected wallet.
//
// What it gives you:
//   - The connected wallet address
//   - Whether the user is on the right network (Polygon)
//   - The user's USDC balance (live from blockchain)
//   - Functions to connect, disconnect, and switch networks
//
// Usage:
//   const { address, isConnected, usdcBalance, connect } = useWallet()
// ============================================================

import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useReadContract,
  useChainId,
}                          from "wagmi";
import { injected }        from "wagmi/connectors";
import { USDC_ABI, USDC_ADDRESSES, SUPPORTED_CHAINS } from "../lib/contract";


// ============================================================
// 📐  TYPESCRIPT INTERFACE
// Defines exactly what this hook returns.
// Any component using useWallet() gets full type safety.
// ============================================================

export interface UseWalletReturn {
  /** Connected wallet address (0x...) or undefined if not connected */
  address: string | undefined;

  /** True if a wallet is connected */
  isConnected: boolean;

  /** Current blockchain network ID (137 = Polygon, 80002 = Amoy, etc.) */
  chainId: number | undefined;

  /** True ONLY if user is on Polygon mainnet (137) or Amoy testnet (80002) */
  isCorrectNetwork: boolean;

  /** Connects MetaMask (or any injected browser wallet) */
  connect: () => void;

  /** Disconnects the current wallet */
  disconnect: () => void;

  /** Switches MetaMask to Polygon Mainnet (chainId 137) */
  switchToPolygon: () => void;

  /** Switches MetaMask to Polygon Amoy Testnet (chainId 80002) */
  switchToAmoy: () => void;

  /** User's USDC token balance in raw units (6 decimals). 0n if not connected. */
  usdcBalance: bigint;

  /** True while the USDC balance is being fetched from the blockchain */
  isLoadingBalance: boolean;

  /** Manually triggers a fresh USDC balance fetch */
  refetchBalance: () => void;

  /** True if a wallet connection is in progress */
  isConnecting: boolean;

  /** Error message if connection failed, undefined otherwise */
  connectionError: string | undefined;
}


// ============================================================
// 🎣  THE HOOK
// ============================================================

export function useWallet(): UseWalletReturn {

  // ----------------------------------------------------------
  // 👛  ACCOUNT STATE
  // useAccount gives us the connected wallet's address and
  // connection status. Updates automatically when user connects
  // or disconnects in MetaMask.
  // ----------------------------------------------------------
  const {
    address,
    isConnected,
    isConnecting,
    status,
  } = useAccount();


  // ----------------------------------------------------------
  // 🌐  CURRENT CHAIN
  // useChainId returns the currently selected network in the wallet.
  // This updates when the user switches networks in MetaMask.
  // ----------------------------------------------------------
  const chainId = useChainId();


  // ----------------------------------------------------------
  // ✅  NETWORK VALIDATION
  // Check if the user is on a network that RemitFlow supports.
  // If they're on Ethereum mainnet or BSC etc., we need to ask
  // them to switch to Polygon.
  //
  // Supported chains:
  //   137   → Polygon Mainnet  (production)
  //   80002 → Polygon Amoy     (testnet / development)
  // ----------------------------------------------------------
  const isCorrectNetwork = chainId !== undefined &&
    (SUPPORTED_CHAINS as readonly number[]).includes(chainId);


  // ----------------------------------------------------------
  // 🔌  CONNECT WALLET
  // useConnect gives us a function to trigger wallet connection.
  // We use the injected() connector which works with MetaMask,
  // Coinbase Wallet, Brave Wallet, and any other browser wallet.
  // ----------------------------------------------------------
  const {
    connect: wagmiConnect,
    isPending: isConnectPending,
    error: connectError,
  } = useConnect();

  /** Connects the user's MetaMask (or any injected browser wallet) */
  const connect = () => {
    wagmiConnect({
      connector: injected({
        shimDisconnect: true,
        // shimDisconnect fixes a MetaMask bug where wallet appears
        // connected on page reload even after the user disconnected
      }),
    });
  };


  // ----------------------------------------------------------
  // 🔌  DISCONNECT WALLET
  // Simple — just tells wagmi to clear the connection state.
  // MetaMask will still show the site as "connected" but
  // our app will treat it as disconnected.
  // ----------------------------------------------------------
  const { disconnect: wagmiDisconnect } = useDisconnect();

  /** Disconnects the wallet from the app */
  const disconnect = () => {
    wagmiDisconnect();
  };


  // ----------------------------------------------------------
  // 🔄  SWITCH NETWORK
  // useSwitchChain lets us programmatically ask MetaMask to
  // switch to a different blockchain network.
  //
  // When called, MetaMask will show a popup asking the user
  // to approve the network switch.
  //
  // If the user doesn't have Polygon added to MetaMask yet,
  // MetaMask will automatically offer to add it.
  // ----------------------------------------------------------
  const { switchChain } = useSwitchChain();

  /** Asks MetaMask to switch to Polygon Mainnet (for production) */
  const switchToPolygon = () => {
    switchChain({ chainId: 137 });
  };

  /** Asks MetaMask to switch to Polygon Amoy Testnet (for development) */
  const switchToAmoy = () => {
    switchChain({ chainId: 80002 });
  };


  // ----------------------------------------------------------
  // 💰  USDC BALANCE
  // Reads the user's USDC token balance directly from the
  // USDC smart contract on the blockchain.
  //
  // useReadContract is like calling a view function on a contract.
  // It automatically:
  //   - Fetches on mount
  //   - Refetches when address or chainId changes
  //   - Caches the result
  //   - Provides loading/error states
  //
  // The USDC contract address varies by network:
  //   Polygon Mainnet → real USDC (0x2791...)
  //   Polygon Amoy    → MockUSDC  (from your .env)
  // ----------------------------------------------------------

  // Get the correct USDC address for the current network
  // Returns undefined if chain not supported (balance will be 0n)
  const usdcAddress = chainId && USDC_ADDRESSES[chainId]
    ? USDC_ADDRESSES[chainId] as `0x${string}`
    : undefined;

  const {
    data:    rawBalance,
    isLoading: isLoadingBalance,
    refetch: refetchBalance,
  } = useReadContract({
    address: usdcAddress,           // USDC contract address for this network
    abi:     USDC_ABI,              // USDC ABI (balanceOf function)
    functionName: "balanceOf",      // The function to call
    args:    address ? [address as `0x${string}`] : undefined,
    // ↑ Pass the user's wallet address as argument to balanceOf()
    // Set to undefined if no address — this disables the query

    query: {
      // Only fetch if we have both a wallet address AND a USDC address
      // If either is missing, balance is 0n (not an error)
      enabled: !!address && !!usdcAddress,

      // How often to re-fetch balance in the background
      // 15 seconds is a good balance between freshness and API usage
      refetchInterval: 15_000,

      // Refetch when user returns to the browser tab
      // (balance may have changed while they were away)
      refetchOnWindowFocus: true,
    },
  });

  // Safely convert the raw balance to bigint
  // rawBalance is unknown type from wagmi — cast it carefully
  const usdcBalance: bigint = rawBalance
    ? BigInt(rawBalance.toString())
    : 0n;


  // ----------------------------------------------------------
  // 📤  RETURN
  // Return all state and functions as a typed object.
  // Destructure what you need in your components:
  //
  // const { address, usdcBalance, connect } = useWallet()
  // ----------------------------------------------------------
  return {
    // Wallet identity
    address:      address,
    isConnected:  isConnected && !!address,
    // ↑ Both wagmi's isConnected AND address must be truthy
    //   (wagmi can briefly show isConnected=true with no address)

    // Network
    chainId:          chainId,
    isCorrectNetwork: isCorrectNetwork,

    // Actions
    connect:         connect,
    disconnect:      disconnect,
    switchToPolygon: switchToPolygon,
    switchToAmoy:    switchToAmoy,

    // USDC balance
    usdcBalance:      usdcBalance,
    isLoadingBalance: isLoadingBalance,
    refetchBalance:   refetchBalance as () => void,

    // Connection status
    isConnecting:    isConnecting || isConnectPending,
    connectionError: connectError?.message,
  };
}

// Default export for convenience
export default useWallet;