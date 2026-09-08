import { SESSION_COOKIE, TRANSACTION_COOKIE, clearCookie, getAuthConfig } from '../_lib/auth.js';

export function onRequestPost({ env }) {
  const config = getAuthConfig(env);
  const logoutUrl = new URL('/v2/logout', config.issuer);
  logoutUrl.searchParams.set('client_id', config.clientId);
  logoutUrl.searchParams.set('returnTo', `${config.baseUrl}/`);
  const headers = new Headers({ Location: logoutUrl.toString(), 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', clearCookie(SESSION_COOKIE));
  headers.append('Set-Cookie', clearCookie(TRANSACTION_COOKIE));
  return new Response(null, { status: 302, headers });
}
