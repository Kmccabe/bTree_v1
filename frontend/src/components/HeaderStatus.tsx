import { useCallback, useEffect, useMemo, useState } from "react";
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

function classNames(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

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
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span
        aria-live="polite"
        className={classNames(
          "inline-flex h-8 items-center rounded-full px-3 text-xs font-medium",
          phase === "connected" && "bg-green-100 text-green-800",
          phase === "connecting" && "bg-yellow-100 text-yellow-800",
          phase === "disconnected" && "bg-gray-100 text-gray-700"
        )}
      >
        {pillLabel}
      </span>

      {address && (
        <span
          title={address}
          className="inline-flex h-8 max-w-[24ch] items-center overflow-hidden text-ellipsis rounded-full bg-gray-100 px-3 font-mono text-xs text-gray-800"
        >
          {shortAddress(address)}
        </span>
      )}

      {networkLabel && (
        <span className="inline-flex h-7 items-center rounded-full bg-gray-900/90 px-2.5 text-[11px] font-semibold text-white">
          {networkLabel}
        </span>
      )}

      {phase === "connected" && (
        <button
          type="button"
          onClick={() => {
            void handleDisconnect();
          }}
          className="inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium text-gray-800 transition hover:bg-gray-50"
        >
          Disconnect
        </button>
      )}
    </div>
  );
}
