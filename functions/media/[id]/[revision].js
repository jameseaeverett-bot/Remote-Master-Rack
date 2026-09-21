import { resolvePublicCmsMedia, validCmsMediaId, validCmsMediaRevision } from '../../_lib/cms-media.js';

const notFound = () => new Response('Not found.', {
  status: 404,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

export async function onRequestGet({ request, env, params }) {
  try {
    if (!env.CONTENT_DB || !env.CMS_MEDIA || !validCmsMediaId(params.id) || !validCmsMediaRevision(params.revision)) return notFound();
    const media = await resolvePublicCmsMedia(env.CONTENT_DB, params.id, params.revision);
    if (!media) return notFound();
    const etag = `"${media.sha256}"`;
    const headers = {
      'Content-Type': media.content_type,
      'Content-Length': String(media.file_size_bytes),
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
    };
    if (request.headers.get('If-None-Match') === etag) {
      const notModifiedHeaders = { ...headers };
      delete notModifiedHeaders['Content-Length'];
      return new Response(null, { status: 304, headers: notModifiedHeaders });
    }
    const object = await env.CMS_MEDIA.get(media.object_key);
    if (!object) return notFound();
    return new Response(object.body, { status: 200, headers });
  } catch (error) {
    console.error('RMR public CMS media delivery failed.', { type: error?.name || 'Error' });
    return notFound();
  }
}
