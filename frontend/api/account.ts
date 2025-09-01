import type { VercelRequest, VercelResponse } from "@vercel/node";
import { algodHeaders, algodUrl } from "./_algod";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const addr = (req.query.addr as string) || "";
    if (!addr) return res.status(400).json({ error: "addr required" });
    const r = await fetch(algodUrl(`/v2/accounts/${addr}`), { headers: algodHeaders() });
    const text = await r.text();
    if (!r.ok) return res.status(r.status).send(text || r.statusText);
    const j = JSON.parse(text);
    res.status(200).json({
      address: j?.address,
      amount: j?.amount,
      "min-balance": j?.["min-balance"],
      "apps-local-state": j?.["apps-local-state"]?.length ?? 0,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "server error" });
  }
}

