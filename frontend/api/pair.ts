import type { VercelRequest, VercelResponse } from "@vercel/node";
import { algodHeaders, algodUrl } from "./_algod.js";

function b64ToUtf8Safe(b64: string): { str?: string; bytesB64: string } {
  try {
    const buf = Buffer.from(b64, "base64");
    const s = buf.toString("utf8");
    // reject if control chars (except tab/newline)
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(s)) return { bytesB64: b64 };
    return { str: s, bytesB64: b64 };
  } catch {
    return { bytesB64: b64 };
  }
}

function decodeGlobalState(gs: any[] | undefined) {
  const map: Record<string, any> = {};
  const rows: Array<{ key: string; type: "uint" | "bytes"; uint?: number; bytesB64?: string; str?: string }> = [];
  for (const kv of gs ?? []) {
    const keyB64 = kv?.key ?? "";
    const key = Buffer.from(String(keyB64), "base64").toString("utf8");
    const val = kv?.value;
    // Algod: type 1 = bytes, type 2 = uint
    if (val?.type === 2) {
      const uint = Number(val?.uint ?? 0);
      rows.push({ key, type: "uint", uint });
      map[key] = uint;
    } else if (val?.type === 1) {
      // Always expose bytes as base64 in the primary map to avoid
      // misinterpreting opaque bytes (like 32-byte addresses) as UTF-8.
      // Include a best-effort UTF-8 preview only in the rows metadata.
      const { str, bytesB64 } = b64ToUtf8Safe(String(val?.bytes || ""));
      rows.push({ key, type: "bytes", bytesB64, ...(str ? { str } : {}) });
      // Preserve compatibility with callers that expect either a string
      // base64 or an object with a `bytes` field.
      map[key] = { bytes: bytesB64, ...(str ? { str } : {}) };
    }
  }
  return { map, rows };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const idRaw = (req.query.id as string) || "";
    const appId = Number(idRaw);
    if (!Number.isFinite(appId) || appId <= 0) {
      return res.status(400).json({ error: "id (positive integer) required" });
    }

    const r = await fetch(algodUrl(`/v2/applications/${appId}`), { headers: algodHeaders() });
    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: text || r.statusText });

    let j: any;
    try { j = JSON.parse(text); } catch { return res.status(502).json({ error: "algod returned non-JSON response" }); }

    const params = j?.params ?? {};
    const creator = params?.creator ?? null;
    const schema = params?.["global-state-schema"] ?? {};
    const gs = params?.["global-state"] ?? [];
    const decoded = decodeGlobalState(gs);

    return res.status(200).json({
      id: appId,
      creator,
      globalSchema: { ints: schema?.["num-uint"] ?? null, bytes: schema?.["num-byte-slice"] ?? null },
      globals: decoded.map,   // Expect keys like E, m, UNIT, phase
      globalsRaw: decoded.rows,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "server error" });
  }
}
