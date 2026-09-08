import { jsonResponse, readSession, safeAccountProjection } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  try {
    if (!env.ACCOUNTS_DB) throw new Error('ACCOUNTS_DB binding is not configured.');
    const session = await readSession(request, env);
    if (!session || session.provider !== 'auth0' || !session.accountId || !session.subject) {
      return jsonResponse({ authenticated: false }, 401);
    }
    const account = await env.ACCOUNTS_DB.prepare(`
      SELECT id, auth_provider, auth_subject, email, display_name, created_at, updated_at, account_status
      FROM customer_accounts
      WHERE id = ? AND auth_provider = 'auth0' AND auth_subject = ? LIMIT 1
    `).bind(session.accountId, session.subject).first();
    if (!account || account.account_status !== 'active') return jsonResponse({ authenticated: false }, 401);
    return jsonResponse({ authenticated: true, account: safeAccountProjection(account) });
  } catch (error) {
    console.error('RMR account lookup failed.', { type: error?.name || 'Error' });
    return jsonResponse({ authenticated: false, message: 'Account information is temporarily unavailable.' }, 503);
  }
}
