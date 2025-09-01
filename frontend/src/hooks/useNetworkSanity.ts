// frontend/src/hooks/useNetworkSanity.ts
import { useEffect, useMemo, useState, useCallback } from "react";

export type Net = "mainnet" | "testnet" | "betanet" | "unknown";

function mapGenesisToNet(genesisID?: string, _genesisHash?: string): Net {
  const id = (genesisID || "").toLowerCase();
  if (id.includes("mainnet")) return "mainnet";
  if (id.includes("testnet")) return "testnet";
  if (id.includes("betanet")) return "betanet";
  return "unknown";
}

function normalizeExpectedNet(): Net {
  const v = ((import.meta as any).env?.VITE_NETWORK || "testnet").toLowerCase();
  if (v === "mainnet" || v === "testnet" || v === "betanet") return v as Net;
  return "unknown";
}

export function useNetworkSanity() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendNet, setBackendNet] = useState<Net>("unknown");
  const [genesisID, setGenesisID] = useState<string | undefined>(undefined);
  const [genesisHash, setGenesisHash] = useState<string | undefined>(undefined);

  const expectedNet = useMemo<Net>(() => normalizeExpectedNet(), []);
  const match = useMemo(
    () => !loading && !error && backendNet !== "unknown" && expectedNet === backendNet,
    [loading, error, backendNet, expectedNet]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/params");
      if (!res.ok) throw new Error(`params: HTTP ${res.status}`);
      const j = await res.json();
      const p: any = j?.params ?? j?.suggestedParams ?? j;
      const id: string | undefined = p?.genesisID ?? p?.["genesis-id"];
      const hash: string | undefined = p?.genesisHash ?? p?.["genesis-hash"];
      setGenesisID(id);
      setGenesisHash(hash);
      setBackendNet(mapGenesisToNet(id, hash));
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setBackendNet("unknown");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    loading,
    error,
    backendNet,
    expectedNet,
    match,
    genesisID,
    genesisHash,
    refresh,
  } as const;
}

