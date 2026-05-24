import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/jwt';

const SESSION_COOKIE_NAME = 'grade_ai_session';

export async function proxy(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const { pathname } = request.nextUrl;

  // Cryptographically verify the session token at the edge level
  const user = session ? await verifyJWT(session) : null;

  // Protect Dashboard and Correction Workspace routes
  if (!user && (pathname.startsWith('/dashboard') || pathname.startsWith('/correct'))) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    // Purge the old/invalid session cookie from the browser
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  // Redirect authenticated users away from login/register back to the dashboard
  if (user && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Purge the cookie if it is present but invalid/expired to prevent redirect loops or invalid token fetches
  if (!user && session) {
    const response = NextResponse.next();
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

// Intercept all page routes while bypassing static files, next assets, and api endpoints
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
