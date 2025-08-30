/// <reference types="node" />
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { algodHeaders, algodUrl } from "./_algod";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).send("POST only");

    // Vercel can give you req.body as object or string
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { signedTxnBase64 } = body;
    if (!signedTxnBase64) return res.status(400).json({ error: "missing 'signedTxnBase64'" });

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
