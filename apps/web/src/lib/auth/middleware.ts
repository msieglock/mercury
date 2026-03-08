import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  const sessionToken = request.cookies.get('mercury_session')?.value;

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/auth');
  const isPublicRoute = request.nextUrl.pathname === '/';

  // No session token and not on auth/public route → redirect to login
  if (!sessionToken && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Has session and on auth route → redirect to dashboard
  if (sessionToken && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/today';
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}
