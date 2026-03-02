import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Get persisted auth from cookie (Zustand persist writes to localStorage, not cookies)
  // Since Next.js middleware can't access localStorage, we'll do a soft redirect;
  // the layout components handle the real auth check client-side.
  // This middleware just handles the base redirect.

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
