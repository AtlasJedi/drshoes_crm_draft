"use client";

/**
 * Zero-render client component that triggers browser OTel initialisation.
 * Imported in admin layout so traces are collected for all admin routes.
 * The actual init runs inside browser-client.ts on the client side.
 */
import "@/lib/otel/browser-client";

export function BrowserOtelInit() {
  return null;
}
