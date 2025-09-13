/// <reference types="node" />
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { algodHeaders, algodUrl } from "./_algod.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Basic CORS / preflight support (useful in some dev setups)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
    if (req.method === "OPTIONS") return res.status(204).end();

    if (req.method !== "POST") return res.status(405).send("POST only");

    // Vercel can give you req.body as object or string
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

    // Accept either a single concatenated blob or an array of signed txns
    let signedTxnBase64: string | undefined = body.signedTxnBase64;
    const stxns: string[] | undefined = Array.isArray(body.stxns) ? body.stxns : undefined;

    if (!signedTxnBase64 && stxns?.length) {
      // Concatenate stxns into one blob
      const parts = stxns.map((b64) => Uint8Array.from(Buffer.from(b64, "base64")));
      const totalLen = parts.reduce((a, p) => a + p.length, 0);
      const combo = new Uint8Array(totalLen);
      let off = 0;
      for (const p of parts) { combo.set(p, off); off += p.length; }
      signedTxnBase64 = Buffer.from(combo).toString("base64");
    }

    if (!signedTxnBase64) return res.status(400).json({ error: "missing 'signedTxnBase64' or 'stxns'" });

    const headers = algodHeaders();
    headers["Content-Type"] = "application/x-binary";
    headers["Accept"] = "application/json";

    // Use Uint8Array to satisfy TS fetch BodyInit types
    const raw = Uint8Array.from(Buffer.from(signedTxnBase64, "base64"));

    const resp = await fetch(algodUrl("/v2/transactions"), {
      method: "POST",
      headers,
      // Node fetch accepts Uint8Array; using 'any' avoids DOM BodyInit typing in Node builds
      body: raw as any,
    });

    const text = await resp.text();
    // algod may return plain text or JSON; normalize to JSON for the client
    let data: any = {};
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return res.status(resp.ok ? 200 : 400).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "submit failed" });
  }
}
