"use client";

import { useState, useCallback }          from "react";
import {
  Send,
  Copy,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2,
  ArrowRight,
}                                          from "lucide-react";
import toast                               from "react-hot-toast";
import useWallet                           from "../hooks/useWallet";
import useRemitFlow                        from "../hooks/useRemitFlow";
import { formatUSDC, parseUSDC, isValidAddress } from "../lib/utils";

// ============================================================
// 📐  TYPES
// ============================================================
type Step = "idle" | "approving" | "sending" | "success" | "error";

// ============================================================
// 🎨  COMPONENT
// ============================================================
export default function SendForm() {

  const { address, isConnected, usdcBalance, chainId } = useWallet();
  const { sendRemittance, feePercent, isLoading }       = useRemitFlow();

  // ----------------------------------------------------------
  // 📊  STATE
  // ----------------------------------------------------------
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amountInput,      setAmountInput]      = useState("");
  const [step,             setStep]             = useState<Step>("idle");
  const [txHash,           setTxHash]           = useState("");


  // ----------------------------------------------------------
  // 🧮  DERIVED VALUES
  // Calculated from inputs — no extra state needed
  // ----------------------------------------------------------

  /** Raw bigint of what the user typed */
  const parsedAmount = parseUSDC(amountInput);

  /** Fee in raw units (e.g. 0.3% of parsedAmount) */
  const fee = feePercent !== undefined && parsedAmount > 0n
    ? (parsedAmount * feePercent) / 10_000n
    : 0n;

  /** What the recipient actually receives */
  const recipientGets = parsedAmount > 0n ? parsedAmount - fee : 0n;

  /** Validation flags */
  const isAddressInvalid =
    recipientAddress.length > 0 && !isValidAddress(recipientAddress);

  const isAmountTooHigh =
    parsedAmount > 0n && parsedAmount > usdcBalance;

  const isAmountZero =
    amountInput.length > 0 && parsedAmount === 0n;

  const canSubmit =
    isConnected &&
    isValidAddress(recipientAddress) &&
    parsedAmount > 0n &&
    !isAmountTooHigh &&
    step === "idle";


  // ----------------------------------------------------------
  // 📋  PASTE ADDRESS
  // ----------------------------------------------------------
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRecipientAddress(text.trim());
    } catch {
      toast.error("Could not read clipboard. Paste manually.");
    }
  }, []);


  // ----------------------------------------------------------
  // 💯  MAX BUTTON
  // Fills the amount input with the user's full USDC balance
  // ----------------------------------------------------------
  const handleMax = useCallback(() => {
    if (usdcBalance === 0n) return;
    // Convert raw bigint to display string with 6 decimal precision
    const whole      = usdcBalance / 1_000_000n;
    const fractional = usdcBalance % 1_000_000n;
    const fracStr    = fractional.toString().padStart(6, "0").replace(/0+$/, "");
    setAmountInput(fracStr ? `${whole}.${fracStr}` : `${whole}`);
  }, [usdcBalance]);


  // ----------------------------------------------------------
  // 🚀  SUBMIT HANDLER
  // ----------------------------------------------------------
  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    // Double-check validation
    if (!isValidAddress(recipientAddress)) {
      toast.error("Invalid recipient address.");
      return;
    }
    if (parsedAmount <= 0n) {
      toast.error("Enter an amount greater than zero.");
      return;
    }
    if (parsedAmount > usdcBalance) {
      toast.error("Amount exceeds your USDC balance.");
      return;
    }

    try {
      // ── Step 1: Approving ──────────────────────────────
      setStep("approving");

      // ── Step 2: Sending ───────────────────────────────
      // (sendRemittance internally handles approve → send)
      setStep("sending");

      const hash = await sendRemittance(recipientAddress, parsedAmount);

      if (hash) {
        setTxHash(hash);
        setStep("success");
      } else {
        // sendRemittance returned undefined — user cancelled or error
        // Toast was already shown inside the hook
        setStep("idle");
      }

    } catch (err: unknown) {
      setStep("error");
      const msg = err instanceof Error ? err.message.slice(0, 80) : "Unknown error";
      toast.error(`Transaction failed: ${msg}`);
    }
  }, [canSubmit, recipientAddress, parsedAmount, usdcBalance, sendRemittance]);


  // ----------------------------------------------------------
  // 🔄  RESET FORM
  // ----------------------------------------------------------
  const handleReset = () => {
    setRecipientAddress("");
    setAmountInput("");
    setStep("idle");
    setTxHash("");
  };


  // ============================================================
  // 🎨  RENDER: SUCCESS STATE
  // ============================================================
  if (step === "success") {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">

        {/* Success icon */}
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-16 h-16 rounded-full bg-green-900/50 border border-green-700 flex items-center justify-center mb-4">
            <CheckCircle size={32} className="text-green-400" />
          </div>

          <h2 className="text-xl font-bold text-white mb-1">
            USDC Sent!
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            Your transfer was submitted to the Polygon network.
          </p>
        </div>

        {/* Transaction details */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4 space-y-3">

          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Amount Sent</span>
            <span className="text-white font-medium">
              {formatUSDC(parsedAmount, 2)} USDC
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Recipient Got</span>
            <span className="text-green-400 font-medium">
              {formatUSDC(recipientGets, 2)} USDC
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Fee Paid</span>
            <span className="text-gray-400">
              {formatUSDC(fee, 6)} USDC
            </span>
          </div>

          <div className="border-t border-gray-700 pt-3">
            <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
            <p className="font-mono text-xs text-gray-300 break-all">
              {txHash}
            </p>
          </div>
        </div>

        {/* Polygonscan link */}
        
          <a href={`https://${chainId === 137 ? "" : "amoy."}polygonscan.com/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className={[
            "w-full flex items-center justify-center gap-2 mb-3",
            "px-4 py-2.5 rounded-xl",
            "bg-gray-800 hover:bg-gray-700 border border-gray-700",
            "text-sm text-violet-400 hover:text-violet-300",
            "transition-colors duration-150",
          ].join(" ")}
        >
          <ExternalLink size={14} />
          View on Polygonscan
        </a>

        {/* Send another button */}
        <button
          onClick={handleReset}
          className={[
            "w-full flex items-center justify-center gap-2",
            "px-4 py-2.5 rounded-xl",
            "bg-gradient-to-r from-violet-600 to-purple-600",
            "hover:from-violet-700 hover:to-purple-700",
            "text-sm font-semibold text-white",
            "transition-all duration-150",
          ].join(" ")}
        >
          Send Another
        </button>

      </div>
    );
  }


  // ============================================================
  // 🎨  RENDER: MAIN FORM
  // ============================================================
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Send size={18} className="text-violet-400" />
          <h2 className="text-lg font-bold text-white">Send USDC</h2>
        </div>

        {/* User's balance — top right */}
        <div className="text-right">
          <p className="text-xs text-gray-500">Your Balance</p>
          <p className="text-sm font-semibold text-white">
            {formatUSDC(usdcBalance, 2)} USDC
          </p>
        </div>
      </div>


      {/* ── FIELD 1: RECIPIENT ADDRESS ─────────────────────────── */}
      <div className="mb-5">

        <label className="block text-sm font-medium text-gray-300 mb-2">
          Recipient Address
        </label>

        <div className="relative flex gap-2">

          {/* Address text input */}
          <input
            type="text"
            value={recipientAddress}
            onChange={e => setRecipientAddress(e.target.value.trim())}
            placeholder="0x..."
            disabled={step !== "idle"}
            className={[
              "flex-1 px-4 py-3 rounded-xl",
              "bg-gray-800 border text-white text-sm",
              "placeholder-gray-600 font-mono",
              "focus:outline-none focus:ring-2 focus:ring-violet-500",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors duration-150",
              // Red border if invalid
              isAddressInvalid
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-700 hover:border-gray-600",
            ].join(" ")}
          />

          {/* Paste button */}
          <button
            type="button"
            onClick={handlePaste}
            disabled={step !== "idle"}
            title="Paste from clipboard"
            className={[
              "flex items-center gap-1.5 px-3 py-3 rounded-xl",
              "bg-gray-800 border border-gray-700",
              "hover:bg-gray-700 hover:border-gray-600",
              "text-xs text-gray-400 hover:text-gray-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors duration-150 flex-shrink-0",
            ].join(" ")}
          >
            <Copy size={13} />
            Paste
          </button>

        </div>

        {/* Validation error */}
        {isAddressInvalid && (
          <div className="flex items-center gap-1.5 mt-2">
            <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400">
              Invalid address. Must start with 0x and be 42 characters.
            </p>
          </div>
        )}

        {/* Valid address confirmation */}
        {isValidAddress(recipientAddress) && (
          <div className="flex items-center gap-1.5 mt-2">
            <CheckCircle size={12} className="text-green-400 flex-shrink-0" />
            <p className="text-xs text-green-400">Valid address</p>
          </div>
        )}
      </div>


      {/* ── FIELD 2: AMOUNT ────────────────────────────────────── */}
      <div className="mb-5">

        <label className="block text-sm font-medium text-gray-300 mb-2">
          Amount (USDC)
        </label>

        <div className="flex gap-2">

          {/* Amount number input */}
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
              $
            </span>
            <input
              type="number"
              value={amountInput}
              onChange={e => setAmountInput(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              disabled={step !== "idle"}
              className={[
                "w-full pl-8 pr-4 py-3 rounded-xl",
                "bg-gray-800 border text-white text-sm",
                "placeholder-gray-600",
                "focus:outline-none focus:ring-2 focus:ring-violet-500",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                // Hide browser number input arrows
                "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                "transition-colors duration-150",
                isAmountTooHigh || isAmountZero
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-700 hover:border-gray-600",
              ].join(" ")}
            />
          </div>

          {/* MAX button */}
          <button
            type="button"
            onClick={handleMax}
            disabled={step !== "idle" || usdcBalance === 0n}
            className={[
              "px-4 py-3 rounded-xl",
              "bg-violet-900/50 border border-violet-700",
              "hover:bg-violet-900 hover:border-violet-600",
              "text-xs font-semibold text-violet-300 hover:text-violet-200",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "transition-colors duration-150 flex-shrink-0",
            ].join(" ")}
          >
            MAX
          </button>

        </div>

        {/* Amount errors */}
        {isAmountTooHigh && (
          <div className="flex items-center gap-1.5 mt-2">
            <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400">
              Amount exceeds your balance of {formatUSDC(usdcBalance, 2)} USDC.
            </p>
          </div>
        )}

        {isAmountZero && (
          <div className="flex items-center gap-1.5 mt-2">
            <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400">
              Amount must be greater than zero.
            </p>
          </div>
        )}

        {/* Fee breakdown — shown when amount is valid */}
        {parsedAmount > 0n && !isAmountTooHigh && !isAmountZero && (
          <div className="mt-3 bg-gray-800 rounded-xl p-3 space-y-1.5">

            <div className="flex justify-between text-xs">
              <span className="text-gray-500">
                Fee ({feePercent ? Number(feePercent) / 100 : 0.3}%)
              </span>
              <span className="text-gray-400">
                {formatUSDC(fee, 6)} USDC
              </span>
            </div>

            <div className="flex justify-between text-xs border-t border-gray-700 pt-1.5">
              <span className="text-gray-400 font-medium">Recipient gets</span>
              <span className="text-green-400 font-semibold">
                {formatUSDC(recipientGets, 2)} USDC
              </span>
            </div>

          </div>
        )}
      </div>


      {/* ── STEP INDICATOR (shown when not idle) ───────────────── */}
      {(step === "approving" || step === "sending") && (
        <div className="mb-5">

          <div className="flex items-center justify-center gap-3">

            {/* Step 1: Approve */}
            <div className="flex items-center gap-2">
              <div className={[
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2",
                step === "approving"
                  ? "bg-violet-600 border-violet-500 text-white"
                  : step === "sending"
                  ? "bg-green-900 border-green-600 text-green-400"
                  : "bg-gray-800 border-gray-600 text-gray-500",
              ].join(" ")}>
                {step === "sending" ? (
                  <CheckCircle size={14} />
                ) : step === "approving" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  "1"
                )}
              </div>
              <span className={`text-xs font-medium ${
                step === "approving" ? "text-violet-300" :
                step === "sending"   ? "text-green-400"  :
                "text-gray-500"
              }`}>
                Approve
              </span>
            </div>

            {/* Connector line */}
            <ArrowRight
              size={14}
              className={step === "sending" ? "text-violet-400" : "text-gray-600"}
            />

            {/* Step 2: Send */}
            <div className="flex items-center gap-2">
              <div className={[
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2",
                step === "sending"
                  ? "bg-violet-600 border-violet-500 text-white"
                  : "bg-gray-800 border-gray-600 text-gray-500",
              ].join(" ")}>
                {step === "sending" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  "2"
                )}
              </div>
              <span className={`text-xs font-medium ${
                step === "sending" ? "text-violet-300" : "text-gray-500"
              }`}>
                Send
              </span>
            </div>

          </div>

          {/* Step description */}
          <p className="text-center text-xs text-gray-500 mt-2">
            {step === "approving" && "Approve USDC spending in your wallet..."}
            {step === "sending"   && "Confirm the send transaction in your wallet..."}
          </p>

        </div>
      )}


      {/* ── SUBMIT BUTTON ──────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || isLoading}
        className={[
          "w-full flex items-center justify-center gap-2",
          "px-4 py-3.5 rounded-xl",
          "text-sm font-semibold text-white",
          "bg-gradient-to-r from-violet-600 to-purple-600",
          "hover:from-violet-700 hover:to-purple-700",
          "active:scale-[0.98]",
          "transition-all duration-150",
          "shadow-lg shadow-purple-900/30",
          !canSubmit || isLoading
            ? "opacity-50 cursor-not-allowed"
            : "cursor-pointer",
        ].join(" ")}
      >
        {step === "approving" ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Approving USDC...
          </>
        ) : step === "sending" ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send size={16} />
            Send USDC
          </>
        )}
      </button>

      {/* Not connected warning */}
      {!isConnected && (
        <p className="text-center text-xs text-gray-500 mt-3">
          Connect your wallet to send USDC.
        </p>
      )}

    </div>
  );
}