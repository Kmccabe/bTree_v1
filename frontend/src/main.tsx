
import "./polyfills";
import { createRoot } from "react-dom/client";
import App from "./App";
import { WalletProvider, useInitializeProviders, PROVIDER_ID, reconnectProviders } from "@txnlab/use-wallet";
import * as algosdk from "algosdk";
import React from "react";
import { PeraWalletConnect } from "@perawallet/connect";

const root = createRoot(document.getElementById("root")!);

// Map Vite env to use-wallet network id
const envNetwork = (import.meta.env.VITE_NETWORK as string | undefined) || "TESTNET";
const network = envNetwork.toLowerCase() === "mainnet" ? "mainnet" : "testnet";

function Root() {
  const isMainnet = network === "mainnet";
  const providers = useInitializeProviders({
    providers: [
      {
        id: PROVIDER_ID.PERA,
        clientStatic: PeraWalletConnect,
        clientOptions: {
          // Ensure Pera uses the same chain as the dApp
          chainId: isMainnet ? 4160 : 416001,
        },
      },
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
  React.useEffect(() => {
    if (providers) {
      reconnectProviders(providers).catch(() => {});
    }
  }, [providers]);
  return (
    <WalletProvider value={providers}>
      <App />
    </WalletProvider>
  );
}

root.render(<Root />);

