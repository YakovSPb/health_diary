import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const SESSION_COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  '__Host-authjs.session-token',
];

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name));
}

/** Добавляет к ответу заголовки удаления session cookies (для очистки после смены AUTH_SECRET или конфликта с другим приложением на localhost). */
function withSessionCookieClear(res: NextResponse): NextResponse {
  for (const name of SESSION_COOKIE_NAMES) {
    const isSecure =
      name.startsWith('__Secure-') || name.startsWith('__Host-');
    res.cookies.set(name, '', {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure ? true : undefined,
    });
  }
  return res;
}

export function middleware(req: NextRequest) {
  const isLoggedIn = hasSessionCookie(req);
  const isAuthPage =
    req.nextUrl.pathname.startsWith('/login') ||
    req.nextUrl.pathname.startsWith('/register');

  const protectedPaths = [
    '/diary',
    '/menu',
    '/profile',
    '/api/meals',
    '/api/menu',
    '/api/profile',
    '/api/parse-food',
  ];

  const isProtectedPath = protectedPaths.some((path) =>
    req.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath && !isLoggedIn) {
    const res = NextResponse.redirect(new URL('/login', req.url));
    return withSessionCookieClear(res);
  }

  // Не редиректить на /diary с /login?cleared=1 — иначе цикл, если браузер не принял очистку cookie
  const fromClearSession = req.nextUrl.searchParams.get('cleared') === '1';
  if (isAuthPage && isLoggedIn && !fromClearSession) {
    return NextResponse.redirect(new URL('/diary', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/diary/:path*',
    '/menu/:path*',
    '/profile/:path*',
    '/api/meals/:path*',
    '/api/menu/:path*',
    '/api/profile/:path*',
    '/login',
    '/register',
  ],
};
