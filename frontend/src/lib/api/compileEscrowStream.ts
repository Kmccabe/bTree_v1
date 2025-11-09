const DEFAULT_MODE = (import.meta.env.VITE_COMPILE_STREAM_MODE ?? "chunk").toLowerCase();

export type CompileDone = { done: true; ok: boolean; escrow?: string };
export type LogEvent = string | CompileDone;

function normalizeDataLine(line: string): string {
  return line.startsWith("data:")
    ? line.slice(5).replace(/^ /, "")
    : line;
}

export function parseSSEChunk(input: string): string[] {
  const lines = input.replace(/\r/g, "").split("\n");
  const buffer: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line || line.startsWith(":") || line.startsWith("event:")) continue;
    buffer.push(normalizeDataLine(line));
  }
  return buffer.length > 0 ? [buffer.join("\n")] : [];
}

export function parseSSEDone(input: string): { ok: boolean; escrow?: string } | null {
  const text = normalizeDataLine(input).trim();
  if (!text) return null;
  try {
    const payload = JSON.parse(text);
    if (typeof payload.ok !== "boolean") return null;
    const escrow = typeof payload.escrow === "string"
      ? payload.escrow
      : typeof payload.escrow_addr === "string"
      ? payload.escrow_addr
      : undefined;
    return escrow ? { ok: payload.ok, escrow } : { ok: payload.ok };
  } catch {
    return null;
  }
}

export function splitChunkedLines(input: string): string[] {
  return input.replace(/\r/g, "").split("\n");
}

export function parseTailJson(line: string): { ok: boolean; escrow?: string } | null {
  const text = line.trim();
  if (!text) return null;
  try {
    const payload = JSON.parse(text);
    if (typeof payload.ok !== "boolean") return null;
    const escrow = typeof payload.escrow === "string"
      ? payload.escrow
      : typeof payload.escrow_addr === "string"
      ? payload.escrow_addr
      : undefined;
    return escrow ? { ok: payload.ok, escrow } : { ok: payload.ok };
  } catch {
    return null;
  }
}

export async function* compileEscrowStream(signal?: AbortSignal): AsyncGenerator<LogEvent> {
  const mode = DEFAULT_MODE === "sse" ? "sse" : "chunk";
  try {
    if (mode === "sse") {
      yield* sseStream(signal);
    } else {
      yield* chunkStream(signal);
    }
  } catch {
    yield { done: true, ok: false };
  }
}

export async function* mockCompileEscrowStream(signal?: AbortSignal): AsyncGenerator<LogEvent> {
  for (let i = 1; i <= 40; i++) {
    if (signal?.aborted) return;
    yield `step ${i}/40: working`;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  if (signal?.aborted) return;
  yield { done: true, ok: true, escrow: "XPLQ...7S3" };
}

async function* sseStream(signal?: AbortSignal): AsyncGenerator<LogEvent> {
  const response = await fetch("/api/compile-escrow?watch=1", {
    signal,
    headers: { Accept: "text/event-stream" },
  });
  if (!response.ok || !response.body) throw new Error("SSE compile failed");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let resolved = false;
  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done }).replace(/\r/g, "");
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const eventBlock = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const trimmed = eventBlock.trim();
        if (!trimmed) continue;
        const eventLine = trimmed
          .split("\n")
          .find((line) => line.startsWith("event:"));
        const eventName = eventLine ? eventLine.slice(6).trim() : null;
        if (eventName === "done") {
          const dataLine = trimmed
            .split("\n")
            .find((line) => line.startsWith("data:"));
          const parsed = dataLine ? parseSSEDone(dataLine) : null;
          resolved = true;
          yield parsed
            ? { done: true, ok: parsed.ok, escrow: parsed.escrow }
            : { done: true, ok: false };
          return;
        }
        const lines = parseSSEChunk(trimmed);
        for (const line of lines) {
          if (line.trim()) yield line;
        }
      }
    }
    if (done) break;
  }
  if (!resolved) {
    yield { done: true, ok: false };
  }
}

async function* chunkStream(signal?: AbortSignal): AsyncGenerator<LogEvent> {
  const response = await fetch("/api/compile-escrow", { signal });
  if (!response.ok || !response.body) throw new Error("chunk stream failed");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let pendingLine: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
      const parts = splitChunkedLines(buffer);
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        if (pendingLine && pendingLine.trim()) {
          yield pendingLine;
        }
        pendingLine = line;
      }
    }
    if (done) break;
  }

  const tailLine = buffer.length > 0 ? buffer : pendingLine ?? "";
  if (pendingLine && pendingLine !== tailLine && pendingLine.trim()) {
    yield pendingLine;
  }
  const parsed = tailLine ? parseTailJson(tailLine) : null;
  if (parsed) {
    yield { done: true, ok: parsed.ok, escrow: parsed.escrow };
  } else {
    yield { done: true, ok: false };
  }
}
