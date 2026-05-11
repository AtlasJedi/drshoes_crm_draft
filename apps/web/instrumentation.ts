/**
 * Next.js server instrumentation hook.
 * This file is loaded by Next.js before the server starts.
 * Do NOT import any browser-only APIs here.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { Resource } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_NAMESPACE,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from "@opentelemetry/semantic-conventions";

export function register() {
  // Guard: only initialise on the Node.js runtime (not Edge).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const exporter = new OTLPTraceExporter({
    url:
      (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318") +
      "/v1/traces",
  });

  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: "drshoes-web",
      [ATTR_SERVICE_NAMESPACE]: "drshoes",
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? "development",
    }),
    traceExporter: exporter,
    // Accept all defaults from auto-instrumentations-node (HTTP, fetch, etc.)
    // Passing selective keys risks runtime errors on version mismatch.
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
  process.on("SIGTERM", () => sdk.shutdown());
}
