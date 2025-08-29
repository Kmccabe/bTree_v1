
import React, { useEffect, useState, useCallback } from "react";
import { PeraWalletConnect } from "@perawallet/connect";

const pera = new PeraWalletConnect();

export default function App() {
  const [account, setAccount] = useState<string | null>(null);
  const network = (import.meta.env.VITE_NETWORK as string) ?? "TESTNET";

  // Restore a previous session if present
  useEffect(() => {
    let mounted = true;

    pera
      .reconnectSession()
      .then((accounts) => {
        if (!mounted) return;
        if (accounts && accounts.length > 0) setAccount(accounts[0]);

        // WalletConnect v1-style disconnect listener (types differ across versions)
        const conn: any = (pera as any).connector;
        if (conn?.on) conn.on("disconnect", () => setAccount(null));
      })
      .catch(() => {
        /* no previous session, ignore */
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleConnect = useCallback(async () => {
    try {
      const accounts = await pera.connect();
      if (accounts && accounts.length > 0) setAccount(accounts[0]);
    } catch (err) {
      console.error("Pera connect failed:", err);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    try {
      await pera.disconnect();
    } catch {
      /* ignore */
    } finally {
      setAccount(null);
    }
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, Arial", padding: 24 }}>
      <h1>Trust Game MVP</h1>
      <p>
        <strong>Network:</strong> {network} (Pera supports TestNet; LocalNet is
        SDK/CI only)
      </p>

      {!account ? (
        <button onClick={handleConnect}>Connect Pera Wallet</button>
      ) : (
        <div>
          <p>
            <strong>Connected:</strong> {account}
          </p>
          <button onClick={handleDisconnect}>Disconnect</button>
        </div>
      )}

      <hr />
      <p>Next: deploy contract skeleton and show app-id here.</p>
    </div>
  );
}
