"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { createLogger } from "@/lib/log";
import { resolveLoginError } from "@/lib/auth/login-error";
// typedRoutes is enabled; `next` is a runtime string from searchParams, so we cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRoute = any;

const log = createLogger("login-form");

const ERROR_ID = "login-error";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/admin/auth/login", { email, password });
      log.info("login attempt", { op: "login", outcome: "ok" });
      // Use window.location.href for a full-page navigation after login.
      // router.push() triggers a client-side RSC fetch that Chromium sometimes aborts
      // (ERR_ABORTED on the RSC stream) leaving the user on a broken page.
      // A hard navigation ensures the session cookie is sent with a fresh GET request
      // and the server renders the full page cleanly.
      window.location.href = next;
    } catch (err) {
      const msg = resolveLoginError(err);
      const isCredentials = msg === "Niepoprawny email lub hasło.";
      if (isCredentials) {
        log.warn("login attempt", { op: "login", outcome: "invalid" });
      } else {
        log.warn("login attempt", { op: "login", outcome: "error" });
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const hasError = error !== null;

  return (
    <form
      onSubmit={onSubmit}
      className="bg-admin-surface border border-admin-line rounded-md p-8 w-full max-w-sm space-y-4"
    >
      <h1 className="font-display text-2xl">Dr Shoes — Logowanie</h1>
      <label className="block">
        <span className="text-sm font-medium text-admin-mute">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid"
          autoComplete="email"
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? ERROR_ID : undefined}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-admin-mute">Hasło</span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid"
          autoComplete="current-password"
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? ERROR_ID : undefined}
        />
      </label>
      {hasError && (
        <p id={ERROR_ID} role="alert" className="text-sm text-orange">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full h-10 bg-ink text-paper font-medium rounded-sm hover:bg-admin-ink disabled:opacity-60"
      >
        {loading ? "Logowanie…" : "Zaloguj się"}
      </button>
    </form>
  );
}
