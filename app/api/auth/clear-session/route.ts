import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  '__Host-authjs.session-token',
];

/**
 * Очищает невалидные/устаревшие session cookies и редиректит на логин.
 * Вызывается при JWTSessionError (например, после смены AUTH_SECRET).
 * Параметр cleared=1 разрывает цикл редиректов, если браузер не принимает Set-Cookie.
 */
export function GET(req: NextRequest) {
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('cleared', '1');
  const res = NextResponse.redirect(loginUrl);
  for (const name of SESSION_COOKIE_NAMES) {
    const isSecureCookie =
      name.startsWith('__Secure-') || name.startsWith('__Host-');
    res.cookies.set(name, '', {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecureCookie ? true : undefined,
    });
  }
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
