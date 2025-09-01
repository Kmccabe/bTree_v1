// frontend/src/chain/account.ts
export type AccountInfo = {
  address: string;
  amount: number | null;          // µAlgos
  minBalance: number | null;      // µAlgos
  spendable: number;              // µAlgos (>=0)
  appsLocalState: number;
};

export async function fetchAccount(addr: string): Promise<AccountInfo> {
  if (!addr) throw new Error("address required");
  const r = await fetch(`/api/account?addr=${encodeURIComponent(addr)}`);
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
  const amount = Number(j?.amount ?? 0);
  const minb   = Number(j?.["min-balance"] ?? 0);
  const spendable = Math.max(0, amount - minb);
  return {
    address: j?.address ?? addr,
    amount,
    minBalance: minb,
    spendable,
    appsLocalState: Number(j?.["apps-local-state"] ?? 0),
  };
}

/** Default gate for opt-in: needs ~100_000 min-balance + some fee headroom. */
export function hasSpendableForOptIn(spendable: number, threshold = 200_000): boolean {
  return spendable >= threshold;
}

