// API route: /api/alert/health
// Sends Telegram alerts when network health is DOWN or Degraded (Indexer lag > 2 rounds)
// No external deps. Uses fetch (Node 18+).
import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Config */
const INDEXER_LAG_OK = 2;
const HEALTH_TIMEOUT_MS = 5000;

/** Throttle memory (survives warm invocations) */
let lastSentTs = 0;
let lastSentKey = '';

/** Parse "15m", "1h", "900" → ms (defaults to 15m if unset/invalid) */
function parseInterval(s: string | undefined): number {
  if (!s) return 15 * 60 * 1000;
  const m = s.trim().toLowerCase();
  if (/^\d+$/.test(m)) return Number(m); // raw ms
  const match = m.match(/^(\d+)\s*(ms|s|m|h)$/);
  if (!match) return 15 * 60 * 1000;
  const n = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case 'ms': return n;
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    default: return 15 * 60 * 1000;
  }
}

/** Fetch with timeout */
async function timedFetch(input: string, init: RequestInit = {}, timeoutMs = HEALTH_TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Probe Algod /v2/status */
async function probeAlgod() {
  const ALGOD_URL = process.env.ALGOD_URL;
  if (!ALGOD_URL) throw new Error('ALGOD_URL not set');
  const token = process.env.ALGOD_TOKEN;
  const headerName = process.env.ALGOD_TOKEN_HEADER;

  const headers: Record<string, string> = {};
  if (token && headerName) headers[headerName] = token;

  const t0 = Date.now();
  try {
    const res = await timedFetch(`${ALGOD_URL.replace(/\/+$/, '')}/v2/status`, { headers });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return { ok: false, status: 'DOWN' as const, latencyMs, round: null, details: `HTTP ${res.status}` };
    const body = await res.json().catch(() => ({} as any));
    // Common field name is "last-round"
    const round = typeof body['last-round'] === 'number' ? body['last-round'] : null;
    return { ok: true, status: 'OK' as const, latencyMs, round, details: '' };
  } catch (e: any) {
    return { ok: false, status: 'DOWN' as const, latencyMs: null, round: null, details: String(e?.message || e) };
  }
}

/** Probe Indexer /health (fallback to /v2/transactions?limit=1 for current-round) */
async function probeIndexer() {
  const INDEXER_URL = process.env.INDEXER_URL;
  if (!INDEXER_URL) throw new Error('INDEXER_URL not set');
  const token = process.env.INDEXER_TOKEN;
  const headerName = process.env.INDEXER_TOKEN_HEADER;

  const headers: Record<string, string> = {};
  if (token && headerName) headers[headerName] = token;

  const base = INDEXER_URL.replace(/\/+$/, '');
  const t0 = Date.now();
  try {
    // Try /health first
    let res = await timedFetch(`${base}/health`, { headers });
    let latencyMs = Date.now() - t0;

    // Some providers don't put round in /health; fall back if needed
    if (!res.ok) {
      // fallback
      const t1 = Date.now();
      res = await timedFetch(`${base}/v2/transactions?limit=1`, { headers });
      latencyMs = Date.now() - t1;
      if (!res.ok) return { ok: false, status: 'DOWN' as const, latencyMs, round: null, details: `HTTP ${res.status}` };
      const body = await res.json().catch(() => ({} as any));
      const round = typeof body['current-round'] === 'number'
        ? body['current-round']
        : (typeof body['round'] === 'number' ? body['round'] : null);
      return { ok: true, status: 'OK' as const, latencyMs, round, details: '' };
    }

    // /health OK; try to derive round via transactions fallback quickly
    let round: number | null = null;
    try {
      const t2 = Date.now();
      const txRes = await timedFetch(`${base}/v2/transactions?limit=1`, { headers }, 3000);
      if (txRes.ok) {
        const body = await txRes.json().catch(() => ({} as any));
        round = typeof body['current-round'] === 'number'
          ? body['current-round']
          : (typeof body['round'] === 'number' ? body['round'] : null);
      }
    } catch { /* ignore */ }

    return { ok: true, status: 'OK' as const, latencyMs, round, details: '' };
  } catch (e: any) {
    return { ok: false, status: 'DOWN' as const, latencyMs: null, round: null, details: String(e?.message || e) };
  }
}

/** Classify overall health */
function classify(algod: ReturnType<typeof buildProbeShape>, indexer: ReturnType<typeof buildProbeShape>) {
  // This signature helper only for TS type inference:
  return null as any;
}
function buildProbeShape(p: Awaited<ReturnType<typeof probeAlgod>> | Awaited<ReturnType<typeof probeIndexer>>) {
  return p;
}

type OverallStatus = 'OK' | 'DEGRADED' | 'DOWN';

function computeSummary(a: Awaited<ReturnType<typeof probeAlgod>>, i: Awaited<ReturnType<typeof probeIndexer>>) {
  let status: OverallStatus = 'OK';
  if (!a.ok || !i.ok) status = 'DOWN';
  let roundGap: number | null = null;
  if (a.round != null && i.round != null) {
    roundGap = a.round - i.round;
    if (roundGap > INDEXER_LAG_OK && status !== 'DOWN') status = 'DEGRADED';
  }
  return { status, roundGap };
}

/** Telegram sender */
async function sendTelegram(text: string) {
  const dest = process.env.HEALTH_ALERT_DEST;
  if (dest !== 'telegram') return { sent: false, reason: 'dest not telegram' as const };

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { sent: false, reason: 'missing token/chat' as const };

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  const ok = res.ok;
  const body = await res.text().catch(() => '');
  return { sent: ok, status: res.status, body };
}

/** Format message text */
function formatMessage(params: {
  status: OverallStatus;
  algodRound: number | null;
  indexerRound: number | null;
  roundGap: number | null;
  algodLatency: number | null;
  indexerLatency: number | null;
}) {
  const { status, algodRound, indexerRound, roundGap, algodLatency, indexerLatency } = params;
  const statusEmoji = status === 'DOWN' ? '⛔' : status === 'DEGRADED' ? '⚠️' : '✅';
  const network = (process.env.VITE_ALGOD_NETWORK || 'unknown').toUpperCase();
  const aHost = safeHost(process.env.ALGOD_URL);
  const iHost = safeHost(process.env.INDEXER_URL);
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
  const statusUrl = `${base}/status`;
  return [
    `bTree Health ${statusEmoji} — ${status}`,
    `Network: ${network}`,
    `Algod: round ${num(algodRound)} (${num(algodLatency)} ms) @ ${aHost}`,
    `Indexer: round ${num(indexerRound)} (${num(indexerLatency)} ms) @ ${iHost}`,
    `Round gap: ${num(roundGap)}`,
    `More: ${statusUrl}`
  ].join('\n');
}

function safeHost(url?: string) {
  try { return url ? new URL(url).host : '—'; } catch { return '—'; }
}
function num(n: number | null) { return n == null ? '—' : String(n); }

/** Throttle check */
function shouldThrottle(key: string, now: number, minIntervalMs: number) {
  if (key !== lastSentKey) return false; // new state — allow
  return (now - lastSentTs) < minIntervalMs;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1) Probe both services
  let algod, indexer;
  try {
    [algod, indexer] = await Promise.all([probeAlgod(), probeIndexer()]);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
    return;
  }

  // 2) Classify
  const { status, roundGap } = computeSummary(algod, indexer);

  // 3) Build response payload
  const payload = {
    ok: true,
    status,
    network: (process.env.VITE_ALGOD_NETWORK || 'unknown').toLowerCase(),
    algod: { ...algod },
    indexer: { ...indexer },
    roundGap
  };

  // Always return JSON
  // If alerts are not configured, just 200 with payload
  const dest = process.env.HEALTH_ALERT_DEST ?? '';
  if (!dest) {
    res.status(200).json({ ...payload, note: 'alerts disabled (set HEALTH_ALERT_DEST to telegram to enable)' });
    return;
  }

  // Only send on DOWN or DEGRADED
  if (status === 'OK') {
    res.status(200).json({ ...payload, sent: false, note: 'healthy — no alert sent' });
    return;
  }

  // Throttle
  const key = `${status}:${(process.env.VITE_ALGOD_NETWORK || 'unknown').toLowerCase()}`;
  const minIntervalMs = parseInterval(process.env.HEALTH_ALERT_MIN_INTERVAL);
  const now = Date.now();
  if (shouldThrottle(key, now, minIntervalMs)) {
    res.status(200).json({ ...payload, sent: false, note: `throttled (< ${minIntervalMs}ms)` });
    return;
  }

  // 4) Dispatch (Telegram)
  const text = formatMessage({
    status,
    algodRound: algod.round,
    indexerRound: indexer.round,
    roundGap,
    algodLatency: algod.latencyMs,
    indexerLatency: indexer.latencyMs
  });

  let sentResult: any = null;
  if (dest === 'telegram') {
    sentResult = await sendTelegram(text);
  } else {
    // Future: discord/email
    res.status(200).json({ ...payload, sent: false, note: `unsupported dest ${dest}` });
    return;
  }

  // Update throttle state on success
  if (sentResult?.sent) {
    lastSentKey = key;
    lastSentTs = now;
  }

  res.status(200).json({ ...payload, sent: !!sentResult?.sent, transport: dest });
}
