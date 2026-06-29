import "./globals.css";
import type { Metadata }  from "next";
import { Inter }          from "next/font/google";
import Link               from "next/link";
import { Toaster }        from "react-hot-toast";
import Providers          from "./Providers";
import WalletConnect      from "../components/WalletConnect";

const inter = Inter({
  subsets:  ["latin"],
  variable: "--font-inter",
  display:  "swap",
});

export const metadata: Metadata = {
  title:       "RemitFlow — Send Money Globally",
  description: "Cross-border USDC remittance on Polygon blockchain",
};

const NAV_LINKS = [
  { href: "/dashboard",         label: "Dashboard" },
  { href: "/dashboard/send",    label: "Send"      },
  { href: "/dashboard/history", label: "History"   },
  { href: "/dashboard/yield",   label: "Yield"     },
] as const;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={[
        inter.variable,
        inter.className,
        "bg-gray-950",
        "text-white",
        "antialiased",
      ].join(" ")}
    >
      <body>
        <Providers>

          {/* NAVIGATION */}
          <nav className="sticky top-0 z-50 bg-gray-900/95 border-b border-gray-800 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">

                {/* Logo */}
                <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
                  <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                    RemitFlow
                  </span>
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-violet-900/50 border border-violet-700 text-xs text-violet-300 font-medium">
                    on Polygon
                  </span>
                </Link>

                {/* Desktop nav */}
                <div className="hidden md:flex items-center gap-1">
                  {NAV_LINKS.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors duration-150"
                    >
                      {label}
                    </Link>
                  ))}
                </div>

                {/* Wallet */}
                <div className="flex items-center gap-3">
                  <WalletConnect />
                </div>

              </div>
            </div>

            {/* Mobile nav */}
            <div className="md:hidden border-t border-gray-800">
              <div className="flex items-center justify-around py-2 px-4">
                {NAV_LINKS.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors duration-150"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </nav>

          {/* Main */}
          <main className="min-h-screen bg-gray-950">
            {children}
          </main>

          {/* Toaster */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background:   "#1f2937",
                color:        "#f9fafb",
                border:       "1px solid #374151",
                borderRadius: "12px",
                fontSize:     "14px",
                maxWidth:     "380px",
              },
              success: {
                duration: 5000,
                iconTheme: { primary: "#4ade80", secondary: "#14532d" },
                style: { background: "#14532d", border: "1px solid #16a34a", color: "#f0fdf4" },
              },
              error: {
                duration: 6000,
                iconTheme: { primary: "#f87171", secondary: "#7f1d1d" },
                style: { background: "#7f1d1d", border: "1px solid #b91c1c", color: "#fef2f2" },
              },
              loading: {
                iconTheme: { primary: "#a78bfa", secondary: "#4c1d95" },
              },
            }}
          />

        </Providers>
      </body>
    </html>
  );
}