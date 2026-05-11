/**
 * Browser-side OpenTelemetry initialisation.
 *
 * Auto-initialises on import. Safe to import from SSR layouts — the
 * `typeof window === "undefined"` guard is a no-op on the server.
 *
 * Exports OTLP via the /api/otlp Next route to avoid CORS issues with
 * a browser hitting Jaeger directly.
 *
 * Decision: ZoneContextManager omitted — WebTracerProvider defaults to
 * StackContextManager in the browser, which avoids zone.js polyfill issues
 * in Next.js App Router (plan errata note).
 */
"use client";

import { WebTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-web";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from "@opentelemetry/semantic-conventions";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { XMLHttpRequestInstrumentation } from "@opentelemetry/instrumentation-xml-http-request";

function initBrowserOtel() {
  if (typeof window === "undefined") return; // SSR guard

  const endpoint =
    process.env.NEXT_PUBLIC_OTLP_ENDPOINT ?? "/api/otlp";

  const exporter = new OTLPTraceExporter({ url: endpoint });

  const resource = new Resource({
    [ATTR_SERVICE_NAME]:
      process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME ?? "drshoes-web",
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? "development",
  });

  const provider = new WebTracerProvider({ resource });
  provider.addSpanProcessor(new BatchSpanProcessor(exporter));
  provider.register();

  registerInstrumentations({
    instrumentations: [
      new FetchInstrumentation({ propagateTraceHeaderCorsUrls: [/.*/] }),
      new XMLHttpRequestInstrumentation({
        propagateTraceHeaderCorsUrls: [/.*/],
      }),
    ],
  });
}

initBrowserOtel();
