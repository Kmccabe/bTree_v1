
import "./polyfills";
import { createRoot } from "react-dom/client";
import App from "./App";
import { WalletProvider, useInitializeProviders, PROVIDER_ID, reconnectProviders } from "@txnlab/use-wallet";
import * as algosdk from "algosdk";
import React from "react";
import { PeraWalletConnect } from "@perawallet/connect";
import { ToastProvider } from "./components/Toaster";

const root = createRoot(document.getElementById("root")!);

// Map Vite env to use-wallet network id
const envNetwork = (import.meta.env.VITE_NETWORK as string | undefined) || "TESTNET";
const network = envNetwork.toLowerCase() === "mainnet" ? "mainnet" : "testnet";

function Root() {
  const providers = useInitializeProviders({
    providers: [
      { id: PROVIDER_ID.PERA, clientStatic: PeraWalletConnect },
    ],
    algosdkStatic: algosdk,
    nodeConfig: {
      network,
      nodeServer:
        network === "mainnet"
          ? "https://mainnet-api.algonode.cloud"
          : network === "testnet"
          ? "https://testnet-api.algonode.cloud"
          : "https://betanet-api.algonode.cloud",
    },
  });
  const autoReconnect = ((import.meta.env.VITE_WALLET_AUTO_RECONNECT as string | undefined) || "").toLowerCase() === "true";
  React.useEffect(() => {
    if (!autoReconnect || !providers) return;
    reconnectProviders(providers).catch(() => {});
  }, [providers, autoReconnect]);
  // No client-side network toggling; use VITE_NETWORK env instead
  if (!providers) return null;
  return (
    <WalletProvider value={providers}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </WalletProvider>
  );
}

root.render(<Root />);

