/**
 * OTLP proxy route.
 *
 * Receives a POST from the browser (OTLP/HTTP protobuf or JSON) and
 * forwards the raw bytes to the Jaeger OTLP collector.
 * Returns 204 on success, 502 on upstream error.
 *
 * This proxy avoids the need to configure Jaeger with CORS headers and
 * keeps the Jaeger port off the browser network path.
 *
 * Security: no request authentication — intentional for demo scope.
 * The Jaeger port is internal (docker network only in production).
 * Stage 2 reviewer: confirm this is acceptable for the threat model.
 */
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/log";

const log = createLogger("otlp-proxy");

const UPSTREAM =
  (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318") +
  "/v1/traces";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const contentType =
    req.headers.get("content-type") ?? "application/x-protobuf";
  const body = await req.arrayBuffer();

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });

    if (!upstream.ok) {
      log.info("op=proxy outcome=upstream-error status=" + upstream.status);
      return NextResponse.json(
        { error: "upstream error", status: upstream.status },
        { status: 502 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    log.info("op=proxy outcome=upstream-unreachable error=" + String(err));
    return NextResponse.json(
      { error: "upstream unreachable" },
      { status: 502 }
    );
  }
}
