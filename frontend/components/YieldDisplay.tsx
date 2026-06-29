"use client";

import { useState }      from "react";
import {
  TrendingUp,
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  X,
  Loader2,
  AlertCircle,
}                        from "lucide-react";
import useYield          from "../hooks/useYield";
import useWallet         from "../hooks/useWallet";
import useRemitFlow      from "../hooks/useRemitFlow";
import { formatUSDC, parseUSDC } from "../lib/utils";

// ============================================================
// 🎨  COMPONENT
// ============================================================
export default function YieldDisplay() {

  const { address, usdcBalance }                    = useWallet();
  const { depositedAmount, pendingYield, apy,
          isLoading, refetch }                       = useYield(address);
  const { depositYield, withdrawYield, isLoading:
          isTxLoading }                              = useRemitFlow();

  // ----------------------------------------------------------
  // 📊  MODAL STATE
  // ----------------------------------------------------------
  type ModalType = "none" | "deposit" | "withdraw";
  const [activeModal,   setActiveModal]   = useState<ModalType>("none");
  const [amountInput,   setAmountInput]   = useState("");
  const [inputError,    setInputError]    = useState("");

  // ----------------------------------------------------------
  // 🧮  DERIVED
  // ----------------------------------------------------------
  const parsedAmount = parseUSDC(amountInput);

  const validateInput = (type: "deposit" | "withdraw"): boolean => {
    if (!amountInput || parsedAmount === 0n) {
      setInputError("Enter an amount greater than zero.");
      return false;
    }
    if (type === "deposit" && parsedAmount > usdcBalance) {
      setInputError(`Exceeds your balance of ${formatUSDC(usdcBalance, 2)} USDC.`);
      return false;
    }
    if (type === "withdraw" && parsedAmount > depositedAmount) {
      setInputError(`Exceeds deposited amount of ${formatUSDC(depositedAmount, 2)} USDC.`);
      return false;
    }
    setInputError("");
    return true;
  };

  // ----------------------------------------------------------
  // 🔧  HANDLERS
  // ----------------------------------------------------------
  const openModal = (type: ModalType) => {
    setAmountInput("");
    setInputError("");
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal("none");
    setAmountInput("");
    setInputError("");
  };

  const handleDeposit = async () => {
    if (!validateInput("deposit")) return;
    const hash = await depositYield(parsedAmount);
    if (hash) {
      closeModal();
      refetch();
    }
  };

  const handleWithdraw = async () => {
    if (!validateInput("withdraw")) return;
    const hash = await withdrawYield(parsedAmount);
    if (hash) {
      closeModal();
      refetch();
    }
  };

  const handleClaimAndReinvest = async () => {
    if (pendingYield === 0n) return;
    // Withdraw full principal + yield, then re-deposit
    const hash = await withdrawYield(depositedAmount);
    if (hash) {
      refetch();
    }
  };

  const handleMaxDeposit  = () => {
    if (usdcBalance === 0n) return;
    const whole = usdcBalance / 1_000_000n;
    const frac  = (usdcBalance % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
    setAmountInput(frac ? `${whole}.${frac}` : `${whole}`);
    setInputError("");
  };

  const handleMaxWithdraw = () => {
    if (depositedAmount === 0n) return;
    const whole = depositedAmount / 1_000_000n;
    const frac  = (depositedAmount % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
    setAmountInput(frac ? `${whole}.${frac}` : `${whole}`);
    setInputError("");
  };

  // ============================================================
  // 🎨  RENDER
  // ============================================================
  return (
    <>
      {/* ── CARDS ROW ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* CARD 1 — Your Deposit */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">

          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-violet-900/50 border border-violet-700 flex items-center justify-center">
              <DollarSign size={15} className="text-violet-400" />
            </div>
            <p className="text-sm font-medium text-gray-400">Total Deposited</p>
          </div>

          {/* Big number */}
          {isLoading ? (
            <div className="flex items-center gap-2 mb-1">
              <Loader2 size={20} className="animate-spin text-gray-500" />
              <span className="text-gray-500 text-sm">Loading...</span>
            </div>
          ) : (
            <p className="text-3xl font-bold text-white mb-1">
              {formatUSDC(depositedAmount, 2)}
              <span className="text-lg font-normal text-gray-500 ml-1">USDC</span>
            </p>
          )}

          {/* APY subtext */}
          <p className="text-sm text-green-400 font-medium mb-6">
            ● Earning {apy}% APY
          </p>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => openModal("deposit")}
              className={[
                "flex-1 flex items-center justify-center gap-2",
                "px-4 py-2.5 rounded-xl text-sm font-semibold text-white",
                "bg-gradient-to-r from-violet-600 to-purple-600",
                "hover:from-violet-700 hover:to-purple-700",
                "transition-all duration-150 active:scale-95",
              ].join(" ")}
            >
              <ArrowDownCircle size={15} />
              Deposit
            </button>

            <button
              onClick={() => openModal("withdraw")}
              disabled={depositedAmount === 0n}
              className={[
                "flex-1 flex items-center justify-center gap-2",
                "px-4 py-2.5 rounded-xl text-sm font-semibold",
                "border border-gray-600 text-gray-300",
                "hover:bg-gray-800 hover:border-gray-500",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                "transition-all duration-150",
              ].join(" ")}
            >
              <ArrowUpCircle size={15} />
              Withdraw
            </button>
          </div>

        </div>


        {/* CARD 2 — Yield Earned */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 relative overflow-hidden">

          {/* Background glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-green-900/50 border border-green-700 flex items-center justify-center">
              <TrendingUp size={15} className="text-green-400" />
            </div>
            <p className="text-sm font-medium text-gray-400">Pending Yield</p>
          </div>

          {/* Big number — 6 decimals for small amounts */}
          {isLoading ? (
            <div className="flex items-center gap-2 mb-1">
              <Loader2 size={20} className="animate-spin text-gray-500" />
              <span className="text-gray-500 text-sm">Loading...</span>
            </div>
          ) : (
            <p className="text-3xl font-bold text-violet-300 mb-1">
              {formatUSDC(pendingYield, pendingYield < 1_000_000n ? 6 : 2)}
              <span className="text-lg font-normal text-gray-500 ml-1">USDC</span>
            </p>
          )}

          {/* Subtext */}
          <p className="text-sm text-gray-500 mb-6">
            Compounding continuously
          </p>

          {/* Claim and Reinvest button */}
          <button
            onClick={handleClaimAndReinvest}
            disabled={depositedAmount === 0n || isTxLoading}
            className={[
              "w-full flex items-center justify-center gap-2",
              "px-4 py-2.5 rounded-xl text-sm font-semibold text-white",
              "bg-gradient-to-r from-green-600 to-emerald-600",
              "hover:from-green-700 hover:to-emerald-700",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "transition-all duration-150 active:scale-95",
            ].join(" ")}
          >
            {isTxLoading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <TrendingUp size={15} />
            )}
            Claim & Reinvest
          </button>

        </div>
      </div>


      {/* ── INFO BAR ─────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-3 px-4 bg-gray-900/50 border border-gray-800 rounded-xl">
        {[
          `${apy}% APY`,
          "Paid in USDC",
          "No lock-up",
          "Withdraw anytime",
        ].map((item, i) => (
          <span key={i} className="flex items-center gap-2 text-xs text-gray-500">
            {i > 0 && <span className="hidden sm:inline text-gray-700">·</span>}
            {item}
          </span>
        ))}
      </div>


      {/* ── DEPOSIT MODAL ────────────────────────────────────── */}
      {activeModal === "deposit" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e: React.MouseEvent<HTMLDivElement>) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <ArrowDownCircle size={18} className="text-violet-400" />
                <h3 className="text-lg font-bold text-white">Deposit USDC</h3>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Available balance */}
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-500">Available Balance</span>
              <span className="text-xs font-semibold text-gray-300">
                {formatUSDC(usdcBalance, 2)} USDC
              </span>
            </div>

            {/* Amount input */}
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
                  $
                </span>
                <input
                  type="number"
                  value={amountInput}
                  onChange={e => {
                    setAmountInput(e.target.value);
                    setInputError("");
                  }}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className={[
                    "w-full pl-8 pr-4 py-3 rounded-xl text-sm text-white",
                    "bg-gray-800 border focus:outline-none focus:ring-2",
                    "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                    inputError
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-700 focus:ring-violet-500",
                  ].join(" ")}
                />
              </div>
              <button
                onClick={handleMaxDeposit}
                className="px-4 py-3 rounded-xl bg-violet-900/50 border border-violet-700 text-xs font-semibold text-violet-300 hover:bg-violet-900 transition-colors"
              >
                MAX
              </button>
            </div>

            {/* Input error */}
            {inputError && (
              <div className="flex items-center gap-1.5 mb-3">
                <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">{inputError}</p>
              </div>
            )}

            {/* Confirm button */}
            <button
              onClick={handleDeposit}
              disabled={isTxLoading || !amountInput}
              className={[
                "w-full flex items-center justify-center gap-2 mt-4",
                "px-4 py-3 rounded-xl text-sm font-semibold text-white",
                "bg-gradient-to-r from-violet-600 to-purple-600",
                "hover:from-violet-700 hover:to-purple-700",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-all duration-150",
              ].join(" ")}
            >
              {isTxLoading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Depositing...
                </>
              ) : (
                <>
                  <ArrowDownCircle size={15} />
                  Confirm Deposit
                </>
              )}
            </button>

          </div>
        </div>
      )}


      {/* ── WITHDRAW MODAL ───────────────────────────────────── */}
      {activeModal === "withdraw" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e: React.MouseEvent<HTMLDivElement>) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <ArrowUpCircle size={18} className="text-gray-300" />
                <h3 className="text-lg font-bold text-white">Withdraw USDC</h3>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Deposited balance */}
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-500">Deposited Balance</span>
              <span className="text-xs font-semibold text-gray-300">
                {formatUSDC(depositedAmount, 2)} USDC
              </span>
            </div>

            {/* Pending yield info */}
            <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-800">
              <span className="text-xs text-gray-500">Pending Yield</span>
              <span className="text-xs font-semibold text-green-400">
                +{formatUSDC(pendingYield, 6)} USDC
              </span>
            </div>

            {/* Amount input */}
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
                  $
                </span>
                <input
                  type="number"
                  value={amountInput}
                  onChange={e => {
                    setAmountInput(e.target.value);
                    setInputError("");
                  }}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className={[
                    "w-full pl-8 pr-4 py-3 rounded-xl text-sm text-white",
                    "bg-gray-800 border focus:outline-none focus:ring-2",
                    "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                    inputError
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-700 focus:ring-violet-500",
                  ].join(" ")}
                />
              </div>
              <button
                onClick={handleMaxWithdraw}
                className="px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition-colors"
              >
                MAX
              </button>
            </div>

            {/* Input error */}
            {inputError && (
              <div className="flex items-center gap-1.5 mb-3">
                <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">{inputError}</p>
              </div>
            )}

            {/* You will receive info */}
            {parsedAmount > 0n && !inputError && (
              <div className="bg-gray-800 rounded-xl p-3 mb-3">
                <p className="text-xs text-gray-500 mb-1">You will receive</p>
                <p className="text-sm font-semibold text-white">
                  ~{formatUSDC(parsedAmount + pendingYield, 2)} USDC
                  <span className="text-xs text-green-400 ml-2">
                    (incl. yield)
                  </span>
                </p>
              </div>
            )}

            {/* Confirm button */}
            <button
              onClick={handleWithdraw}
              disabled={isTxLoading || !amountInput}
              className={[
                "w-full flex items-center justify-center gap-2 mt-2",
                "px-4 py-3 rounded-xl text-sm font-semibold text-white",
                "bg-gradient-to-r from-gray-700 to-gray-600",
                "hover:from-gray-600 hover:to-gray-500",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-all duration-150",
              ].join(" ")}
            >
              {isTxLoading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Withdrawing...
                </>
              ) : (
                <>
                  <ArrowUpCircle size={15} />
                  Confirm Withdrawal
                </>
              )}
            </button>

          </div>
        </div>
      )}

    </>
  );
}