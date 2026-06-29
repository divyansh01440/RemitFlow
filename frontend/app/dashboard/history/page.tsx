"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter }                    from "next/navigation";
import Link                             from "next/link";
import axios                            from "axios";
import {
  ArrowLeft, Download, Search,
  History, Send, ChevronLeft,
  ChevronRight, AlertCircle, Loader2,
}                                       from "lucide-react";
import useWallet                        from "../../../hooks/useWallet";
import TransactionCard                  from "../../../components/TransactionCard";
import { shortenAddress }               from "../../../lib/utils";

interface Transaction {
  transferId: string; sender: string; recipient: string;
  amount: string; fee: string; timestamp: number;
  status: 0 | 1 | 2; txHash: string; network: string;
}

type Filter = "all" | "sent" | "received" | "pending";

const ITEMS_PER_PAGE = 10;
const FILTER_TABS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" }, { label: "Sent", value: "sent" },
  { label: "Received", value: "received" }, { label: "Pending", value: "pending" },
];

function exportToCSV(transactions: Transaction[], address: string) {
  const headers = ["Transfer ID","From","To","Amount (USDC)","Fee (USDC)","Status","Date","Tx Hash"].join(",");
  const statusLabel = (s: number) => s === 0 ? "Pending" : s === 1 ? "Completed" : "Refunded";
  const formatAmount = (raw: string) => { try { const n = BigInt(raw); return `${n / 1_000_000n}.${(n % 1_000_000n).toString().padStart(6,"0")}`; } catch { return "0.000000"; } };
  const rows = transactions.map(tx => [tx.transferId, tx.sender, tx.recipient, formatAmount(tx.amount), formatAmount(tx.fee), statusLabel(tx.status), new Date(tx.timestamp * 1000).toISOString(), tx.txHash].map(v => `"${v}"`).join(","));
  const csv = [headers, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `remitflow-history-${shortenAddress(address, 4)}-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function HistoryPage() {
  const router = useRouter();
  const { isConnected, address } = useWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading]       = useState(false);
  const [errorMsg, setErrorMsg]         = useState("");
  const [filter, setFilter]             = useState<Filter>("all");
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);

  useEffect(() => { if (!isConnected) router.push("/auth"); }, [isConnected, router]);

  useEffect(() => {
    if (!address) return;
    const fetch = async () => {
      setIsLoading(true); setErrorMsg("");
      try {
        const res = await axios.get(`http://localhost:4000/api/transactions/${address}`);
        const data = res.data?.transactions ?? res.data ?? [];
        setTransactions(Array.isArray(data) ? data : []);
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          setErrorMsg(err.code === "ERR_NETWORK" ? "Cannot connect to backend. Make sure server is running on port 4000." : err.response?.data?.error ?? "Failed to load transactions.");
        } else { setErrorMsg("An unexpected error occurred."); }
        setTransactions([]);
      } finally { setIsLoading(false); }
    };
    fetch();
  }, [address]);

  const filteredTransactions = useMemo(() => {
    const norm = address?.toLowerCase() ?? "";
    const s    = search.toLowerCase().trim();
    return transactions.filter(tx => {
      if (filter === "sent"     && tx.sender.toLowerCase()    !== norm) return false;
      if (filter === "received" && tx.recipient.toLowerCase() !== norm) return false;
      if (filter === "pending"  && tx.status !== 0)                     return false;
      if (s && !tx.sender.toLowerCase().includes(s) && !tx.recipient.toLowerCase().includes(s) && !tx.transferId.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [transactions, filter, search, address]);

  const totalPages    = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTxns = filteredTransactions.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [filter, search]);

  if (!isConnected || !address) return null;

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        <Link href="/dashboard" className="inline-flex items-center gap-2 mb-6 text-sm text-gray-500 hover:text-gray-300 transition-colors duration-150 group">
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform duration-150" />
          Dashboard
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Transaction History</h1>
            <p className="text-gray-500 text-sm">All your USDC transfers on Polygon</p>
          </div>
          {transactions.length > 0 && (
            <span className="px-3 py-1.5 rounded-full bg-gray-900 border border-gray-800 text-xs text-gray-400 font-medium">
              {transactions.length} total
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 rounded-xl p-1 flex-shrink-0">
            {FILTER_TABS.map(({ label, value }) => (
              <button key={value} onClick={() => setFilter(value)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${filter === value ? "bg-violet-600 text-white shadow-sm" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by address or transfer ID..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors duration-150" />
          </div>
          <button onClick={() => { if (address && filteredTransactions.length > 0) exportToCSV(filteredTransactions, address); }} disabled={filteredTransactions.length === 0} className="flex items-center gap-2 px-4 py-2.5 rounded-xl flex-shrink-0 bg-gray-900 border border-gray-800 hover:bg-gray-800 hover:border-gray-700 text-sm text-gray-400 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150">
            <Download size={14} />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-800 rounded-xl mb-6">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-300 font-medium">Failed to load transactions</p>
              <p className="text-xs text-red-400 mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-800 rounded-full" />
                    <div className="w-24 h-4 bg-gray-800 rounded-lg" />
                  </div>
                  <div className="w-20 h-4 bg-gray-800 rounded-lg" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="w-16 h-3 bg-gray-800 rounded-lg" />
                  <div className="w-28 h-3 bg-gray-800 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && filteredTransactions.length === 0 && !errorMsg && (
          <div className="bg-gray-900 border border-gray-800 border-dashed rounded-2xl py-16 flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-4">
              <History size={28} className="text-gray-600" />
            </div>
            {search || filter !== "all" ? (
              <>
                <p className="text-gray-400 font-medium mb-1">No results found</p>
                <p className="text-gray-600 text-sm mb-5">Try adjusting your search or filter.</p>
                <button onClick={() => { setSearch(""); setFilter("all"); }} className="text-sm text-violet-400 hover:text-violet-300 transition-colors">Clear filters</button>
              </>
            ) : (
              <>
                <p className="text-gray-400 font-medium mb-1">No transactions yet</p>
                <p className="text-gray-600 text-sm mb-5">Your transfers will appear here once you send USDC.</p>
                <Link href="/dashboard/send" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-sm font-semibold text-white transition-all duration-150">
                  <Send size={14} />
                  Send Your First USDC
                </Link>
              </>
            )}
          </div>
        )}

        {!isLoading && paginatedTxns.length > 0 && (
          <div className="space-y-3">
            {paginatedTxns.map(tx => (
              <TransactionCard
                key={tx.transferId}
                transferId={tx.transferId}
                sender={tx.sender}
                recipient={tx.recipient}
                amount={BigInt(tx.amount || "0")}
                fee={BigInt(tx.fee || "0")}
                timestamp={tx.timestamp}
                status={tx.status}
                currentUserAddress={address}
              />
            ))}
          </div>
        )}

        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-800">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-sm text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150">
              <ChevronLeft size={15} />
              Prev
            </button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-sm text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150">
              Next
              <ChevronRight size={15} />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}