import { describe, it, expect } from "vitest";
import {
  context,
  trace,
  type SpanContext,
  TraceFlags,
} from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";

describe("W3C traceparent propagation", () => {
  it("W3CTraceContextPropagator injects traceparent into carrier", () => {
    const propagator = new W3CTraceContextPropagator();
    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    const spanId = "00f067aa0ba902b7";

    const spanContext: SpanContext = {
      traceId,
      spanId,
      traceFlags: TraceFlags.SAMPLED,
      isRemote: false,
    };
    const activeContext = trace.setSpanContext(context.active(), spanContext);
    const carrier: Record<string, string> = {};

    propagator.inject(activeContext, carrier, {
      set(c: Record<string, string>, k: string, v: string) {
        c[k] = v;
      },
    });

    expect(carrier["traceparent"]).toMatch(
      /^00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01$/
    );
  });

  it("traceparent format is 00-<traceId>-<spanId>-01", () => {
    const value = `00-${"a".repeat(32)}-${"b".repeat(16)}-01`;
    expect(value).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/);
  });
});
