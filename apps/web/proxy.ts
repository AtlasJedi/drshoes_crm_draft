import { NextRequest, NextResponse } from "next/server";

// Next.js 16 renamed "middleware" → "proxy". Export must be named "proxy".
export function proxy(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = { matcher: ["/admin/:path*"] };
