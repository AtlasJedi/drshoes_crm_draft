// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();

vi.stubGlobal("fetch", mockFetch);

describe("POST /api/otlp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(
      new Response(null, { status: 200 })
    );
  });

  it("forwards body bytes to upstream Jaeger", async () => {
    const { POST } = await import("./route");
    const body = new Uint8Array([0x0a, 0x0b, 0x0c]);
    const req = new Request("http://localhost/api/otlp", {
      method: "POST",
      headers: { "Content-Type": "application/x-protobuf" },
      body,
    });

    const res = await POST(req as import("next/server").NextRequest);
    expect(res.status).toBe(204);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toContain("/v1/traces");
    const sentBody = new Uint8Array(await (init.body as ArrayBuffer));
    expect(sentBody).toEqual(body);
  });

  it("returns 502 when upstream errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("upstream timeout"));
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/otlp", {
      method: "POST",
      headers: { "Content-Type": "application/x-protobuf" },
      body: new Uint8Array([0x01]),
    });
    const res = await POST(req as import("next/server").NextRequest);
    expect(res.status).toBe(502);
  });
});
