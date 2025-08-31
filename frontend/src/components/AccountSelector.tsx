import React from "react";
import { useWallet, PROVIDER_ID } from "@txnlab/use-wallet";

export default function AccountSelector() {
  const { providers, activeAddress, activeAccount } = useWallet();
  const pera = providers?.find((p) => p.metadata.id === PROVIDER_ID.PERA);
  const accounts = pera?.accounts || [];
  if (!pera || accounts.length <= 1) return null;

  const current = activeAddress || activeAccount?.address || accounts[0]?.address || "";

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const addr = e.target.value;
    try { pera.setActiveAccount(addr); } catch {}
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <label htmlFor="acctSel" style={{ fontSize: 13, color: "#444" }}>Account:</label>
      <select id="acctSel" value={current} onChange={onChange} style={{ padding: "6px 8px", borderRadius: 6 }}>
        {accounts.map((a) => (
          <option key={a.address} value={a.address}>{a.address}</option>
        ))}
      </select>
    </div>
  );
}

