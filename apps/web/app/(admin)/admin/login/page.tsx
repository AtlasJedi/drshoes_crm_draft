import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Dr Shoes — Logowanie" };

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-admin-bg p-4">
      {/* Suspense required by Next.js for useSearchParams() in client components */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
