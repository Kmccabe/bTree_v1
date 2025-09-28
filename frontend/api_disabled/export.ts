/// <reference types="node" />
import type { VercelRequest, VercelResponse } from "@vercel/node";

// cspell:ignore btoi appid txid algod

const INDEXER_URL =
  process.env.TESTNET_INDEXER_URL || "https://testnet-idx.algonode.cloud";
const INDEXER_TOKEN = process.env.TESTNET_INDEXER_TOKEN || "";

const b64utf8 = (b64?: string) =>
  b64 ? Buffer.from(b64, "base64").toString("utf8") : "";
const b64hex = (b64?: string) =>
  b64 ? Buffer.from(b64, "base64").toString("hex") : "";

// Decode big-endian bytes (any length) to number; used for set_phase arg (Itob 8 bytes)
function btoi8BEFromB64(b64: string): number {
  const buf = Buffer.from(b64, "base64");
  let n = 0n;
  for (const byte of buf) n = (n << 8n) | BigInt(byte);
  return Number(n);
}

function csvEscape(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const appId = String(req.query.appId || "");
    if (!appId) return res.status(400).json({ error: "Missing appId" });

    const minRound = req.query.minRound ? Number(req.query.minRound) : undefined;
    const maxRound = req.query.maxRound ? Number(req.query.maxRound) : undefined;

    const base = INDEXER_URL.replace(/\/$/, "");
    const headers: Record<string, string> = {};
    if (INDEXER_TOKEN) headers["X-API-Key"] = INDEXER_TOKEN;

    const rows: string[] = [];
    rows.push(["round", "round_time", "txid", "sender", "event", "details_json"].join(","));

    let next: string | undefined;
    do {
      const qp = new URLSearchParams();
      qp.set("application-id", appId);
      qp.set("tx-type", "appl");
      qp.set("limit", "1000");
      if (minRound) qp.set("min-round", String(minRound));
      if (maxRound) qp.set("max-round", String(maxRound));
      if (next) qp.set("next", next);

      const r = await fetch(`${base}/v2/transactions?${qp.toString()}`, { headers });
      if (!r.ok) throw new Error(`indexer ${r.status}: ${await r.text()}`);
      const data = (await r.json()) as any;
      const txs: any[] = data.transactions || [];

      for (const tx of txs) {
        const round = String(tx["confirmed-round"] ?? "");
        const rt = String(tx["round-time"] ?? "");
        const txid = tx["id"] ?? "";
        const sender = tx["sender"] ?? "";
        const appl = tx["application-transaction"] || {};
        const args: string[] = appl["application-args"] || [];

        let event = "";
        const details: Record<string, any> = {};

        if (args.length > 0) {
          const a0 = b64utf8(args[0]);
          event = a0;
          if (a0 === "set_phase" && args[1]) {
            details.new_phase = btoi8BEFromB64(args[1]);
          } else if (a0 === "commit" && args[1]) {
            details.commit_hex = b64hex(args[1]);
          } else if (a0 === "reveal") {
            if (args[1]) details.choice_utf8 = b64utf8(args[1]);
            if (args[2]) details.salt_utf8 = b64utf8(args[2]);
          }
        }
        if (!event && Array.isArray(tx.logs) && tx.logs.length > 0) {
          const maybe = b64utf8(tx.logs[0]);
          if (maybe) event = maybe;
        }

        rows.push([
          round,
          rt,
          txid,
          sender,
          event,
          csvEscape(JSON.stringify(details)),
        ].join(","));
      }

      next = data["next-token"];
    } while (next);

    const csv = rows.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=btree_export_app_${appId}.csv`
    );
    res.status(200).send(csv);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
}
