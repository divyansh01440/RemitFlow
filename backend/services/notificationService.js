// ============================================================
// 📄  services/notificationService.js — Email Notifications
//
// Sends transactional emails to users when USDC is sent
// or received via RemitFlow, using SendGrid's API.
//
// Design principles:
//   - NEVER throws — a failed email must never crash the app
//   - Gracefully skips if SendGrid is not configured
//   - All functions are async but errors are caught internally
//   - Emails are HTML with a consistent branded template
//
// HOW TO SET UP SENDGRID:
//   1. Sign up at https://sendgrid.com (free: 100 emails/day)
//   2. Settings → API Keys → Create API Key → Full Access
//   3. Settings → Sender Authentication → Verify your email
//   4. Add to .env:
//        SENDGRID_API_KEY=SG.xxxxxxxxxxxx
//        NOTIFICATION_FROM_EMAIL=your-verified@email.com
// ============================================================

const sgMail = require("@sendgrid/mail");

// Configure SendGrid API key if available
// We check for the key before every send too — in case env changes
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log("✅  notificationService: SendGrid configured");
} else {
  console.warn(
    "⚠️  notificationService: SENDGRID_API_KEY not set.\n" +
    "   Notifications will be skipped. Add key to .env to enable."
  );
}


// ============================================================
// 🔧  HELPERS
// ============================================================

/**
 * shortenAddress — shortens an Ethereum address for display.
 *
 * @param  {string} address - Full Ethereum address
 * @returns {string} Shortened address like "0x742d...f44e"
 *
 * Usage:
 *   shortenAddress("0x742d35Cc6634C0532925a3b844Bc454e4438f44e")
 *   // "0x742d...f44e"
 */
const shortenAddress = (address) => {
  if (!address || address.length < 10) return address || "Unknown";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * buildEmail — constructs a SendGrid message object.
 *
 * @param  {string} to       - Recipient email address
 * @param  {string} subject  - Email subject line
 * @param  {string} htmlBody - HTML content of the email
 * @returns {object} SendGrid message object ready to pass to sgMail.send()
 */
const buildEmail = (to, subject, htmlBody) => ({
  to,
  from: {
    email: process.env.NOTIFICATION_FROM_EMAIL || "noreply@remitflow.app",
    name:  "RemitFlow",
  },
  subject,
  html: htmlBody,
  // Plain text fallback for email clients that don't render HTML
  text: htmlBody.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim(),
});

/**
 * getPolygonscanUrl — builds a Polygonscan link for a tx hash.
 *
 * @param  {string} txHash  - Transaction hash
 * @param  {string} network - "polygon" | "amoy" | "mumbai"
 * @returns {string} Full Polygonscan URL
 */
const getPolygonscanUrl = (txHash, network = "polygon") => {
  const base = network === "polygon"
    ? "https://polygonscan.com"
    : "https://amoy.polygonscan.com";
  return `${base}/tx/${txHash}`;
};

/**
 * formatUSDC — formats a raw USDC bigint string for display.
 *
 * @param  {string} rawAmount - Raw USDC amount (6 decimals)
 * @returns {string} Formatted like "100.50 USDC"
 */
const formatUSDC = (rawAmount) => {
  try {
    const amount = Number(BigInt(rawAmount || "0")) / 1_000_000;
    return `${amount.toFixed(2)} USDC`;
  } catch {
    return "0.00 USDC";
  }
};

/**
 * buildEmailTemplate — wraps content in a consistent branded HTML shell.
 * Produces a clean, mobile-friendly email with RemitFlow branding.
 *
 * @param  {string} content - Inner HTML content
 * @returns {string} Full HTML email string
 */
const buildEmailTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RemitFlow Notification</title>
</head>
<body style="
  margin: 0;
  padding: 0;
  background-color: #0a0a0f;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #e2e8f0;
">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="
          max-width: 600px;
          width: 100%;
          background-color: #111118;
          border-radius: 16px;
          border: 1px solid #2d2d3d;
          overflow: hidden;
        ">

          <!-- HEADER -->
          <tr>
            <td style="
              background: linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%);
              padding: 28px 32px;
              text-align: center;
            ">
              <div style="
                font-size: 22px;
                font-weight: 800;
                color: #ffffff;
                letter-spacing: -0.5px;
              ">
                ⬡ RemitFlow
              </div>
              <div style="
                font-size: 12px;
                color: #c4b5fd;
                margin-top: 4px;
              ">
                Cross-border USDC remittance on Polygon
              </div>
            </td>
          </tr>

          <!-- CONTENT -->
          <tr>
            <td style="padding: 32px;">
              ${content}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="
              background-color: #0d0d14;
              border-top: 1px solid #2d2d3d;
              padding: 20px 32px;
              text-align: center;
            ">
              <p style="
                margin: 0 0 8px 0;
                font-size: 11px;
                color: #4b5563;
              ">
                You received this email because you have notifications enabled on RemitFlow.
              </p>
              <p style="margin: 0; font-size: 11px; color: #374151;">
                Powered by Polygon blockchain · Not financial advice
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

