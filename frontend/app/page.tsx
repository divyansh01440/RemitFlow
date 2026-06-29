import Link          from "next/link";
import {
  ArrowRight,
  Zap,
  DollarSign,
  TrendingUp,
  Shield,
  Globe,
  Wallet,
  Send,
}                   from "lucide-react";

const STAT_PILLS = [
  "< $0.01 Gas Fee",
  "< 2 Second Transfers",
  "5% APY on Savings",
] as const;

export default function HomePage() {
  return (
    <div className="bg-gray-950 text-white">

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-24 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.15) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto text-center">

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-900/50 border border-violet-700 text-sm text-violet-300 font-medium mb-8">
            <span className="text-violet-400 text-base">⬡</span>
            Built on Polygon
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-tight mb-6">
            <span className="text-white">Send Money Globally.</span>
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Instantly. For Pennies.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Send USDC to anyone in the world. No banks. No hidden fees.
            Arrives in seconds — powered by Polygon blockchain.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-base font-semibold shadow-lg shadow-purple-900/40 transition-all duration-200 active:scale-95 group"
            >
              Launch App
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-150" />
            </Link>

            <a
              href="#how-it-works"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white text-base font-semibold transition-all duration-200"
            >
              How It Works
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {STAT_PILLS.map((pill) => (
              <span
                key={pill}
                className="px-4 py-2 rounded-full bg-gray-900 border border-gray-800 text-sm text-gray-400 font-medium"
              >
                ✓ {pill}
              </span>
            ))}
          </div>

        </div>
      </section>


      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-24 px-4">
        <div className="max-w-6xl mx-auto text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">How RemitFlow Works</h2>
          <p className="text-gray-500">Send money across borders in three simple steps.</p>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: 1, icon: Wallet,  title: "Connect Wallet",           desc: "Connect MetaMask in one click. No account needed." },
            { step: 2, icon: Globe,   title: "Enter Amount & Recipient",  desc: "Type the recipient address and USDC amount. See the fee upfront." },
            { step: 3, icon: Send,    title: "Send USDC Instantly",       desc: "Confirm in MetaMask. Arrives in under 2 seconds." },
          ].map(({ step, icon: Icon, title, desc }) => (
            <div key={step} className="flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center">
                  <Icon size={32} className="text-violet-400" />
                </div>
                <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-violet-600 border-2 border-gray-950 flex items-center justify-center text-xs font-bold text-white">
                  {step}
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed max-w-xs">{desc}</p>
            </div>
          ))}
        </div>
      </section>


      {/* FEATURES */}
      <section className="py-24 px-4 bg-gray-900/30">
        <div className="max-w-6xl mx-auto text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Built for the World</h2>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[
            { icon: Zap,        title: "Instant Transfers",      desc: "Under 2 seconds on Polygon.",        iconBg: "bg-yellow-900/40 border-yellow-700", iconColor: "text-yellow-400" },
            { icon: DollarSign, title: "Near-Zero Fees",         desc: "Just 0.3% — gas under $0.01.",       iconBg: "bg-green-900/40 border-green-700",  iconColor: "text-green-400"  },
            { icon: TrendingUp, title: "Earn 5% Yield",          desc: "Deposit USDC, withdraw anytime.",    iconBg: "bg-violet-900/40 border-violet-700",iconColor: "text-violet-400" },
            { icon: Shield,     title: "Fully Decentralized",    desc: "Smart contracts, no middlemen.",     iconBg: "bg-blue-900/40 border-blue-700",    iconColor: "text-blue-400"   },
          ].map(({ icon: Icon, title, desc, iconBg, iconColor }) => (
            <div key={title} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all duration-300">
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 ${iconBg}`}>
                <Icon size={22} className={iconColor} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>


      {/* STATS */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-3xl p-10 bg-gradient-to-r from-violet-900/80 via-purple-900/80 to-violet-900/80 border border-violet-700/50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: "$2.4M+", label: "Total Sent"  },
                { value: "1,200+", label: "Users"       },
                { value: "0.3%",   label: "Avg Fee"     },
                { value: "5% APY", label: "Yield Rate"  },
              ].map(({ value, label }) => (
                <div key={label}>
                  <p className="text-3xl sm:text-4xl font-extrabold text-white mb-1">{value}</p>
                  <p className="text-sm text-violet-300 font-medium">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


      {/* FINAL CTA */}
      <section className="py-24 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-5">
            Ready to send money{" "}
            <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
              globally?
            </span>
          </h2>
          <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
            Connect your wallet — it takes 10 seconds.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-lg font-bold shadow-2xl shadow-purple-900/40 transition-all duration-200 active:scale-95 group"
          >
            Get Started Free
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform duration-150" />
          </Link>
          <p className="mt-6 text-sm text-gray-600">No account needed · Non-custodial · Open source</p>
        </div>
      </section>


      {/* FOOTER */}
      <footer className="border-t border-gray-800 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-600">© 2024 RemitFlow. Built on Polygon.</p>
          <div className="flex items-center gap-6">
            <Link href="/dashboard"         className="text-sm text-gray-600 hover:text-gray-400 transition-colors">App</Link>
            <Link href="/dashboard/send"    className="text-sm text-gray-600 hover:text-gray-400 transition-colors">Send</Link>
            <Link href="/dashboard/yield"   className="text-sm text-gray-600 hover:text-gray-400 transition-colors">Yield</Link>
            <Link href="/dashboard/history" className="text-sm text-gray-600 hover:text-gray-400 transition-colors">History</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}