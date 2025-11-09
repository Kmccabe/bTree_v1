import "./polyfills";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { WalletProvider, useInitializeProviders, PROVIDER_ID } from "@txnlab/use-wallet";
import { PeraWalletConnect } from "@perawallet/connect";
import { router } from "./router";
import "./index.css";
import { ToastProvider } from "@/components/Toaster";

// ← ADDED

const networkEnv = (import.meta.env.VITE_NETWORK as string | undefined)?.toUpperCase() ?? "TESTNET";
const providerNetwork = networkEnv === "MAINNET" ? "MainNet" : "TestNet";
const nodeServer = providerNetwork === "MainNet"
  ? "https://mainnet-api.algonode.cloud"
  : "https://testnet-api.algonode.cloud";

function WalletApp(): JSX.Element {
  const providers = useInitializeProviders({
    providers: [
      { id: PROVIDER_ID.PERA, clientStatic: PeraWalletConnect },
    ],
    nodeConfig: {
      network: providerNetwork,
      nodeServer,
      nodePort: 443,
      nodeToken: "",
    },
  });

  return (
    <WalletProvider value={providers}>
      <RouterProvider router={router} />
    </WalletProvider>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error('Missing <div id="root"> in index.html');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ToastProvider>        {/* ← ADDED */}
      <WalletApp />
    </ToastProvider>       {/* ← ADDED */}
  </React.StrictMode>
);
