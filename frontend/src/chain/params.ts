// frontend/src/chain/params.ts
import type algosdk from "algosdk";

/**
 * Fetch /api/params and normalize to the exact shape used in deploy.ts.
 * Keep this logic identical to deploy.ts’s working path.
 */
export async function getParamsNormalized(): Promise<algosdk.SuggestedParams & { minFee?: number; genesisHashBytes?: Uint8Array }> {
  const r = await fetch("/api/params");
  const raw = await r.text();
  if (!r.ok) throw new Error(`[params] HTTP ${r.status}: ${raw}`);
  let j: any;
  try { j = JSON.parse(raw); } catch (e) { throw new Error(`[params] JSON parse error: ${String(e)} raw=${raw}`); }

  // === COPY OF deploy.ts normalization ===
  const p = j?.params ?? j ?? {};
  const minFee = Number(p["min-fee"]) || 1000;
  const firstRound = Number(p["last-round"]) || 0;
  const genesisHashB64 = (p["genesis-hash"] || p["genesishashb64"] || p["genesisHash"]) as string | Uint8Array | undefined;

  // genesisHash: for deploy.ts, a Uint8Array is used (preferred for compatibility)
  const genesisHashBytes = typeof genesisHashB64 === "string"
    ? new Uint8Array(Buffer.from(genesisHashB64, "base64"))
    : (genesisHashB64 as Uint8Array | undefined);

  const suggestedParams: any = {
    fee: minFee,
    minFee: minFee,
    flatFee: true,
    firstValid: firstRound,
    lastValid: firstRound + 1000,
    firstRound,
    lastRound: firstRound + 1000,
    genesisHash: genesisHashBytes,
    genesisID: p["genesis-id"],
  } as unknown as algosdk.SuggestedParams & { minFee?: number };

  // Debug: types + values for easier troubleshooting across SDK variants
  console.info("[params] normalized", {
    fee: suggestedParams.fee,
    firstRound: (suggestedParams as any).firstRound,
    lastRound: (suggestedParams as any).lastRound,
    genesisHash_type: suggestedParams.genesisHash instanceof Uint8Array ? "Uint8Array" : typeof (suggestedParams as any).genesisHash,
    genesisHash_len: (suggestedParams as any).genesisHash instanceof Uint8Array ? (suggestedParams as any).genesisHash.length : String((suggestedParams as any).genesisHash || "").length,
    genesisID: (suggestedParams as any).genesisID,
    flatFee: (suggestedParams as any).flatFee,
    minFee: (suggestedParams as any).minFee,
  });

  // Attach mirror to aid debugging when callers log both
  (suggestedParams as any).genesisHashBytes = genesisHashBytes;
  return suggestedParams as algosdk.SuggestedParams & { minFee?: number; genesisHashBytes?: Uint8Array };
}

// Dev-only helper: quickly verify params build a simple Payment (not submitted)
export async function _devParamsSelfTest(sender: string) {
  const sp = await getParamsNormalized();
  try {
    // dynamic import to avoid hard dependency in isolated use
    const { default: algosdk } = await import("algosdk");
    // Cast to any to accommodate SDK v2/v3 typing differences (from/sender)
    (algosdk as any).makePaymentTxnWithSuggestedParamsFromObject({
      from: sender,
      to: sender,
      amount: 0,
      suggestedParams: sp,
    } as any);
    console.info("[_devParamsSelfTest] payment build OK");
  } catch (e) {
    console.error("[_devParamsSelfTest] payment build FAILED", e, sp);
  }
}
