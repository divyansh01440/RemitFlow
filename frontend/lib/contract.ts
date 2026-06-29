export const REMITFLOW_ABI = [
  { name: "sendRemittance", type: "function", stateMutability: "nonpayable", inputs: [{ name: "recipient", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "transferId", type: "bytes32" }] },
  { name: "calculateFee", type: "function", stateMutability: "view", inputs: [{ name: "amount", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "depositYield", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { name: "withdrawYield", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { name: "calculateYield", type: "function", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "getUserBalance", type: "function", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "getTransferStatus", type: "function", stateMutability: "view", inputs: [{ name: "transferId", type: "bytes32" }], outputs: [{ name: "", type: "uint8" }] },
  { name: "feePercent", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "yieldTimestamp", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "RemittanceSent", type: "event", inputs: [{ name: "sender", type: "address", indexed: true }, { name: "recipient", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }, { name: "fee", type: "uint256", indexed: false }, { name: "transferId", type: "bytes32", indexed: false }] },
  { name: "RemittanceReceived", type: "event", inputs: [{ name: "recipient", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }, { name: "transferId", type: "bytes32", indexed: false }] },
  { name: "YieldDeposited", type: "event", inputs: [{ name: "user", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }] },
  { name: "YieldWithdrawn", type: "event", inputs: [{ name: "user", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }, { name: "yieldEarned", type: "uint256", indexed: false }] },
] as const;

export const USDC_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

export const SUPPORTED_CHAINS = [137, 80002, 31337] as const;
export type SupportedChainId = typeof SUPPORTED_CHAINS[number];

export const CONTRACT_ADDRESSES: Record<number, string> = {
  137:   process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "",
  80002: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "",
  31337: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "",
};

export const USDC_ADDRESSES: Record<number, string> = {
  137:   "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  80002: process.env.NEXT_PUBLIC_USDC_ADDRESS || "",
  31337: process.env.NEXT_PUBLIC_USDC_ADDRESS || "",
};

export function getContractAddress(chainId: number): string {
  const address = CONTRACT_ADDRESSES[chainId];
  if (!address) throw new Error(`RemitFlow: No contract address for chain ${chainId}. Set NEXT_PUBLIC_CONTRACT_ADDRESS in .env`);
  return address;
}

export function getUSDCAddress(chainId: number): string {
  const address = USDC_ADDRESSES[chainId];
  if (!address) throw new Error(`RemitFlow: No USDC address for chain ${chainId}. Set NEXT_PUBLIC_USDC_ADDRESS in .env`);
  return address;
}

export function isSupportedChain(chainId: number | undefined): boolean {
  if (!chainId) return false;
  return (SUPPORTED_CHAINS as readonly number[]).includes(chainId);
}
