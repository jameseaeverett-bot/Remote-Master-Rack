import { getDesktopApiConfig, verifyAccessToken } from './auth.js';
import { isCmsOwner } from './content.js';

const bearerToken = (request) => {
  const match = (request.headers.get('Authorization') || '').match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  return match?.[1] || null;
};

export const requireCmsOwner = async (request, env) => {
  const token = bearerToken(request);
  if (!token) throw Object.assign(new Error('Owner sign-in is required.'), { status: 401 });
  const claims = await verifyAccessToken(token, getDesktopApiConfig(env));
  if (!isCmsOwner(env, claims.sub)) throw Object.assign(new Error('This account is not authorised to manage RMR content.'), { status: 403 });
  return claims;
};
