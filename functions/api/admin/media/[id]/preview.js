import { requireCmsOwner } from '../../../../_lib/cms-owner.js';
import { mediaErrorResponse, resolveOwnerCmsMediaPreview } from '../../../../_lib/cms-media.js';

const notFound = () => new Response('Not found.', {
  status: 404,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

const unavailable = () => Object.assign(new Error('CMS media storage is unavailable.'), { status: 503 });

export async function onRequestGet({ request, env, params }) {
  try {
    await requireCmsOwner(request, env);
    if (!env.CONTENT_DB || !env.CMS_MEDIA) throw unavailable();
    const media = await resolveOwnerCmsMediaPreview(env.CONTENT_DB, params.id);
    const object = await env.CMS_MEDIA.get(media.object_key);
    if (!object) return notFound();
    return new Response(object.body, {
      status: 200,
      headers: {
        'Content-Type': media.content_type,
        'Content-Length': String(media.file_size_bytes),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (Number(error?.status) === 401 || Number(error?.status) === 403 || Number(error?.status) === 503) {
      return mediaErrorResponse(error, 'CMS media preview is temporarily unavailable.');
    }
    console.error('RMR CMS media preview failed.', { status: error?.status || 500, type: error?.name || 'Error' });
    return notFound();
  }
}
