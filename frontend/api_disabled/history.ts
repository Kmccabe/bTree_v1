/// <reference types="node" />
import type { VercelRequest, VercelResponse } from "@vercel/node";

const INDEXER_URL = process.env.TESTNET_INDEXER_URL || "https://testnet-idx.algonode.cloud";
const INDEXER_TOKEN = process.env.TESTNET_INDEXER_TOKEN || "";

function b64utf8(b64?: string) {
  try { return b64 ? Buffer.from(b64, "base64").toString("utf8") : ""; } catch { return ""; }
}

function isPrintableASCII(s: string): boolean {
  // Reject if contains control chars (0x00-0x1F or 0x7F)
  if (!s) return false;
  if (/[\u0000-\u001F\u007F]/.test(s)) return false;
  return true;
}

function decodeEventSafe(b64?: string): string {
  const s = b64utf8(b64 || "").trim();
  if (isPrintableASCII(s) && /^[-_.A-Za-z0-9]{1,32}$/.test(s)) return s;
  return "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const idRaw = (req.query.id as string) || (req.query.appId as string) || "";
    const appId = Number(idRaw);
    if (!Number.isFinite(appId) || appId <= 0) return res.status(400).json({ error: "id (positive integer) required" });
    const limit = req.query.limit ? Math.max(1, Math.min(1000, Number(req.query.limit))) : 100;

    const base = INDEXER_URL.replace(/\/$/, "");
    const headers: Record<string, string> = {};
    if (INDEXER_TOKEN) headers["X-API-Key"] = INDEXER_TOKEN;

    const qp = new URLSearchParams();
    qp.set("application-id", String(appId));
    qp.set("tx-type", "appl");
    qp.set("limit", String(limit));
    const r = await fetch(`${base}/v2/transactions?${qp.toString()}`, { headers });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });
    const data = await r.json() as any;
    const txs: any[] = data?.transactions || [];

    const out = txs.map((tx) => {
      const round = tx["confirmed-round"]; const ts = tx["round-time"]; const txid = tx["id"]; const sender = tx["sender"]; 
      const appl = tx["application-transaction"] || {};
      const args: string[] = appl["application-args"] || [];
      let event = ""; let details: Record<string, any> = {};
      if (args.length > 0) {
        const a0 = decodeEventSafe(args[0]); event = a0;
        if (a0 === "set_phase" && args[1]) details.new_phase = parseInt(Buffer.from(args[1], "base64").toString("hex"), 16);
        if (a0 === "invest" && args[1]) details.s = parseInt(Buffer.from(args[1], "base64").toString("hex"), 16);
        if (a0 === "return" && args[1]) details.r = parseInt(Buffer.from(args[1], "base64").toString("hex"), 16);
      }
      if (!event && Array.isArray(tx.logs) && tx.logs.length > 0) {
        // Attempt to decode a printable ASCII log, else ignore
        const maybe = decodeEventSafe(tx.logs[0]); if (maybe) event = maybe;
      }
      const inner: Array<{ to: string; amount: number }> = [];
      const inners: any[] = tx["inner-txns"] || [];
      for (const itx of inners) {
        if (itx["tx-type"] === "pay") {
          const pay = itx["payment-transaction"] || {};
          const to = pay["receiver"]; const amount = Number(pay["amount"] || 0);
          if (to && Number.isFinite(amount)) inner.push({ to, amount });
        }
      }
      // Default a safer label if we still couldn't find a printable 'event'
      const ev = event || (args.length ? "appl" : (inners.length ? "inner" : "appl"));
      return { round, time: ts, txid, sender, event: ev, details, innerPayments: inner };
    });

    res.status(200).json({ id: appId, count: out.length, txns: out });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "server error" });
  }
}
