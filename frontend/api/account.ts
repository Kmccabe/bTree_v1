import type { VercelRequest, VercelResponse } from "@vercel/node";
import { algodHeaders, algodUrl } from "./_algod";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const addr = typeof req.query.addr === "string" ? req.query.addr.trim() : "";
    if (!addr) {
      return res.status(400).json({ error: "addr required" });
    }

    const url = algodUrl(`/v2/accounts/${addr}`);
    const r = await fetch(url, { headers: algodHeaders() });

    // Always read as text first; some providers return HTML on errors
    const text = await r.text();
    if (!r.ok) {
      return res.status(r.status).json({ error: text || r.statusText });
    }

    let j: any;
    try {
      j = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: "algod returned non-JSON response" });
    }

    return res.status(200).json({
      address: j?.address ?? addr,
      amount: j?.amount ?? null,                    // microalgos
      "min-balance": j?.["min-balance"] ?? null,    // microalgos
      "apps-local-state": Array.isArray(j?.["apps-local-state"])
        ? j["apps-local-state"].length
        : 0,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "server error" });
  }
}

