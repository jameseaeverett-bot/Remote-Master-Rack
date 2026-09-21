import { requireCmsOwner } from '../../../_lib/cms-owner.js';
import { listProductMediaAssignments } from '../../../_lib/cms-product-media.js';
import { mediaErrorResponse, mediaJson } from '../../../_lib/cms-media.js';

export async function onRequestGet({ request, env, params }) {
  try {
    await requireCmsOwner(request, env);
    if (!env.CONTENT_DB) throw Object.assign(new Error('CMS content storage is unavailable.'), { status: 503 });
    return mediaJson({ contentId: params.contentId, assignments: await listProductMediaAssignments(env.CONTENT_DB, params.contentId) });
  } catch (error) {
    console.error('RMR product media list failed.', { status: error?.status || 500, type: error?.name || 'Error' });
    return mediaErrorResponse(error, 'Product media assignments are temporarily unavailable.');
  }
}