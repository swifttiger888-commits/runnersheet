import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { hostname, pathname, search } = request.nextUrl;

  // Heal stale browser-cached redirect target from an older misconfigured rule.
  if (pathname === "/:path*") {
    return NextResponse.redirect(new URL("https://runnersheet.win/", request.url), 308);
  }

  // Canonicalize to apex domain in production.
  if (hostname === "www.runnersheet.win") {
    const redirectUrl = new URL(`https://runnersheet.win${pathname}${search}`);
    return NextResponse.redirect(redirectUrl, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|robots.txt|sitemap.xml).*)"],
};
