import { requireCmsOwner } from '../../_lib/cms-owner.js';
import { loadStudioDocument, saveStudioDocument } from '../../_lib/cms-studio.js';
import { mediaErrorResponse, mediaJson } from '../../_lib/cms-media.js';

const database = (env) => { if (!env.CONTENT_DB) throw Object.assign(new Error('CMS content storage is unavailable.'), { status: 503 }); return env.CONTENT_DB; };

export async function onRequestGet({ request, env }) {
  try { await requireCmsOwner(request, env); return mediaJson({ studio: await loadStudioDocument(database(env)) }); }
  catch (error) { console.error('RMR Studio content load failed.', { status: error?.status || 500, type: error?.name || 'Error' }); return mediaErrorResponse(error, 'RMR Studio content is temporarily unavailable.'); }
}

export async function onRequestPut({ request, env }) {
  try {
    const claims = await requireCmsOwner(request, env);
    if (!/^application\/json\b/i.test(request.headers.get('Content-Type') || '')) throw Object.assign(new Error('A JSON RMR Studio document is required.'), { status: 415 });
    return mediaJson({ studio: await saveStudioDocument({ database: database(env), document: await request.json(), subject: claims.sub }) });
  } catch (error) { console.error('RMR Studio content save failed.', { status: error?.status || 500, type: error?.name || 'Error' }); return mediaErrorResponse(error, 'RMR Studio content could not be saved.'); }
}
