import {
  getDesktopApiConfig,
  jsonResponse,
  safeAccountProjection,
  upsertCustomerAccount,
  verifyAccessToken,
} from '../../_lib/auth.js';

const bearerToken = (request) => {
  const authorization = request.headers.get('Authorization') || '';
  const match = authorization.match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  return match?.[1] || null;
};

export async function onRequestGet({ request, env }) {
  try {
    if (!env.ACCOUNTS_DB) throw new Error('ACCOUNTS_DB binding is not configured.');
    const token = bearerToken(request);
    if (!token) return jsonResponse({ authenticated: false }, 401);

    const config = getDesktopApiConfig(env);
    const accessClaims = await verifyAccessToken(token, config);
    const profileResponse = await fetch(new URL('/userinfo', config.issuer), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!profileResponse.ok) throw new Error('Identity profile lookup failed.');
    const profile = await profileResponse.json();
    if (!profile || profile.sub !== accessClaims.sub) throw new Error('Identity profile subject mismatch.');

    const account = await upsertCustomerAccount(env, profile);
    if (!account || account.account_status !== 'active') return jsonResponse({ authenticated: false }, 403);
    return jsonResponse({
      authenticated: true,
      identity: { provider: 'auth0', subject: accessClaims.sub },
      account: safeAccountProjection(account),
      tokenExpiresAt: accessClaims.exp,
    });
  } catch (error) {
    console.error('RMR desktop account lookup failed.', { type: error?.name || 'Error' });
    return jsonResponse({ authenticated: false, message: 'Desktop authentication could not be completed.' }, 401);
  }
}
