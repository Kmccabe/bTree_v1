import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useWallet } from "@txnlab/use-wallet";

function shortAddress(address?: string | null): string {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatNetworkLabel(value?: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes("mainnet")) return "MainNet";
  if (normalized.includes("testnet")) return "TestNet";
  if (normalized.includes("betanet")) return "BetaNet";
  if (normalized.includes("sandbox")) return "Sandbox";
  if (normalized.includes("local")) return "LocalNet";
  return value;
}

type ConnectionPhase = "connected" | "connecting" | "disconnected";

export default function HeaderStatus(): JSX.Element {
  const wallet = useWallet();
  const {
    activeAddress,
    activeAccount,
    connectedAccounts,
    providers,
    clients,
  } = wallet;

  const activeProvider = useMemo(() => {
    return providers?.find((provider) => provider.isActive) ?? providers?.[0];
  }, [providers]);

  const providerId = activeProvider?.metadata?.id;
  const providerName = activeProvider?.metadata?.name ?? "Wallet";

  const networkLabel = useMemo(() => {
    const providerNetwork = (
      activeProvider as unknown as { network?: string } | undefined
    )?.network;

    const providerClient =
      providerId && clients ? (clients[providerId] as unknown) : undefined;

    const clientNetwork =
      (providerClient as { network?: string } | undefined)?.network ??
      (providerClient as { genesisID?: string } | undefined)?.genesisID ??
      (providerClient as { genesisId?: string } | undefined)?.genesisId ??
      (providerClient as { genesisHash?: string } | undefined)?.genesisHash;

    const envFallback =
      (import.meta as any)?.env?.VITE_NETWORK as string | undefined;

    const inferred =
      providerNetwork ??
      (typeof clientNetwork === "string" ? clientNetwork : undefined) ??
      envFallback;

    return formatNetworkLabel(inferred);
  }, [activeProvider, clients, providerId]);

  const address = useMemo(() => {
    const addr =
      activeAccount?.address ||
      activeAddress ||
      (connectedAccounts.length > 0 ? connectedAccounts[0].address : null);
    return addr ?? null;
  }, [activeAccount, activeAddress, connectedAccounts]);

  const isConnected = Boolean(address);
  const isConnectingFlag = Boolean(
    (wallet as any)?.isConnecting || (wallet as any)?.status === "CONNECTING"
  );

  const [showConnecting, setShowConnecting] = useState(isConnectingFlag);

  useEffect(() => {
    if (isConnectingFlag && address) {
      const timeout = window.setTimeout(() => setShowConnecting(false), 50);
      return () => window.clearTimeout(timeout);
    }
    setShowConnecting(isConnectingFlag);
    return undefined;
  }, [address, isConnectingFlag]);

  const phase: ConnectionPhase = useMemo(() => {
    if (isConnected) return "connected";
    return showConnecting ? "connecting" : "disconnected";
  }, [isConnected, showConnecting]);

  const pillStyles = useMemo<CSSProperties>(() => {
    const base: CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      gap: "0.35rem",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      padding: "0 0.75rem",
      height: 32,
      border: "1px solid transparent",
      transition: "background-color 120ms ease, color 120ms ease",
      whiteSpace: "nowrap",
    };
    if (phase === "connecting") {
      return {
        ...base,
        color: "#92400E",
        backgroundColor: "#FEF3C7",
        borderColor: "#FDE68A",
      };
    }
    if (phase === "connected") {
      return {
        ...base,
        color: "#166534",
        backgroundColor: "#DCFCE7",
        borderColor: "#86EFAC",
      };
    }
    return {
      ...base,
      color: "#4B5563",
      backgroundColor: "#F3F4F6",
      borderColor: "#E5E7EB",
    };
  }, [phase]);

  const badgeStyles = useMemo<CSSProperties>(
    () => ({
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      padding: "0 0.6rem",
      height: 28,
      backgroundColor: "#111827",
      color: "#F9FAFB",
      whiteSpace: "nowrap",
    }),
    []
  );

  const disconnectButtonStyles = useMemo<CSSProperties>(
    () => ({
      border: "1px solid #D1D5DB",
      backgroundColor: "#FFFFFF",
      borderRadius: 8,
      padding: "0.4rem 0.75rem",
      fontSize: 12,
      fontWeight: 600,
      color: "#111827",
      cursor: "pointer",
    }),
    []
  );

  const handleDisconnect = useCallback(async () => {
    const target = activeProvider ?? providers?.[0];
    try {
      await target?.disconnect?.();
    } catch (err) {
      console.warn("disconnect failed", err);
    }
  }, [activeProvider, providers]);

  const pillLabel = useMemo(() => {
    if (phase === "connecting") return "Connecting...";
    if (phase === "connected") {
      return `Connected \u2022 ${providerName}${
        networkLabel ? ` \u2022 ${networkLabel}` : ""
      }`;
    }
    return "Not connected";
  }, [networkLabel, phase, providerName]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        justifyContent: "flex-end",
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <span aria-live="polite" style={pillStyles}>
          {pillLabel}
        </span>
        {address && (
          <span
            style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}
            title={address}
          >
            {shortAddress(address)}
          </span>
        )}
        {networkLabel && (
          <span style={badgeStyles} title={`Algorand ${networkLabel}`}>
            {networkLabel}
          </span>
        )}
      </div>
      {phase === "connected" && (
        <button
          type="button"
          onClick={() => {
            void handleDisconnect();
          }}
          style={disconnectButtonStyles}
        >
          Disconnect
        </button>
      )}
    </div>
  );
}
