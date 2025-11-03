import { useEffect } from "react";
import { useWallet } from "@txnlab/use-wallet";

export default function AutoHydrateWallet(): null {
  const wallet = useWallet();

  useEffect(() => {
    try {
      void (wallet as any)?.reconnectProviders?.();
      void (wallet as any)?.connectFromStorage?.();
    } catch {
      // no-op: hydration attempts are best-effort
    }
  }, [wallet]);

  return null;
}
