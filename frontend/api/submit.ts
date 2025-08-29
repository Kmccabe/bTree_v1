
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { algodHeaders, algodUrl } from "./_algod";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).send("POST only");
    const { signedTxnBase64 } = req.body || {};
    if (!signedTxnBase64) return res.status(400).json({ error: "missing 'signedTxnBase64'" });

    const headers = algodHeaders();
    headers["Content-Type"] = "application/x-binary";

    const raw = Buffer.from(signedTxnBase64, "base64");
    const r = await fetch(algodUrl("/v2/transactions"), {
      method: "POST",
      headers,
      body: raw,
    });
    const j = await r.json();
    return res.status(r.ok ? 200 : 400).json(j);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "submit failed" });
  }
}
