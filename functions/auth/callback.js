import {
  SESSION_COOKIE,
  TRANSACTION_COOKIE,
  clearCookie,
  completeAuthentication,
  createSessionCookie,
  getAuthConfig,
  upsertCustomerAccount,
} from '../_lib/auth.js';

const redirectWithCookies = (location, cookies) => {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  cookies.forEach((cookie) => headers.append('Set-Cookie', cookie));
  return new Response(null, { status: 302, headers });
};

export async function onRequestGet(context) {
  let baseUrl = 'https://remotemasterrack.com';
  try {
    baseUrl = getAuthConfig(context.env).baseUrl;
    const { config, claims, returnTo } = await completeAuthentication(context);
    const account = await upsertCustomerAccount(context.env, claims);
    if (!account || account.account_status !== 'active') throw new Error('Customer account is unavailable.');
    const sessionCookie = await createSessionCookie(account, claims, config);
    return redirectWithCookies(`${baseUrl}${returnTo || '/account.html'}`, [
      sessionCookie,
      clearCookie(TRANSACTION_COOKIE),
    ]);
  } catch (error) {
    console.error('RMR authentication callback failed.', { type: error?.name || 'Error' });
    return redirectWithCookies(`${baseUrl}/login-book.html?auth=failed`, [
      clearCookie(TRANSACTION_COOKIE),
      clearCookie(SESSION_COOKIE),
    ]);
  }
}
