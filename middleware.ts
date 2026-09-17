import { NextResponse, type NextRequest } from "next/server";

// DIAGNOSTIC TEMPORAIRE — middleware minimal sans @supabase/ssr, pour isoler
// si le 500 en production vient du bundling de la lib Supabase ou d'un bug
// plus général du Routing Middleware Vercel avec ce projet. À retirer une
// fois la cause identifiée.
export default function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/public|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
