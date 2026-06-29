"use client";

import { useState } from "react";
import {
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import {
  formatUSDC,
  shortenAddress,
  formatDate,
  getStatusInfo,
} from "../lib/utils";

interface TransactionCardProps {
  transferId:         string;
  sender:             string;
  recipient:          string;
  amount:             bigint;
  fee:                bigint;
  timestamp:          number;
  status:             0 | 1 | 2;
  currentUserAddress: string;
}

export default function TransactionCard({
  transferId,
  sender,
  recipient,
  amount,
  fee,
  timestamp,
  status,
  currentUserAddress,
}: TransactionCardProps) {

  const [isExpanded, setIsExpanded] = useState(false);

  const normalizedSender    = sender.toLowerCase();
  const normalizedRecipient = recipient.toLowerCase();
  const normalizedUser      = currentUserAddress.toLowerCase();

  const isSent     = normalizedSender    === normalizedUser;
  const isReceived = normalizedRecipient === normalizedUser;

  const statusInfo = getStatusInfo(status);
  const netAmount  = amount - fee;

  const borderColor =
    status === 0 ? "border-l-yellow-500" :
    status === 1 ? "border-l-green-500"  :
                   "border-l-gray-600";

  const polygonscanBase = "https://polygonscan.com";

  return (
    <div
      className={[
        "bg-gray-900 border border-gray-800 rounded-xl border-l-4",
        borderColor,
        "hover:border-gray-700 transition-colors duration-150 cursor-pointer",
      ].join(" ")}
      onClick={() => setIsExpanded(prev => !prev)}
    >

      {/* MAIN CONTENT */}
      <div className="p-4">

        {/* ROW 1 */}
        <div className="flex items-center justify-between gap-3">

          {/* Direction label */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isSent ? (
              <>
                <div className="w-8 h-8 rounded-full bg-red-900/40 border border-red-800 flex items-center justify-center flex-shrink-0">
                  <ArrowUpRight size={14} className="text-red-400" />
                </div>
                <span className="text-sm font-semibold text-red-400">Sent</span>
              </>
            ) : isReceived ? (
              <>
                <div className="w-8 h-8 rounded-full bg-green-900/40 border border-green-800 flex items-center justify-center flex-shrink-0">
                  <ArrowDownLeft size={14} className="text-green-400" />
                </div>
                <span className="text-sm font-semibold text-green-400">Received</span>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
                  <ArrowRight size={14} className="text-gray-400" />
                </div>
                <span className="text-sm font-semibold text-gray-400">Transfer</span>
              </>
            )}
          </div>

          {/* Sender to Recipient */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-1 min-w-0">
            <span className={`font-mono truncate ${isSent ? "text-gray-300" : "text-gray-500"}`}>
              {shortenAddress(sender, 4)}
            </span>
            <ArrowRight size={10} className="text-gray-600 flex-shrink-0" />
            <span className={`font-mono truncate ${isReceived ? "text-gray-300" : "text-gray-500"}`}>
              {shortenAddress(recipient, 4)}
            </span>
          </div>

          {/* Amount and chevron */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              {isSent ? (
                <p className="text-sm font-bold text-red-400">
                  -{formatUSDC(amount, 2)} USDC
                </p>
              ) : isReceived ? (
                <p className="text-sm font-bold text-green-400">
                  +{formatUSDC(netAmount, 2)} USDC
                </p>
              ) : (
                <p className="text-sm font-bold text-gray-300">
                  {formatUSDC(amount, 2)} USDC
                </p>
              )}
            </div>
            {isExpanded
              ? <ChevronUp   size={14} className="text-gray-500 flex-shrink-0" />
              : <ChevronDown size={14} className="text-gray-500 flex-shrink-0" />
            }
          </div>

        </div>

        {/* ROW 2: Status + Date + Link */}
        <div className="flex items-center justify-between mt-3 gap-2">

          <span className={[
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
            statusInfo.bgColor,
            statusInfo.textColor,
          ].join(" ")}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
            {statusInfo.label}
          </span>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {formatDate(timestamp)}
            </span>
            <a
              href={polygonscanBase + "/tx/" + transferId}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e: React.MouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-violet-400 transition-colors"
            >
              <ExternalLink size={11} />
              <span className="hidden sm:inline">Polygonscan</span>
            </a>
          </div>

        </div>
      </div>


      {/* EXPANDED SECTION */}
      {isExpanded && (
        <div
          className="border-t border-gray-800 px-4 pb-4 pt-3"
          onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
        >
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
            Transaction Details
          </p>

          <div className="space-y-3">

            <div>
              <p className="text-xs text-gray-600 mb-1">From</p>
              <p className="font-mono text-xs text-gray-300 break-all bg-gray-800 rounded-lg px-3 py-2">
                {sender}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-600 mb-1">To</p>
              <p className="font-mono text-xs text-gray-300 break-all bg-gray-800 rounded-lg px-3 py-2">
                {recipient}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">

              <div className="bg-gray-800 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-600 mb-0.5">Amount Sent</p>
                <p className="text-sm font-semibold text-white">
                  {formatUSDC(amount, 6)} USDC
                </p>
              </div>

              <div className="bg-gray-800 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-600 mb-0.5">Fee</p>
                <p className="text-sm font-semibold text-gray-400">
                  {formatUSDC(fee, 6)} USDC
                </p>
              </div>

              <div className="bg-gray-800 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-600 mb-0.5">Recipient Got</p>
                <p className="text-sm font-semibold text-green-400">
                  {formatUSDC(netAmount, 6)} USDC
                </p>
              </div>

              <div className="bg-gray-800 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-600 mb-0.5">Date</p>
                <p className="text-xs font-medium text-gray-300">
                  {formatDate(timestamp)}
                </p>
              </div>

            </div>

            <div>
              <p className="text-xs text-gray-600 mb-1">Transfer ID</p>
              <div className="flex items-start gap-2 bg-gray-800 rounded-lg px-3 py-2">
                <p className="font-mono text-xs text-gray-500 break-all flex-1">
                  {transferId}
                </p>
                <a
                  href={polygonscanBase + "/tx/" + transferId}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e: React.MouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
                  className="text-gray-500 hover:text-violet-400 transition-colors flex-shrink-0 mt-0.5"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}