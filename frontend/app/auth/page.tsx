"use client";

import { useEffect }    from "react";
import { useRouter }    from "next/navigation";
import Link             from "next/link";
import { Wallet, Shield, ArrowLeft } from "lucide-react";
import useWallet        from "../../hooks/useWallet";
import WalletConnect    from "../../components/WalletConnect";

const SUPPORTED_WALLETS = [
  { emoji: "🦊", name: "MetaMask"        },
  { emoji: "🔗", name: "WalletConnect"   },
  { emoji: "💙", name: "Coinbase Wallet" },
] as const;

export default function AuthPage() {
  const { isConnected } = useWallet();
  const router          = useRouter();

  useEffect(() => {
    if (isConnected) router.push("/dashboard");
  }, [isConnected, router]);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 20%, rgba(139,92,246,0.1) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 p-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors duration-150 group">
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform duration-150" />
          Back to Home
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">

            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-2xl bg-violet-900/40 border border-violet-700 flex items-center justify-center shadow-lg shadow-violet-900/30">
                <Wallet size={36} className="text-violet-400" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-white text-center mb-3">
              Connect Your Wallet
            </h1>

            <p className="text-gray-400 text-sm text-center leading-relaxed mb-8">
              RemitFlow uses your crypto wallet for secure login —
              no username or password needed.
            </p>

            <div className="flex justify-center mb-8">
              <WalletConnect />
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-xs text-gray-600 font-medium whitespace-nowrap">Supported wallets</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
              {SUPPORTED_WALLETS.map(({ emoji, name }) => (
                <span key={name} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-xs text-gray-400 font-medium">
                  <span>{emoji}</span>
                  {name}
                </span>
              ))}
            </div>

            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700">
              <Shield size={15} className="text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500 leading-relaxed">
                We never store your private keys. Every transaction requires your explicit approval in MetaMask.
              </p>
            </div>

          </div>

          <p className="text-center text-xs text-gray-700 mt-6">
            Don&apos;t have a wallet?{" "}
            <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:text-violet-400 transition-colors">
              Download MetaMask →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}