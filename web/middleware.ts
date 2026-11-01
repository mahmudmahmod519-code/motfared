import { NextResponse, type NextRequest } from 'next/server';
import { gate } from './lib/redirect';

/** No session cookie, no page: visitors are sent to sign in. The API still checks every request itself. */
export function middleware(req: NextRequest) {
  const decision = gate({
    pathname: req.nextUrl.pathname,
    search: req.nextUrl.search,
    hasSession: req.cookies.has('access_token'),
  });
  if (!decision) return NextResponse.next();
  return NextResponse.redirect(new URL(decision.redirect, req.url));
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