/**
 * Reusable styles for HTML elements in email bodies.
 * Defined as constants to keep the HTML consistent.
 */
const STYLES = {
  h1: `
    margin: 0 0 8px 0;
    font-size: 24px;
    font-weight: 800;
    color: #ffffff;
  `,
  subtitle: `
    margin: 0 0 28px 0;
    font-size: 14px;
    color: #9ca3af;
  `,
  table: `
    width: 100%;
    border-collapse: collapse;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #2d2d3d;
    margin-bottom: 24px;
  `,
  tableLabel: `
    padding: 12px 16px;
    font-size: 12px;
    color: #6b7280;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background-color: #0d0d14;
    border-bottom: 1px solid #2d2d3d;
    width: 35%;
  `,
  tableValue: `
    padding: 12px 16px;
    font-size: 13px;
    color: #e2e8f0;
    background-color: #111118;
    border-bottom: 1px solid #2d2d3d;
    font-family: monospace;
  `,
  button: `
    display: inline-block;
    padding: 12px 24px;
    background: linear-gradient(135deg, #6d28d9, #7c3aed);
    color: #ffffff;
    text-decoration: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
  `,
  amountBig: `
    font-size: 32px;
    font-weight: 800;
    color: #a78bfa;
    margin: 16px 0;
  `,
};


// ============================================================
// 📧  EXPORTED NOTIFICATION FUNCTIONS
// ============================================================

/**
 * sendTransferSentNotification
 *
 * Emails the SENDER confirming their USDC transfer was sent.
 * Includes full transfer details and a Polygonscan link.
 *
 * @param {string} recipientEmail - The sender's email address
 * @param {object} params
 * @param {string} params.senderAddress   - Sender wallet address
 * @param {string} params.recipientAddress - Recipient wallet address
 * @param {string} params.amount          - Raw USDC amount string
 * @param {string} params.fee             - Raw fee amount string
 * @param {string} params.txHash          - Transaction hash
 * @param {string} [params.network]       - "polygon" | "amoy"
 * @returns {Promise<void>}
 */
const sendTransferSentNotification = async (
  recipientEmail,
  { senderAddress, recipientAddress, amount, fee, txHash, network = "polygon" }
) => {

  // ── Skip if SendGrid not configured ──────────────────────
  if (!process.env.SENDGRID_API_KEY) {
    console.log("📭  Notification skipped: no SendGrid key");
    return;
  }

  if (!recipientEmail) {
    console.log("📭  sendTransferSentNotification: no email address provided, skipping");
    return;
  }

  try {
    const polygonscanUrl = getPolygonscanUrl(txHash, network);
    const sentAt         = new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const htmlContent = buildEmailTemplate(`
      <!-- Icon + Title -->
      <div style="text-align: center; margin-bottom: 28px;">
        <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
        <h1 style="${STYLES.h1}">Transfer Sent!</h1>
        <p style="${STYLES.subtitle}">
          Your USDC has been sent successfully on the Polygon network.
        </p>
      </div>

      <!-- Amount highlight -->
      <div style="text-align: center; margin-bottom: 28px;">
        <div style="${STYLES.amountBig}">
          ${formatUSDC(amount)}
        </div>
        <div style="font-size: 13px; color: #6b7280;">
          Total sent (including fee)
        </div>
      </div>

      <!-- Transfer details table -->
      <table style="${STYLES.table}">
        <tr>
          <td style="${STYLES.tableLabel}">To</td>
          <td style="${STYLES.tableValue}">${shortenAddress(recipientAddress)}</td>
        </tr>
        <tr>
          <td style="${STYLES.tableLabel}">Amount</td>
          <td style="${STYLES.tableValue}; color: #a78bfa; font-weight: 700;">
            ${formatUSDC(amount)}
          </td>
        </tr>
        <tr>
          <td style="${STYLES.tableLabel}">Fee</td>
          <td style="${STYLES.tableValue}">${formatUSDC(fee)}</td>
        </tr>
        <tr>
          <td style="${STYLES.tableLabel}">From</td>
          <td style="${STYLES.tableValue}">${shortenAddress(senderAddress)}</td>
        </tr>
        <tr>
          <td style="${STYLES.tableLabel}">Network</td>
          <td style="${STYLES.tableValue}; color: #10b981;">Polygon ✓</td>
        </tr>
        <tr>
          <td style="${STYLES.tableLabel}">Tx Hash</td>
          <td style="${STYLES.tableValue}">
            <a href="${polygonscanUrl}" style="color: #7c3aed; text-decoration: none;">
              ${shortenAddress(txHash)}
            </a>
          </td>
        </tr>
        <tr>
          <td style="${STYLES.tableLabel}; border-bottom: none;">Sent At</td>
          <td style="${STYLES.tableValue}; border-bottom: none;">${sentAt}</td>
        </tr>
      </table>

      <!-- CTA Button -->
      <div style="text-align: center; margin-top: 8px;">
        <a href="${polygonscanUrl}" style="${STYLES.button}">
          View on Polygonscan ↗
        </a>
      </div>
    `);

    const message = buildEmail(
      recipientEmail,
      "✅ You sent USDC via RemitFlow",
      htmlContent
    );

    await sgMail.send(message);
    console.log(`📨  Notification sent to: ${recipientEmail} (transfer sent)`);

  } catch (error) {
    // Never throw — just log. A failed email must not crash the API.
    console.error(
      `❌  sendTransferSentNotification failed for ${recipientEmail}:`,
      error.response?.body?.errors ?? error.message
    );
  }
};


