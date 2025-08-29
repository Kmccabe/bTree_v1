/// <reference types="node" />
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { algodHeaders, algodUrl } from "./_algod";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const txid = (req.query.txid as string) || "";
    if (!txid) return res.status(400).json({ error: "missing txid" });
    const r = await fetch(algodUrl("/v2/transactions/pending/" + txid), {
      headers: algodHeaders(),
    });
    const j = await r.json();
    return res.status(200).json(j);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "pending failed" });
  }
}
