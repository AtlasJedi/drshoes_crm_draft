import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const internalApi = process.env.INTERNAL_API_BASE ?? "http://localhost:8080";
  const c = await cookies();
  const cookieHeader = c.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");

  try {
    await fetch(`${internalApi}/api/admin/auth/logout`, {
      method: "POST",
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
  } catch {
    // best-effort — log out of frontend regardless of backend error
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const loginUrl = new URL("/admin/login", `${proto}://${host}`);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete("dr_session");
  return response;
}
