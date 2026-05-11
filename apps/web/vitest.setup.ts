import "@testing-library/jest-dom";

// Radix UI (e.g. Switch) uses ResizeObserver internally; JSDOM doesn't provide it.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
