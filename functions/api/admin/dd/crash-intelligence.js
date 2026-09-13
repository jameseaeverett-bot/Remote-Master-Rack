import { ddError, ddJson, listAdminState, publishDataset, requireDdOwner, rollbackDataset, saveKnowledge, saveResearch, saveSource } from '../../../_lib/dd-crash-intelligence.js';

export async function onRequestGet({ request, env }) {
  try { await requireDdOwner(request, env); return ddJson(await listAdminState(env.DD_INTELLIGENCE_DB, Object.fromEntries(new URL(request.url).searchParams))); }
  catch (error) { console.error('DD admin lookup failed.', { status: error?.status || 400, type: error?.name || 'Error' }); return ddError(error?.message || 'Crash Intelligence could not be loaded.', error?.status || 400); }
}

export async function onRequestPost({ request, env }) {
  try {
    const subject = await requireDdOwner(request, env);
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) return ddError('A JSON payload is required.', 415);
    const payload = await request.json();
    if (!payload || typeof payload !== 'object') return ddError('A valid command payload is required.');
    if (payload.action === 'save-source') return ddJson({ source: await saveSource(env.DD_INTELLIGENCE_DB, payload.source, subject) });
    if (payload.action === 'save-knowledge') return ddJson({ knowledge: await saveKnowledge(env.DD_INTELLIGENCE_DB, payload.knowledge, subject) });
    if (payload.action === 'save-research') return ddJson({ research: await saveResearch(env.DD_INTELLIGENCE_DB, payload.research, subject) });
    if (payload.action === 'publish') return ddJson({ publication: await publishDataset(env.DD_INTELLIGENCE_DB, subject) });
    if (payload.action === 'rollback') return ddJson({ rollback: await rollbackDataset(env.DD_INTELLIGENCE_DB, payload.version, subject) });
    return ddError('Unsupported Crash Intelligence command.');
  } catch (error) { console.error('DD admin command failed.', { status: error?.status || 400, type: error?.name || 'Error' }); return ddError(error?.message || 'Crash Intelligence could not be saved.', error?.status || 400); }
}
