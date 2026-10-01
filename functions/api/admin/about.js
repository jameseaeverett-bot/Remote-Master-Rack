import { requireCmsOwner } from '../../_lib/cms-owner.js';
import { loadAboutDocument, saveAboutDocument } from '../../_lib/cms-about.js';
import { mediaErrorResponse, mediaJson } from '../../_lib/cms-media.js';

const database = env => { if (!env.CONTENT_DB) throw Object.assign(new Error('CMS content storage is unavailable.'), { status: 503 }); return env.CONTENT_DB; };
export async function onRequestGet({ request, env }) { try { await requireCmsOwner(request, env); return mediaJson({ about: await loadAboutDocument(database(env)) }); } catch (error) { console.error('RMR About content load failed.', { status: error?.status || 500, type: error?.name || 'Error' }); return mediaErrorResponse(error, 'About content is temporarily unavailable.'); } }
export async function onRequestPut({ request, env }) { try { const claims = await requireCmsOwner(request, env); if (!/^application\/json\b/i.test(request.headers.get('Content-Type') || '')) throw Object.assign(new Error('A JSON About document is required.'), { status: 415 }); return mediaJson({ about: await saveAboutDocument({ database: database(env), document: await request.json(), subject: claims.sub }) }); } catch (error) { console.error('RMR About content save failed.', { status: error?.status || 500, type: error?.name || 'Error' }); return mediaErrorResponse(error, 'About content could not be saved.'); } }
