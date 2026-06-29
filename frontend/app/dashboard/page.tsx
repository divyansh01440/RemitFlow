"use client";

import { useEffect }   from "react";
import { useRouter }   from "next/navigation";
import Link            from "next/link";
import {
  ArrowLeft, TrendingUp,
  Info, CheckCircle, Zap, Shield, Unlock,
}                      from "lucide-react";
import useWallet       from "../../hooks/useWallet";
import useYield        from "../../hooks/useYield";
import YieldDisplay    from "../../components/YieldDisplay";

const HOW_IT_WORKS = [
  { step: 1, icon: Zap,    iconBg: "bg-violet-900/50 border-violet-700", iconColor: "text-violet-400", title: "Deposit USDC",              description: "Transfer your idle USDC into the RemitFlow smart contract on Polygon."            },
  { step: 2, icon: Shield, iconBg: "bg-blue-900/50 border-blue-700",    iconColor: "text-blue-400",   title: "Held Securely On-Chain",    description: "Your USDC is held by an audited smart contract — fully transparent, no custodian." },
  { step: 3, icon: Unlock, iconBg: "bg-green-900/50 border-green-700",  iconColor: "text-green-400",  title: "Earn 5% APY, Anytime",      description: "Interest accrues every second. Withdraw principal + yield with no lock-up period." },
] as const;

const COMPARISON_ROWS = [
  { platform: "RemitFlow",          apy: "5.00%", withdraw: "Anytime",    fdic: "No",  highlight: true  },
  { platform: "US Savings Account", apy: "0.50%", withdraw: "Anytime",    fdic: "Yes", highlight: false },
  { platform: "Money Market Fund",  apy: "4.50%", withdraw: "1–2 days",   fdic: "No",  highlight: false },
  { platform: "Bank CD (1 year)",   apy: "4.80%", withdraw: "At maturity",fdic: "Yes", highlight: false },
] as const;

export default function YieldPage() {
  const router                         = useRouter();
  const { isConnected, address }       = useWallet();
  const { apy }                        = useYield(address);

  useEffect(() => {
    if (!isConnected) router.push("/auth");
  }, [isConnected, router]);

  if (!isConnected) return null;

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        <Link href="/dashboard" className="inline-flex items-center gap-2 mb-6 text-sm text-gray-500 hover:text-gray-300 transition-colors duration-150 group">
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform duration-150" />
          Dashboard
        </Link>

        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-green-900/40 border border-green-700 flex items-center justify-center">
                <TrendingUp size={18} className="text-green-400" />
              </div>
              <h1 className="text-3xl font-bold text-white">Earn Yield</h1>
              <span className="px-3 py-1 rounded-full bg-green-900/50 border border-green-700 text-sm font-bold text-green-300">
                {apy}% APY
              </span>
            </div>
            <p className="text-gray-500 text-sm pl-12">
              Deposit idle USDC and earn interest automatically — withdraw anytime
            </p>
          </div>
        </div>

        <div className="mb-8">
          <YieldDisplay />
        </div>

        {/* How It Works */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-5">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {HOW_IT_WORKS.map(({ step, icon: Icon, iconBg, iconColor, title, description }) => (
              <div key={step} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors duration-150 relative">
                <div className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-gray-950 border border-gray-700 flex items-center justify-center">
                  <span className="text-xs font-bold text-gray-400">{step}</span>
                </div>
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 ${iconBg}`}>
                  <Icon size={20} className={iconColor} />
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison Table */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-5">APY Comparison</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-4 gap-4 px-5 py-3 border-b border-gray-800 bg-gray-800/30">
              {["Platform", "APY", "Withdraw", "FDIC"].map(h => (
                <span key={h} className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center first:text-left">{h}</span>
              ))}
            </div>
            {COMPARISON_ROWS.map(({ platform, apy, withdraw, fdic, highlight }) => (
              <div key={platform} className={`grid grid-cols-4 gap-4 px-5 py-4 border-b border-gray-800 last:border-0 items-center ${highlight ? "bg-violet-900/10 border-l-2 border-l-violet-500 pl-4" : "hover:bg-gray-800/20 transition-colors duration-150"}`}>
                <div className="flex items-center gap-2">
                  {highlight && <CheckCircle size={13} className="text-violet-400 flex-shrink-0" />}
                  <span className={`text-sm font-medium ${highlight ? "text-white" : "text-gray-400"}`}>{platform}</span>
                </div>
                <span className={`text-sm font-bold text-center ${highlight ? "text-green-400" : "text-gray-500"}`}>{apy}</span>
                <span className={`text-xs text-center ${highlight ? "text-gray-300" : "text-gray-600"}`}>{withdraw}</span>
                <span className={`text-xs text-center ${highlight ? "text-gray-400" : "text-gray-600"}`}>{fdic}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Disclaimer */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-900 border border-gray-800">
          <Info size={15} className="text-gray-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="font-semibold text-gray-400">Risk Disclosure: </span>
            Smart contract risk applies. Yield rate may vary. Not FDIC insured.
            This is not financial advice — only deposit funds you can afford to lose.
          </p>
        </div>

      </div>
    </div>
  );
}