/**
 * sendTransferReceivedNotification
 *
 * Emails the RECIPIENT telling them they received USDC.
 * Simpler than the sent notification — just the key facts.
 *
 * @param {string} recipientEmail - The recipient's email address
 * @param {object} params
 * @param {string} params.senderAddress - Who sent the USDC
 * @param {string} params.amount        - Raw USDC amount string
 * @param {string} params.txHash        - Transaction hash
 * @param {string} [params.network]     - "polygon" | "amoy"
 * @returns {Promise<void>}
 */
const sendTransferReceivedNotification = async (
  recipientEmail,
  { senderAddress, amount, txHash, network = "polygon" }
) => {

  // ── Skip if SendGrid not configured ──────────────────────
  if (!process.env.SENDGRID_API_KEY) {
    console.log("📭  Notification skipped: no SendGrid key");
    return;
  }

  if (!recipientEmail) {
    console.log("📭  sendTransferReceivedNotification: no email address provided, skipping");
    return;
  }

  try {
    const polygonscanUrl = getPolygonscanUrl(txHash, network);
    const receivedAt     = new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const htmlContent = buildEmailTemplate(`
      <!-- Icon + Title -->
      <div style="text-align: center; margin-bottom: 28px;">
        <div style="font-size: 48px; margin-bottom: 12px;">💸</div>
        <h1 style="${STYLES.h1}">You received USDC!</h1>
        <p style="${STYLES.subtitle}">
          Someone just sent you USDC on the Polygon network.
          It&apos;s already in your wallet.
        </p>
      </div>

      <!-- Amount highlight -->
      <div style="
        text-align: center;
        background: linear-gradient(135deg, #064e3b, #065f46);
        border: 1px solid #10b981;
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 28px;
      ">
        <div style="font-size: 13px; color: #6ee7b7; margin-bottom: 8px; font-weight: 600;">
          AMOUNT RECEIVED
        </div>
        <div style="font-size: 36px; font-weight: 800; color: #34d399;">
          +${formatUSDC(amount)}
        </div>
      </div>

      <!-- Details table -->
      <table style="${STYLES.table}">
        <tr>
          <td style="${STYLES.tableLabel}">From</td>
          <td style="${STYLES.tableValue}">${shortenAddress(senderAddress)}</td>
        </tr>
        <tr>
          <td style="${STYLES.tableLabel}">Amount</td>
          <td style="${STYLES.tableValue}; color: #34d399; font-weight: 700;">
            ${formatUSDC(amount)}
          </td>
        </tr>
        <tr>
          <td style="${STYLES.tableLabel}">Network</td>
          <td style="${STYLES.tableValue}; color: #10b981;">Polygon ✓</td>
        </tr>
        <tr>
          <td style="${STYLES.tableLabel}">Tx Hash</td>
          <td style="${STYLES.tableValue}">
            <a href="${polygonscanUrl}" style="color: #7c3aed; text-decoration: none;">
              ${shortenAddress(txHash)}
            </a>
          </td>
        </tr>
        <tr>
          <td style="${STYLES.tableLabel}; border-bottom: none;">Received At</td>
          <td style="${STYLES.tableValue}; border-bottom: none;">${receivedAt}</td>
        </tr>
      </table>

      <!-- Info note -->
      <div style="
        background-color: #1e1b4b;
        border: 1px solid #4338ca;
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 24px;
      ">
        <p style="margin: 0; font-size: 13px; color: #a5b4fc; line-height: 1.6;">
          💡 <strong>Your USDC is already in your wallet.</strong>
          Open MetaMask and switch to the Polygon network to see your balance.
          You can send it, save it, or earn 5% APY yield on RemitFlow.
        </p>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center;">
        <a href="${polygonscanUrl}" style="${STYLES.button}">
          View on Polygonscan ↗
        </a>
      </div>
    `);

    const message = buildEmail(
      recipientEmail,
      "💸 You received USDC via RemitFlow",
      htmlContent
    );

    await sgMail.send(message);
    console.log(`📨  Notification sent to: ${recipientEmail} (transfer received)`);

  } catch (error) {
    console.error(
      `❌  sendTransferReceivedNotification failed for ${recipientEmail}:`,
      error.response?.body?.errors ?? error.message
    );
  }
};


// ============================================================
// 📤  EXPORTS
// ============================================================
module.exports = {
  sendTransferSentNotification,
  sendTransferReceivedNotification,
  // Export helpers for use in other files if needed
  shortenAddress,
  formatUSDC,
};