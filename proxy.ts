import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminConfig";

/**
 * Optimistic auth check only — cookie presence, no network/DB call (Proxy
 * is not meant for slow work). The real check happens on every backend
 * call via the httpOnly cookie's token, validated by FastAPI's
 * get_current_admin dependency. This just avoids flashing protected pages
 * before redirecting an obviously-unauthenticated visitor.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(ADMIN_SESSION_COOKIE);
  if (!hasSession) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
