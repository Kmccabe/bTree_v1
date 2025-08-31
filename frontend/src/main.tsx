
import "./polyfills";
import { createRoot } from "react-dom/client";
import App from "./App";
import { WalletProvider } from "@txnlab/use-wallet-react";
import { PeraWalletConnect } from "@perawallet/connect";

const root = createRoot(document.getElementById("root")!);

// Configure wallet connectors for use-wallet-react (Pera only for now)
const providers = [
  { id: "pera", provider: new PeraWalletConnect() },
];

// Map Vite env to use-wallet network id
const envNetwork = (import.meta.env.VITE_NETWORK as string | undefined) || "TESTNET";
const network = envNetwork.toLowerCase() === "mainnet" ? "mainnet" : "testnet";

root.render(
  <WalletProvider providers={providers} network={network}>
    <App />
  </WalletProvider>
);

