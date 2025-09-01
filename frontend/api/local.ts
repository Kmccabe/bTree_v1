import type { VercelRequest, VercelResponse } from "@vercel/node";
import { algodHeaders, algodUrl } from "./_algod.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const addr = typeof req.query.addr === "string" ? req.query.addr.trim() : "";
    const id = Number(req.query.id);
    if (!addr) return res.status(400).json({ error: "addr required" });
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "id required" });

    const r = await fetch(algodUrl(`/v2/accounts/${addr}`), { headers: algodHeaders() });
    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: text || r.statusText });

    let j: any;
    try { j = JSON.parse(text); } catch { return res.status(502).json({ error: "algod returned non-JSON response" }); }

    const st = (j?.["apps-local-state"] || []).find((x: any) => Number(x?.id) === id);
    const map: Record<string, any> = {};
    for (const kv of st?.["key-value"] || []) {
      const keyB64 = kv?.key || "";
      const key = Buffer.from(String(keyB64), "base64").toString("utf8");
      // Algod: type 1 = bytes, type 2 = uint
      if (kv?.value?.type === 2) map[key] = Number(kv.value.uint);
    }
    return res.status(200).json({ id, address: addr, local: map });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "server error" });
  }
}

