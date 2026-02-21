import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Route protection stub — replace with real auth (e.g., NextAuth) later
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/courses",
  "/messages",
  "/profile",
  "/subscriptions",
];

const ADMIN_PREFIXES = ["/admin"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // In mock mode, allow all routes
  // When real auth is implemented, check session here
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAdmin = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected || isAdmin) {
    // TODO: Check auth session
    // const session = await getSession(request);
    // if (!session) return NextResponse.redirect(new URL("/login", request.url));
    // if (isAdmin && session.role !== "admin") return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
