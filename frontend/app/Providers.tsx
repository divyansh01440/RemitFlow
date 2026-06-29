"use client";

import { WagmiProvider }        from "wagmi";
import { QueryClientProvider }  from "@tanstack/react-query";
import { config, queryClient }  from "../lib/wagmi";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}