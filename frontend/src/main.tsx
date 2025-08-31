
import "./polyfills";
import { createRoot } from "react-dom/client";
import App from "./App";
import { WalletProvider, useInitializeProviders, PROVIDER_ID } from "@txnlab/use-wallet";
import * as algosdk from "algosdk";
import React from "react";

const root = createRoot(document.getElementById("root")!);

// Map Vite env to use-wallet network id
const envNetwork = (import.meta.env.VITE_NETWORK as string | undefined) || "TESTNET";
const network = envNetwork.toLowerCase() === "mainnet" ? "mainnet" : "testnet";

function Root() {
  const providers = useInitializeProviders({
    providers: [PROVIDER_ID.PERA],
    algosdkStatic: algosdk,
    nodeConfig: { network },
  });
  return (
    <WalletProvider value={providers}>
      <App />
    </WalletProvider>
  );
}

root.render(<Root />);

