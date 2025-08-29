
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { algodHeaders, algodUrl } from "./_algod";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const r = await fetch(algodUrl("/v2/transactions/params"), {
      headers: algodHeaders(),
    });
    const j = await r.json();
    return res.status(200).json(j);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "params failed" });
  }
}
