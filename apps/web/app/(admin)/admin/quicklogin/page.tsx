"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { createLogger } from "@/lib/log";
import { resolveLoginError } from "@/lib/auth/login-error";

const log = createLogger("quicklogin");

// Demo / handoff convenience: auto-submits the test admin creds and redirects to /admin.
// Use this URL for the client when they can't get through the form. Remove after demo.
const DEMO_EMAIL = "test@test.pl";
const DEMO_PASSWORD = "changeme";

export default function QuickLoginPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.post("/admin/auth/login", { email: DEMO_EMAIL, password: DEMO_PASSWORD });
        log.info("quicklogin success", { op: "quicklogin", outcome: "ok" });
        if (!cancelled) window.location.href = "/admin";
      } catch (err) {
        const msg = resolveLoginError(err);
        log.warn("quicklogin failed", { op: "quicklogin", outcome: "error", err: msg });
        if (!cancelled) setError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-admin-bg p-4">
      <div className="bg-admin-surface border border-admin-line rounded-md p-8 w-full max-w-sm text-center space-y-3">
        <h1 className="font-display text-2xl">Dr Shoes</h1>
        {error ? (
          <>
            <p className="text-sm text-orange">{error}</p>
            <a href="/admin/login" className="text-sm underline">Przejdź do logowania</a>
          </>
        ) : (
          <p className="text-sm text-admin-mute">Logowanie…</p>
        )}
      </div>
    </main>
  );
}
