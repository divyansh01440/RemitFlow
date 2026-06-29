"use client";

import { useEffect, useState } from "react";
import { useRouter }           from "next/navigation";
import Link                    from "next/link";
import { ArrowLeft, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import useWallet               from "../../../hooks/useWallet";
import SendForm                from "../../../components/SendForm";

const WHY_ITEMS = [
  "Arrives in under 2 seconds",
  "Only 0.3% fee — no hidden charges",
  "Secured by Polygon blockchain",
  "Track your transfer on Polygonscan",
] as const;

const FAQ_ITEMS = [
  { question: "What is USDC?",          answer: "USDC is a stablecoin pegged 1:1 to the US Dollar. It always equals exactly $1.00 — perfect for sending money without price volatility."                      },
  { question: "How long does it take?", answer: "Transfers on Polygon confirm in under 2 seconds — far faster than bank wires (1–5 days) or traditional remittance services."                                  },
  { question: "What are the fees?",     answer: "RemitFlow charges 0.3% per transfer. Polygon gas fees are usually under $0.01. No hidden fees, no exchange rate markups, no monthly charges."               },
] as const;

export default function SendPage() {
  const router              = useRouter();
  const { isConnected }     = useWallet();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Send USDC</h1>
          <p className="text-gray-500">Instant cross-border transfers on Polygon</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Send Form */}
          <div className="lg:col-span-2">
            <SendForm />
          </div>

          {/* Right sidebar */}
          <div className="lg:col-span-1 space-y-4">

            {/* Why RemitFlow */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-4">Why RemitFlow?</h3>
              <ul className="space-y-3">
                {WHY_ITEMS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle size={15} className="text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-400">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* FAQ */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 pt-5 pb-3">
                <h3 className="text-sm font-bold text-white">Frequently Asked</h3>
              </div>
              <div className="divide-y divide-gray-800">
                {FAQ_ITEMS.map(({ question, answer }, index) => {
                  const isOpen = openFaq === index;
                  return (
                    <div key={question}>
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : index)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/50 transition-colors duration-150"
                      >
                        <span className={`text-sm font-medium pr-4 ${isOpen ? "text-white" : "text-gray-300"}`}>
                          {question}
                        </span>
                        {isOpen
                          ? <ChevronUp   size={15} className="text-gray-500 flex-shrink-0" />
                          : <ChevronDown size={15} className="text-gray-500 flex-shrink-0" />
                        }
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4">
                          <p className="text-sm text-gray-400 leading-relaxed">{answer}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}