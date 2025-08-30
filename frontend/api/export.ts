// frontend/api/export.ts
// GET /api/export?appId=12345[&minRound=][&maxRound=]
import type { VercelRequest, VercelResponse } from "@vercel/node";

function envIndexUrl() {
  return process.env.TESTNET_INDEXER_URL || "https://testnet-idx.algonode.cloud";
}
function envIndexToken() {
  return process.env.TESTNET_INDEXER_TOKEN || ""; // usually empty for Algonode
}

function decodeBase64ToString(b64: string): string {
  try {
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return "";
  }
}
function decodeB64ToHex(b64: string): string {
  try {
    return Buffer.from(b64, "base64").toString("hex");
  } catch {
    return "";
  }
}
function btoiBE(b: Buffer): number {
  // Btoi uses 8-byte big-endian; handle any length
  const buf = b.length === 8 ? b : Buffer.concat([Buffer.alloc(8 - b.length, 0), b]);
  return buf.readBigUInt64BE(0) as unknown as number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const appId = req.query.appId as string;
    if (!appId) {
      res.status(400).json({ error: "Missing appId" });
      return;
    }
    const minRound = req.query.minRound ? Number(req.query.minRound) : undefined;
    const maxRound = req.query.maxRound ? Number(req.query.maxRound) : undefined;

    const base = envIndexUrl().replace(/\/$/, "");
    const headers: Record<string, string> = {};
    const token = envIndexToken();
    if (token) headers["X-API-Key"] = token;

    const rows: string[] = [];
    rows.push(["round","round_time","txid","sender","event","details_json"].join(","));

    let next: string | undefined = undefined;
    do {
      const params = new URLSearchParams();
      params.set("application-id", appId);
      params.set("tx-type", "appl");
      params.set("limit", "1000");
      if (next) params.set("next", next);
      if (minRound) params.set("min-round", String(minRound));
      if (maxRound) params.set("max-round", String(maxRound));

      const url = `${base}/v2/transactions?${params.toString()}`;
      const r = await fetch(url, { headers });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`indexer ${r.status}: ${text}`);
      }
      const data = await r.json();
      const txs = (data.transactions || []) as any[];

      for (const tx of txs) {
        const round = tx["confirmed-round"] ?? "";
        const rt = tx["round-time"] ?? "";
        const txid = tx["id"] ?? "";
        const sender = tx["sender"] ?? "";
        const app = tx["application-transaction"] || {};
        const args: string[] = app["application-args"] || [];

        // derive event & details from args/logs
        let event = "";
        const details: Record<string, any> = {};
        if (args.length > 0) {
          const a0 = decodeBase64ToString(args[0]);
          event = a0;
          if (a0 === "set_phase" && args[1]) {
            const phase = btoiBE(Buffer.from(args[1], "base64"));
            details.new_phase = phase;
          } else if (a0 === "commit" && args[1]) {
            details.commit_hex = decodeB64ToHex(args[1]);
          } else if (a0 === "reveal") {
            if (args[1]) details.choice_utf8 = decodeBase64ToString(args[1]);
            if (args[2]) details.salt_utf8 = decodeBase64ToString(args[2]);
          }
        }
        if (!event && Array.isArray(tx.logs) && tx.logs.length > 0) {
          const maybe = decodeBase64ToString(tx.logs[0]);
          if (maybe) event = maybe;
        }
        const djson = JSON.stringify(details).replaceAll('"', '""'); // CSV-escape quotes
        const line = [
          round,
          rt,
          txid,
          sender,
          event || "",
          `"${djson}"`
        ].join(",");
        rows.push(line);
      }

      next = data["next-token"];
    } while (next);

    const csv = rows.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=btree_export_app_${appId}.csv`);
    res.status(200).send(csv);
  } catch (e: any) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
