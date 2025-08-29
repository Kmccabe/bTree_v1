/// <reference types="node" />
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { algodHeaders, algodUrl } from "./_algod";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).send("POST only");
    const { source } = req.body || {};
    if (!source) return res.status(400).json({ error: "missing 'source' (TEAL)" });

    const headers = algodHeaders();
    headers["Content-Type"] = "text/plain";

    const r = await fetch(algodUrl("/v2/teal/compile"), {
      method: "POST",
      headers,
      body: source,
    });
    const j = await r.json();
    return res.status(r.ok ? 200 : 400).json(j);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "compile failed" });
  }
}
