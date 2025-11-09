import {
  parseSSEChunk,
  parseSSEDone,
  splitChunkedLines,
  parseTailJson,
} from "../compileEscrowStream";

describe("compileEscrowStream helpers", () => {
  it("parses SSE data blocks with multiple lines", () => {
    const chunk = "data: step 1/3: building...\ndata: linking libs\n";
    expect(parseSSEChunk(chunk)).toEqual(["step 1/3: building...\nlinking libs"]);
  });

  it("returns empty array for comment-only SSE chunks", () => {
    expect(parseSSEChunk(":keep-alive\n")).toEqual([]);
  });

  it("parses SSE done payload", () => {
    expect(parseSSEDone("data: {\"ok\":true,\"escrow_addr\":\"ADDR\"}")).toEqual({
      ok: true,
      escrow: "ADDR",
    });
    expect(parseSSEDone("data: {\"ok\":false}")).toEqual({ ok: false });
    expect(parseSSEDone("data: not-json")).toBeNull();
  });

  it("splits chunked text into raw lines", () => {
    expect(splitChunkedLines("line1\r\nline2\nline3")).toEqual(["line1", "line2", "line3"]);
  });

  it("parses tail JSON status", () => {
    expect(parseTailJson("{\"ok\":true,\"escrow\":\"ADDR\"}")).toEqual({
      ok: true,
      escrow: "ADDR",
    });
    expect(parseTailJson("{\"ok\":false}")).toEqual({ ok: false });
    expect(parseTailJson("not-json")).toBeNull();
  });
});
