"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Wallet,
  ChevronDown,
  LogOut,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  RefreshCw,
}                        from "lucide-react";
import useWallet         from "../hooks/useWallet";
import { formatUSDC, shortenAddress } from "../lib/utils";

export default function WalletConnect() {

  const {
    address,
    isConnected,
    isConnecting,
    chainId,
    isCorrectNetwork,
    connect,
    disconnect,
    switchToPolygon,
    switchToAmoy,
    usdcBalance,
    isLoadingBalance,
    refetchBalance,
    connectionError,
  } = useWallet();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hasCopied,      setHasCopied]      = useState(false);
  const dropdownRef                          = useRef<HTMLDivElement>(null);

  // ── Outside click handler ─────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  // ── Copy address ──────────────────────────────────────────
  const copyAddress = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      console.warn("Could not copy to clipboard");
    }
  }, [address]);

  // ── Network info ──────────────────────────────────────────
  const getNetworkInfo = () => {
    switch (chainId) {
      case 137:
        return {
          label:     "Polygon",
          bgColor:   "bg-green-900",
          textColor: "text-green-300",
          dotColor:  "bg-green-400",
        };
      case 80002:
        return {
          label:     "Amoy Testnet",
          bgColor:   "bg-blue-900",
          textColor: "text-blue-300",
          dotColor:  "bg-blue-400",
        };
      default:
        return {
          label:     "Wrong Network",
          bgColor:   "bg-red-900",
          textColor: "text-red-300",
          dotColor:  "bg-red-400",
        };
    }
  };

  const networkInfo = getNetworkInfo();

  // ============================================================
  // 🎨  RENDER: NOT CONNECTED
  // ============================================================
  if (!isConnected) {
    return (
      <div className="flex flex-col items-end gap-1">

        <button
          onClick={connect}
          disabled={isConnecting}
          className={[
            "flex items-center gap-2 px-5 py-2.5 rounded-xl",
            "text-sm font-semibold text-white",
            "bg-gradient-to-r from-violet-600 to-purple-600",
            "hover:from-violet-700 hover:to-purple-700",
            "active:scale-95",
            "transition-all duration-150",
            "shadow-lg shadow-purple-900/30",
            isConnecting ? "opacity-70 cursor-not-allowed" : "cursor-pointer",
          ].join(" ")}
        >
          {isConnecting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <Wallet size={16} />
              <span>Connect Wallet</span>
            </>
          )}
        </button>

        {connectionError && (
          <p className="text-xs text-red-400 max-w-[200px] text-right">
            {connectionError.includes("rejected")
              ? "Connection cancelled."
              : "Connection failed. Try again."}
          </p>
        )}

      </div>
    );
  }

  // ============================================================
  // 🎨  RENDER: CONNECTED
  // ============================================================
  return (
    <div className="relative" ref={dropdownRef}>

      {/* ── PILL BUTTON ────────────────────────────────────────── */}
      <button
        onClick={() => setIsDropdownOpen(prev => !prev)}
        className={[
          "flex items-center gap-2 px-4 py-2 rounded-xl",
          "bg-gray-800 border border-gray-700",
          "hover:bg-gray-750 hover:border-gray-600",
          "text-sm text-white",
          "transition-all duration-150",
          isDropdownOpen ? "border-violet-500" : "",
        ].join(" ")}
      >
        {/* Network dot */}
        <span
          className={[
            "w-2 h-2 rounded-full flex-shrink-0",
            isCorrectNetwork ? "bg-green-400" : "bg-red-400",
            !isCorrectNetwork ? "animate-pulse" : "",
          ].join(" ")}
        />

        {/* Address */}
        <span className="font-mono text-gray-200">
          {shortenAddress(address, 4)}
        </span>

        {/* Divider */}
        <span className="text-gray-600">|</span>

        {/* Balance */}
        {isLoadingBalance ? (
          <Loader2 size={12} className="animate-spin text-gray-400" />
        ) : (
          <span className="text-gray-300">
            ${formatUSDC(usdcBalance, 2)}
          </span>
        )}

        {/* Chevron */}
        <ChevronDown
          size={14}
          className={[
            "text-gray-400 transition-transform duration-200 flex-shrink-0",
            isDropdownOpen ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>


      {/* ── DROPDOWN ───────────────────────────────────────────── */}
      {isDropdownOpen && (
        <div
          className={[
            "absolute right-0 top-full mt-2 z-50",
            "w-72",
            "bg-gray-900 border border-gray-700 rounded-2xl",
            "shadow-2xl shadow-black/50",
            "animate-fade-in",
          ].join(" ")}
        >

          {/* SECTION 1 — Address ─────────────────────────────── */}
          <div className="p-4 border-b border-gray-800">

            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Connected Wallet
            </p>

            {/* Copyable address row */}
            <button
              onClick={copyAddress}
              className={[
                "w-full flex items-center justify-between gap-2",
                "px-3 py-2 rounded-lg",
                "bg-gray-800 hover:bg-gray-700",
                "border border-gray-700 hover:border-gray-600",
                "transition-colors duration-150 group",
              ].join(" ")}
              title="Click to copy full address"
            >
              <span className="font-mono text-sm text-gray-200">
                {shortenAddress(address, 6)}
              </span>
              {hasCopied ? (
                <Check size={14} className="text-green-400 flex-shrink-0" />
              ) : (
                <Copy
                  size={14}
                  className="text-gray-500 group-hover:text-gray-300 flex-shrink-0 transition-colors"
                />
              )}
            </button>

            {hasCopied && (
              <p className="text-xs text-green-400 mt-1 text-center">
                ✓ Address copied!
              </p>
            )}

            {/* Polygonscan link */}
            <a
              href={`https://${chainId === 137 ? "" : "amoy."}polygonscan.com/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 mt-2 text-xs text-gray-500 hover:text-violet-400 transition-colors"
              onClick={() => setIsDropdownOpen(false)}
            >
              <ExternalLink size={11} />
              View on Polygonscan
            </a>

          </div>


          {/* SECTION 2 — Balance ─────────────────────────────── */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  USDC Balance
                </p>
                <p className="text-lg font-semibold text-white">
                  {isLoadingBalance ? (
                    <span className="text-gray-500 text-sm">Loading...</span>
                  ) : (
                    `$${formatUSDC(usdcBalance, 2)} USDC`
                  )}
                </p>
              </div>

              <button
                onClick={refetchBalance}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                title="Refresh balance"
              >
                <RefreshCw
                  size={13}
                  className={[
                    "text-gray-400",
                    isLoadingBalance ? "animate-spin" : "",
                  ].join(" ")}
                />
              </button>
            </div>
          </div>


          {/* SECTION 3 — Network ─────────────────────────────── */}
          <div className="p-4 border-b border-gray-800">

            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Network
            </p>

            <div className={[
              "flex items-center gap-2 px-3 py-2 rounded-lg border",
              networkInfo.bgColor,
              isCorrectNetwork ? "border-green-800" : "border-red-800",
            ].join(" ")}>
              <span className={[
                "w-2 h-2 rounded-full flex-shrink-0",
                networkInfo.dotColor,
                !isCorrectNetwork ? "animate-pulse" : "",
              ].join(" ")} />
              <span className={`text-sm font-medium ${networkInfo.textColor}`}>
                {networkInfo.label}
              </span>
              {!isCorrectNetwork && (
                <AlertTriangle size={13} className="text-red-400 ml-auto" />
              )}
            </div>

            {/* Wrong network — switch buttons */}
            {!isCorrectNetwork && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-500">
                  RemitFlow requires Polygon network.
                </p>

                <button
                  onClick={() => {
                    switchToPolygon();
                    setIsDropdownOpen(false);
                  }}
                  className={[
                    "w-full flex items-center justify-center gap-2",
                    "px-3 py-2 rounded-lg text-sm font-medium",
                    "bg-orange-900 hover:bg-orange-800",
                    "border border-orange-700 hover:border-orange-600",
                    "text-orange-300 transition-colors duration-150",
                  ].join(" ")}
                >
                  Switch to Polygon Mainnet
                </button>

                <button
                  onClick={() => {
                    switchToAmoy();
                    setIsDropdownOpen(false);
                  }}
                  className={[
                    "w-full flex items-center justify-center gap-2",
                    "px-3 py-2 rounded-lg text-sm font-medium",
                    "bg-blue-900 hover:bg-blue-800",
                    "border border-blue-700 hover:border-blue-600",
                    "text-blue-300 transition-colors duration-150",
                  ].join(" ")}
                >
                  Switch to Amoy Testnet
                </button>
              </div>
            )}
          </div>


          {/* SECTION 4 — Disconnect ──────────────────────────── */}
          <div className="p-2">
            <button
              onClick={() => {
                disconnect();
                setIsDropdownOpen(false);
              }}
              className={[
                "w-full flex items-center gap-3",
                "px-3 py-2.5 rounded-xl",
                "text-sm font-medium text-red-400",
                "hover:bg-red-900/30 hover:text-red-300",
                "transition-colors duration-150 group",
              ].join(" ")}
            >
              <LogOut
                size={15}
                className="group-hover:-translate-x-0.5 transition-transform duration-150"
              />
              Disconnect Wallet
            </button>
          </div>

        </div>
      )}
    </div>
  );
}