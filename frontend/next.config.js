// ============================================================
// 📄  next.config.js — Next.js Configuration File
//
// This file controls how Next.js builds and runs your app.
// It is loaded automatically by Next.js on every dev/build.
//
// What this file does:
//   1. Fixes webpack errors caused by ethers.js / wagmi trying
//      to use Node.js modules (fs, net, tls) in the browser
//   2. Adds security headers to protect users from common attacks
//   3. Allows images from trusted external domains (CoinGecko, Polygonscan)
//   4. Enables React Strict Mode for better error detection in dev
//
// You should NOT need to edit this file unless you add new
// blockchain libraries or external image sources.
// ============================================================

/** @type {import('next').NextConfig} */
const nextConfig = {

    // ============================================================
    // ⚛️  REACT STRICT MODE
    // Enables extra warnings and checks during development.
    // Helps catch bugs early — has no effect in production.
    // May cause some effects to run twice in dev (this is normal).
    // ============================================================
    reactStrictMode: true,
  
  
    // ============================================================
    // 🖼️  IMAGE DOMAINS
    // Next.js blocks external images by default for security.
    // Add domains here that you want to load images from.
    //
    // assets.coingecko.com  → crypto token logos
    // polygonscan.com       → blockchain explorer assets
    // ============================================================
    images: {
      domains: [
        "assets.coingecko.com",  // Crypto token icons (e.g. USDC logo)
        "polygonscan.com",        // Polygon blockchain explorer assets
      ],
    },
  
  
    // ============================================================
    // 🔒  SECURITY HEADERS
    // These HTTP headers are sent with every page response.
    // They protect users from common web attacks.
    //
    // X-Frame-Options: DENY
    //   → Prevents your site from being loaded inside an <iframe>
    //   → Protects against "clickjacking" attacks where a hacker
    //     hides your site inside their site to steal clicks
    //
    // X-Content-Type-Options: nosniff
    //   → Stops browsers from guessing file types
    //   → Prevents hackers from tricking browsers into running
    //     malicious files as JavaScript
    //
    // Referrer-Policy: strict-origin-when-cross-origin
    //   → Controls how much URL info is shared when users click links
    //   → Only sends the domain (not the full URL) to other sites
    //   → Protects users' privacy and prevents leaking sensitive URLs
    // ============================================================
    async headers() {
      return [
        {
          // Apply these headers to ALL routes in your app
          source: "/(.*)",
          headers: [
            {
              key:   "X-Frame-Options",
              value: "DENY",
            },
            {
              key:   "X-Content-Type-Options",
              value: "nosniff",
            },
            {
              key:   "Referrer-Policy",
              value: "strict-origin-when-cross-origin",
            },
            {
              // Permissions Policy: disable features this app doesn't need
              // Reduces attack surface by turning off unused browser APIs
              key:   "Permissions-Policy",
              value: "camera=(), microphone=(), geolocation=()",
            },
          ],
        },
      ];
    },
  
  
    // ============================================================
    // 📦  WEBPACK CONFIGURATION
    // Webpack is the tool that bundles your code for the browser.
    //
    // THE PROBLEM:
    //   ethers.js and wagmi are designed to work in both Node.js
    //   (server) and browsers. But some Node.js built-in modules
    //   like "fs" (file system), "net" (networking), and "tls"
    //   (security) don't exist in browsers.
    //
    //   Without this fix, you get errors like:
    //   ❌ "Module not found: Can't resolve 'fs'"
    //   ❌ "Module not found: Can't resolve 'net'"
    //   ❌ "Module not found: Can't resolve 'tls'"
    //
    // THE FIX:
    //   Tell webpack to replace these missing modules with "false"
    //   (meaning: don't include them, and don't throw an error).
    //   The browser versions of ethers/wagmi don't actually USE
    //   these modules — they just import them conditionally.
    // ============================================================
    webpack: (config, { isServer }) => {
  
      // Only apply the fallback fix for browser (client) builds
      // Server-side builds run in Node.js where fs/net/tls exist natively
      if (!isServer) {
        config.resolve.fallback = {
          // Setting these to false tells webpack:
          // "If something tries to import this, just ignore it"
          fs:     false,  // File system — not available in browsers
          net:    false,  // Network sockets — not available in browsers
          tls:    false,  // TLS/SSL — not available in browsers
          dns:    false,  // DNS lookup — not available in browsers
          module: false,  // Node module system — not available in browsers
        };
      }
  
      // IMPORTANT: Always return the modified config
      // If you forget this, your entire webpack config breaks
      return config;
    },
  };
  
  module.exports = nextConfig;