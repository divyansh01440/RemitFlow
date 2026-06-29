export function formatUSDC(amount: bigint, decimals: number = 2): string {
  if (amount === 0n) return (0).toFixed(decimals);
  const isNegative = amount < 0n;
  const absAmount = isNegative ? -amount : amount;
  const wholePart = absAmount / 1_000_000n;
  const fractionalRaw = absAmount % 1_000_000n;
  const fractionalStr = fractionalRaw.toString().padStart(6, "0");
  const truncatedFractional = fractionalStr.slice(0, decimals).padEnd(decimals, "0");
  const sign = isNegative ? "-" : "";
  return decimals > 0 ? `${sign}${wholePart}.${truncatedFractional}` : `${sign}${wholePart}`;
}

export function parseUSDC(amount: string): bigint {
  if (!amount || amount.trim() === "") return 0n;
  const trimmed = amount.trim();
  if (trimmed.startsWith("-")) return 0n;
  if (!/^\d*\.?\d*$/.test(trimmed)) return 0n;
  if (trimmed === "" || trimmed === ".") return 0n;
  try {
    const [wholePart = "0", fractionalPart = ""] = trimmed.split(".");
    const paddedFractional = fractionalPart.slice(0, 6).padEnd(6, "0");
    const combined = `${wholePart}${paddedFractional}`;
    const cleaned = combined.replace(/^0+/, "") || "0";
    return BigInt(cleaned);
  } catch { return 0n; }
}

export function shortenAddress(address: string | undefined | null, chars: number = 4): string {
  if (!address) return "";
  if (address.length < 10) return address;
  return `${address.slice(0, 2 + chars)}...${address.slice(-chars)}`;
}

export interface StatusInfo {
  label: string;
  bgColor: string;
  textColor: string;
  dotColor: string;
}

export function getStatusInfo(status: number): StatusInfo {
  switch (status) {
    case 0: return { label: "Pending",   bgColor: "bg-yellow-900", textColor: "text-yellow-300", dotColor: "bg-yellow-400" };
    case 1: return { label: "Completed", bgColor: "bg-green-900",  textColor: "text-green-300",  dotColor: "bg-green-400"  };
    case 2: return { label: "Refunded",  bgColor: "bg-gray-800",   textColor: "text-gray-400",   dotColor: "bg-gray-500"   };
    default: return { label: "Unknown",  bgColor: "bg-gray-800",   textColor: "text-gray-500",   dotColor: "bg-gray-600"   };
  }
}

export function formatDate(timestamp: number | bigint): string {
  const timestampNumber = typeof timestamp === "bigint" ? Number(timestamp) : timestamp;
  const date = new Date(timestampNumber * 1000);
  if (isNaN(date.getTime())) return "Invalid date";
  const datePart = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${datePart} · ${timePart}`;
}

export function calculateEstimatedYield(principal: bigint, timestampSeconds: number): bigint {
  if (principal === 0n || timestampSeconds === 0) return 0n;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const elapsed = nowSeconds - timestampSeconds;
  if (elapsed <= 0) return 0n;
  const APY_RATE = 500n;
  const BASIS_POINTS = 10_000n;
  const SECONDS_PER_YEAR = 31_536_000n;
  const elapsedBigInt = BigInt(elapsed);
  return (principal * APY_RATE * elapsedBigInt) / (BASIS_POINTS * SECONDS_PER_YEAR);
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ").trim();
}

export function isValidAddress(address: string | undefined): boolean {
  if (!address) return false;
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

export function formatUSDCWithSymbol(amount: bigint, decimals: number = 2): string {
  return `$${formatUSDC(amount, decimals)} USDC`;
}
