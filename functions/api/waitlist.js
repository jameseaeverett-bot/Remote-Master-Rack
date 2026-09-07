const CONSENT_VERSION = '2026-09-07';
const SOURCE = 'public-website';
const MAX_BODY_BYTES = 2_048;

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

const normaliseWhitespace = (value) => value.trim().replace(/\s+/g, ' ');

const normaliseEmail = (value) => normaliseWhitespace(value).toLowerCase();

const validEmail = (value) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const validFirstName = (value) => value.length <= 80 && (!value || /^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u.test(value));

export async function onRequestPost({ request, env }) {
  if (!env.WAITLIST_DB) {
    console.error('WAITLIST_DB binding is not configured.');
    return respond({ status: 'unavailable', message: 'Waiting-list registration is not available yet. Please try again shortly.' }, 503);
  }

  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_BODY_BYTES) return respond({ status: 'invalid', message: 'Please check your details and try again.' }, 400);

  let body;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return respond({ status: 'invalid', message: 'Please check your details and try again.' }, 400);
    }
    body = JSON.parse(rawBody);
  } catch {
    return respond({ status: 'invalid', message: 'Please check your details and try again.' }, 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return respond({ status: 'invalid', message: 'Please check your details and try again.' }, 400);
  }

  const email = typeof body.email === 'string' ? normaliseEmail(body.email) : '';
  const firstName = typeof body.firstName === 'string' ? normaliseWhitespace(body.firstName) : '';
  const honeypot = typeof body.website === 'string' ? body.website.trim() : '';
  if (honeypot || !validEmail(email) || !validFirstName(firstName) || body.consentMarketing !== true) {
    return respond({ status: 'invalid', message: 'Please check your details and confirm that you would like to receive RMR updates.' }, 400);
  }

  try {
    const existing = await env.WAITLIST_DB
      .prepare("SELECT id FROM waiting_list_signups WHERE email = ? AND status = 'active' LIMIT 1")
      .bind(email)
      .first();
    if (existing) return respond({ status: 'already_registered' });

    await env.WAITLIST_DB
      .prepare('INSERT INTO waiting_list_signups (email, first_name, consent_marketing, consent_version, source, status) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(email, firstName || null, 1, CONSENT_VERSION, SOURCE, 'active')
      .run();
    return respond({ status: 'created' }, 201);
  } catch (error) {
    // The unique index also protects against two identical submissions arriving simultaneously.
    if (String(error?.message || '').toLowerCase().includes('unique')) return respond({ status: 'already_registered' });
    console.error('Waiting-list registration failed.', error);
    return respond({ status: 'unavailable', message: 'Waiting-list registration is not available right now. Please try again shortly.' }, 503);
  }
}
