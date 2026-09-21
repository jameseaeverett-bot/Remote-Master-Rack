import { requireCmsOwner } from '../../../_lib/cms-owner.js';
import { inspectCmsMedia, mediaErrorResponse, mediaJson, retireCmsMedia } from '../../../_lib/cms-media.js';

const requireBindings = (env) => {
  if (!env.CONTENT_DB || !env.CMS_MEDIA) throw Object.assign(new Error('CMS media storage is unavailable.'), { status: 503 });
};

export async function onRequestGet({ request, env, params }) {
  try {
    await requireCmsOwner(request, env);
    requireBindings(env);
    return mediaJson({ media: await inspectCmsMedia(env.CONTENT_DB, params.id) });
  } catch (error) {
    console.error('RMR CMS media lookup failed.', { status: error?.status || 500, type: error?.name || 'Error' });
    return mediaErrorResponse(error, 'CMS media is temporarily unavailable.');
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    const claims = await requireCmsOwner(request, env);
    requireBindings(env);
    const purge = new URL(request.url).searchParams.get('purge') === 'true';
    const media = await retireCmsMedia({ database: env.CONTENT_DB, bucket: env.CMS_MEDIA, mediaId: params.id, subject: claims.sub, purge });
    return mediaJson({ media });
  } catch (error) {
    console.error('RMR CMS media retirement failed.', { status: error?.status || 500, type: error?.name || 'Error' });
    return mediaErrorResponse(error, 'CMS media could not be removed.');
  }
}
