// frontend/src/components/WalletStatus.tsx
import React, { useEffect, useState } from "react";
import { fetchAccount, hasSpendableForOptIn } from "../chain/account";

export default function WalletStatus({ address }: { address?: string | null }) {
  const [state, setState] = useState<{ spendable?: number; ok?: boolean; err?: string }>(() => ({}));

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!address) { setState({}); return; }
      try {
        const a = await fetchAccount(address);
        if (!alive) return;
        setState({ spendable: a.spendable, ok: hasSpendableForOptIn(a.spendable) });
      } catch (e: any) {
        if (!alive) return;
        setState({ err: e?.message || String(e) });
      }
    })();
    return () => { alive = false; };
  }, [address]);

  if (!address) return null;
  if (state.err) return <span style={{ fontSize: 12, color: "#b45309" }}>acct: {state.err}</span>;
  if (state.spendable == null) return <span style={{ fontSize: 12, color: "#6b7280" }}>acct…</span>;
  const fmt = new Intl.NumberFormat();
  return (
    <span style={{ fontSize: 12, color: state.ok ? "#16a34a" : "#dc2626" }}>
      spendable: {fmt.format(state.spendable)} microAlgos {state.ok ? "(ok)" : "(low)"}
    </span>
  );
}

