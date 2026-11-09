import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_SESSAO, lerToken } from './lib/token';

/**
 * Roda antes de cada página:
 *  1. sem sessão válida, manda para o login (o banco confere de novo depois);
 *  2. aplica os cabeçalhos de segurança, incluindo uma CSP com nonce,
 *     que só deixa rodar os scripts do próprio aplicativo.
 */
const PUBLICAS = ['/login', '/api/cron'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const publica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!publica && !lerToken(req.cookies.get(COOKIE_SESSAO)?.value)) {
    const url = new URL('/login', req.url);
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const https = req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  // páginas com dado pessoal não ficam guardadas em cache de navegador ou proxy
  res.headers.set('Cache-Control', 'private, no-store, max-age=0');
  if (https) res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  return res;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
