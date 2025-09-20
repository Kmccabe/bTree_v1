import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getHealthSummary, probeAlgod } from "./health.js";

const ALGOD_URL = "https://algod.test";
const INDEXER_URL = "https://indexer.test";

function stubFetch(
  resolver: (url: string, init?: RequestInit) => Promise<Response> | Response
) {
  const mock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    return resolver(url, init);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    statusText: init?.statusText,
    headers
  });
}

describe("health summary", () => {
  beforeEach(() => {
    process.env.ALGOD_URL = ALGOD_URL;
    delete process.env.TESTNET_ALGOD_URL;
    process.env.INDEXER_URL = INDEXER_URL;
    delete process.env.TESTNET_INDEXER_URL;
    process.env.VITE_ALGOD_NETWORK = "testnet";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns OK summary when both services are healthy", async () => {
    const fetchMock = stubFetch((url) => {
      if (url.endsWith("/v2/status")) {
        return jsonResponse({ "last-round": 12345, message: "healthy" });
      }
      if (url.endsWith("/health")) {
        return jsonResponse({ "current-round": 12344, message: "ok" });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const summary = await getHealthSummary();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(summary.algod.status).toBe("OK");
    expect(summary.indexer.status).toBe("OK");
    expect(summary.consistency).toBe("OK");
    expect(summary.roundGap).toBe(1);
  });

  it("flags indexer lag greater than tolerance", async () => {
    stubFetch((url) => {
      if (url.endsWith("/v2/status")) {
        return jsonResponse({ "last-round": 200 });
      }
      if (url.endsWith("/health")) {
        return jsonResponse({ "current-round": 196 });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const summary = await getHealthSummary();

    expect(summary.consistency).toBe("WARN");
    expect(summary.roundGap).toBe(4);
    expect(summary.indexer.status).toBe("DEGRADED");
    expect(summary.indexer.details ?? "").toContain("lagging by 4 rounds");
  });

  it("marks algod down when request fails", async () => {
    stubFetch((url) => {
      if (url.endsWith("/v2/status")) {
        return jsonResponse({ error: "boom" }, { status: 503, statusText: "Service Unavailable" });
      }
      if (url.endsWith("/health")) {
        return jsonResponse({ "current-round": 100 });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const summary = await getHealthSummary();

    expect(summary.algod.status).toBe("DOWN");
    expect(summary.algod.ok).toBe(false);
    expect(summary.algod.latencyMs).toBeNull();
    expect(summary.consistency).toBe("FAIL");
  });
});

describe("probeAlgod", () => {
  beforeEach(() => {
    process.env.ALGOD_URL = ALGOD_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("treats missing last-round as degraded", async () => {
    stubFetch((url) => {
      if (url.endsWith("/v2/status")) {
        return jsonResponse({ message: "no round" });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const result = await probeAlgod();

    expect(result.status).toBe("DEGRADED");
    expect(result.ok).toBe(true);
    expect(result.round).toBeNull();
    expect(result.details ?? "").toContain("missing last-round");
  });
});
