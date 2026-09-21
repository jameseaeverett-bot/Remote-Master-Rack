import { requireCmsOwner } from '../../../_lib/cms-owner.js';
import {
  CMS_MEDIA_MAX_REQUEST_BYTES,
  listCmsMedia,
  mediaErrorResponse,
  mediaJson,
  uploadCmsMedia,
} from '../../../_lib/cms-media.js';

const requireBindings = (env) => {
  if (!env.CONTENT_DB || !env.CMS_MEDIA) throw Object.assign(new Error('CMS media storage is unavailable.'), { status: 503 });
};

export async function onRequestGet({ request, env }) {
  try {
    await requireCmsOwner(request, env);
    requireBindings(env);
    return mediaJson({ media: await listCmsMedia(env.CONTENT_DB) });
  } catch (error) {
    console.error('RMR CMS media list failed.', { status: error?.status || 500, type: error?.name || 'Error' });
    return mediaErrorResponse(error, 'CMS media is temporarily unavailable.');
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const claims = await requireCmsOwner(request, env);
    requireBindings(env);
    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > CMS_MEDIA_MAX_REQUEST_BYTES) return mediaJson({ error: 'The media request is too large.' }, 413);
    if (!/^multipart\/form-data\s*;/i.test(request.headers.get('Content-Type') || '')) return mediaJson({ error: 'A multipart image upload is required.' }, 415);
    const form = await request.formData();
    const file = form.get('file');
    const defaultAltText = form.get('defaultAltText') ?? '';
    const defaultCaption = form.get('defaultCaption') ?? '';
    const media = await uploadCmsMedia({ database: env.CONTENT_DB, bucket: env.CMS_MEDIA, file, defaultAltText, defaultCaption, subject: claims.sub });
    return mediaJson({ media }, 201);
  } catch (error) {
    console.error('RMR CMS media upload failed.', { status: error?.status || 500, type: error?.name || 'Error' });
    return mediaErrorResponse(error, 'CMS media upload failed.');
  }
}
