import { createConfig, http }   from "wagmi";
import { polygon, polygonAmoy } from "viem/chains";
import { injected }             from "wagmi/connectors";
import { QueryClient }          from "@tanstack/react-query";
import { defineChain }          from "viem";

export const hardhatLocal = defineChain({
  id:   31337,
  name: "Hardhat Local",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY || "";

const POLYGON_RPC = ALCHEMY_KEY
  ? "https://polygon-mainnet.g.alchemy.com/v2/" + ALCHEMY_KEY
  : "https://polygon-rpc.com";

const POLYGON_AMOY_RPC = ALCHEMY_KEY
  ? "https://polygon-amoy.g.alchemy.com/v2/" + ALCHEMY_KEY
  : "https://rpc-amoy.polygon.technology";

export const config = createConfig({
  chains: [hardhatLocal, polygon, polygonAmoy],
  transports: {
    [hardhatLocal.id]: http("http://127.0.0.1:8545"),
    [polygon.id]:      http(POLYGON_RPC),
    [polygonAmoy.id]:  http(POLYGON_AMOY_RPC),
  },
  connectors: [
    injected({ shimDisconnect: true }),
  ],
  ssr: true,
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            4_000,
      gcTime:               5 * 60 * 1_000,
      retry:                2,
      refetchOnWindowFocus: true,
    },
  },
});

export type Config = typeof config;