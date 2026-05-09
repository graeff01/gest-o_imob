import { NextResponse } from "next/server";
import { auth, type Role } from "@/lib/auth";
import { canAccessRoute } from "@/lib/route-access";

export default auth((request) => {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (!request.auth?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const role = ((request.auth.user as { role?: Role }).role ?? "DONO") as Role;

  if (!canAccessRoute(pathname, role)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/",
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
