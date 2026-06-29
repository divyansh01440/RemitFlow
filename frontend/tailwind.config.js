/** @type {import('tailwindcss').Config} */
module.exports = {

    // ============================================================
    // 📁  CONTENT PATHS
    // Tells Tailwind which files to scan for class names.
    // Tailwind removes any CSS classes NOT found in these files
    // from the final build — keeping your CSS bundle tiny.
    // Add new folders here if you create them (e.g. ./lib/**/*.tsx)
    // ============================================================
    content: [
      "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}" // All reusable components
    ],
  
  
    theme: {
      extend: {
  
        // ============================================================
        // 🎨  CUSTOM COLORS
        // These extend Tailwind's default colors — you keep all the
        // defaults (gray, blue, red, etc.) AND get these new ones.
        //
        // Usage examples:
        //   bg-brand-500       → purple background
        //   text-brand-300     → light purple text
        //   border-success-400 → green border
        //   bg-danger-900      → dark red background
        //   text-warning-300   → amber warning text
        // ============================================================
        colors: {
  
          // ── Brand (Purple) ─────────────────────────────────────
          // The main color of RemitFlow — a violet/purple palette.
          // brand-500 is the "base" purple used for buttons and accents.
          // brand-50 is nearly white (good for light backgrounds).
          // brand-900 is very dark purple (good for dark mode cards).
          brand: {
            50:  "#f5f3ff",  // Almost white, very light purple tint
            100: "#ede9fe",  // Very light purple (hover backgrounds)
            200: "#ddd6fe",  // Light purple (disabled states)
            300: "#c4b5fd",  // Soft purple (secondary text, borders)
            400: "#a78bfa",  // Medium-light purple (icons, accents)
            500: "#8b5cf6",  // ← BASE purple (primary buttons, links)
            600: "#7c3aed",  // Darker purple (button hover states)
            700: "#6d28d9",  // Dark purple (active/pressed states)
            800: "#5b21b6",  // Very dark purple (headings on dark bg)
            900: "#4c1d95",  // Darkest purple (deep backgrounds)
          },
  
          // ── Success (Green) ────────────────────────────────────
          // Used for: completed transactions, positive balances,
          // "Received" labels, success toasts, checkmarks.
          success: {
            50:  "#f0fdf4",  // Almost white green
            100: "#dcfce7",  // Very light green
            200: "#bbf7d0",  // Light green
            300: "#86efac",  // Soft green
            400: "#4ade80",  // Medium green
            500: "#22c55e",  // ← BASE green (success states)
            600: "#16a34a",  // Darker green
            700: "#15803d",  // Dark green
            800: "#166534",  // Very dark green
            900: "#14532d",  // Darkest green
          },
  
          // ── Danger (Red) ───────────────────────────────────────
          // Used for: error messages, "Sent" labels (money out),
          // failed transactions, warning alerts, delete buttons.
          danger: {
            50:  "#fff1f2",  // Almost white red
            100: "#ffe4e6",  // Very light red
            200: "#fecdd3",  // Light red/pink
            300: "#fda4af",  // Soft red
            400: "#fb7185",  // Medium red
            500: "#f43f5e",  // ← BASE red (error states)
            600: "#e11d48",  // Darker red
            700: "#be123c",  // Dark red
            800: "#9f1239",  // Very dark red
            900: "#881337",  // Darkest red
          },
  
          // ── Warning (Amber) ────────────────────────────────────
          // Used for: pending transactions, low balance warnings,
          // "Pending" status badges, caution alerts.
          warning: {
            50:  "#fffbeb",  // Almost white amber
            100: "#fef3c7",  // Very light amber
            200: "#fde68a",  // Light amber/yellow
            300: "#fcd34d",  // Soft amber
            400: "#fbbf24",  // Medium amber
            500: "#f59e0b",  // ← BASE amber (warning states)
            600: "#d97706",  // Darker amber
            700: "#b45309",  // Dark amber/orange
            800: "#92400e",  // Very dark amber
            900: "#78350f",  // Darkest amber
          },
        },
  
  
        // ============================================================
        // 🔤  CUSTOM FONTS
        // Sets Inter as the default font for all text.
        // Inter is a clean, modern font designed for UI — perfect
        // for a finance/crypto app that needs to look trustworthy.
        //
        // To use Inter, add this to your layout.tsx:
        //   import { Inter } from 'next/font/google'
        //   const inter = Inter({ subsets: ['latin'] })
        //   <html className={inter.className}>
        //
        // Usage: font-sans (applied automatically to body by Tailwind)
        // ============================================================
        fontFamily: {
          sans: [
            "Inter",           // Primary font — loaded via next/font/google
            "ui-sans-serif",   // System fallback
            "system-ui",       // OS default sans-serif
            "sans-serif",      // Generic fallback
          ],
        },
  
  
        // ============================================================
        // 🌟  CUSTOM SHADOWS
        // Extend Tailwind's default shadow scale with custom ones.
        //
        // card → subtle dark shadow for dashboard cards
        //         Gives cards a "lifted" appearance on dark backgrounds
        //         Usage: shadow-card
        //
        // glow → purple glow effect for highlighted elements
        //         Use on active buttons, selected cards, focused inputs
        //         Usage: shadow-glow
        //         Example: "Connect Wallet" button on hover
        // ============================================================
        boxShadow: {
          // Subtle dark shadow — good for cards on dark (gray-900) backgrounds
          // Two layers: one for spread, one for blur — creates depth
          card: "0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)",
  
          // Purple glow — makes elements look like they're lit with purple light
          // Great for: active wallet button, selected network badge, focused inputs
          glow: "0 0 20px rgba(139, 92, 246, 0.3)",
  
          // Stronger glow for hover states
          "glow-lg": "0 0 40px rgba(139, 92, 246, 0.4)",
  
          // Inner glow for pressed/active button states
          "glow-inner": "inset 0 0 20px rgba(139, 92, 246, 0.2)",
        },
  
  
        // ============================================================
        // 🔲  CUSTOM BORDER RADIUS
        // Extra large radius options for the rounded card style
        // common in modern crypto/DeFi app UIs.
        // ============================================================
        borderRadius: {
          "4xl": "2rem",   // 32px — very rounded cards
          "5xl": "2.5rem", // 40px — pill-shaped large elements
        },
  
  
        // ============================================================
        // 🎞️  CUSTOM ANIMATIONS
        // Subtle animations to make the UI feel alive and responsive.
        // ============================================================
        animation: {
          // Smooth pulse for loading skeletons
          "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          // Fade in for modals and dropdowns
          "fade-in": "fadeIn 0.2s ease-in-out",
          // Slide up for toast notifications
          "slide-up": "slideUp 0.3s ease-out",
        },
        keyframes: {
          fadeIn: {
            "0%":   { opacity: "0" },
            "100%": { opacity: "1" },
          },
          slideUp: {
            "0%":   { transform: "translateY(10px)", opacity: "0" },
            "100%": { transform: "translateY(0)",    opacity: "1" },
          },
        },
      },
    },
  
  
    // No plugins needed
    plugins: [],
  };