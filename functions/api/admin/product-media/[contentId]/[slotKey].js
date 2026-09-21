import { requireCmsOwner } from '../../../../_lib/cms-owner.js';
import { removeProductMediaAssignment, upsertProductMediaAssignment } from '../../../../_lib/cms-product-media.js';
import { mediaErrorResponse, mediaJson } from '../../../../_lib/cms-media.js';

const bindings = (env) => { if (!env.CONTENT_DB) throw Object.assign(new Error('CMS content storage is unavailable.'), { status: 503 }); };

export async function onRequestPut({ request, env, params }) {
  try {
    const claims = await requireCmsOwner(request, env); bindings(env);
    if (!/^application\/json\b/i.test(request.headers.get('Content-Type') || '')) throw Object.assign(new Error('A JSON product-media assignment is required.'), { status: 415 });
    const assignment = await request.json();
    const saved = await upsertProductMediaAssignment({ database: env.CONTENT_DB, contentId: params.contentId, slotKey: params.slotKey, assignment, subject: claims.sub });
    return mediaJson({ assignment: saved });
  } catch (error) {
    console.error('RMR product media assignment failed.', { status: error?.status || 500, type: error?.name || 'Error' });
    return mediaErrorResponse(error, 'Product media assignment could not be saved.');
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    await requireCmsOwner(request, env); bindings(env);
    return mediaJson({ assignment: await removeProductMediaAssignment({ database: env.CONTENT_DB, contentId: params.contentId, slotKey: params.slotKey }) });
  } catch (error) {
    console.error('RMR product media assignment removal failed.', { status: error?.status || 500, type: error?.name || 'Error' });
    return mediaErrorResponse(error, 'Product media assignment could not be removed.');
  }
}