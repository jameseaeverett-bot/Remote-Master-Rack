import { getDesktopApiConfig, verifyAccessToken } from '../../_lib/auth.js';
import {
  contentJson,
  isCmsOwner,
  listAdminContent,
  normaliseContentRecords,
  replacePublishedContent,
} from '../../_lib/content.js';

const bearerToken = (request) => {
  const match = (request.headers.get('Authorization') || '').match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  return match?.[1] || null;
};

const requireOwner = async (request, env) => {
  if (!env.CONTENT_DB) throw Object.assign(new Error('Content store is unavailable.'), { status: 503 });
  const token = bearerToken(request);
  if (!token) throw Object.assign(new Error('Owner sign-in is required.'), { status: 401 });
  const claims = await verifyAccessToken(token, getDesktopApiConfig(env));
  if (!isCmsOwner(env, claims.sub)) throw Object.assign(new Error('This account is not authorised to publish RMR content.'), { status: 403 });
  return claims;
};

export async function onRequestGet({ request, env }) {
  try {
    await requireOwner(request, env);
    return contentJson(await listAdminContent(env.CONTENT_DB));
  } catch (error) {
    const status = error?.status || 401;
    console.error('RMR content admin lookup failed.', { status, type: error?.name || 'Error' });
    return contentJson({ error: error?.message || 'Content could not be loaded.' }, status);
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const claims = await requireOwner(request, env);
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
      return contentJson({ error: 'A JSON content payload is required.' }, 415);
    }
    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > 64 * 1024) return contentJson({ error: 'Content payload is too large.' }, 413);
    const payload = await request.json();
    if (payload?.version !== 1) return contentJson({ error: 'Unsupported content schema version.' }, 400);
    const records = normaliseContentRecords(payload.records);
    return contentJson(await replacePublishedContent(env.CONTENT_DB, records, claims.sub));
  } catch (error) {
    const status = error?.status || 400;
    console.error('RMR content publish failed.', { status, type: error?.name || 'Error' });
    return contentJson({ error: error?.message || 'Content could not be published.' }, status);
  }
}
