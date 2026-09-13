import { ddError } from '../../../../_lib/dd-crash-intelligence.js';

export async function onRequestGet({ params, env, request }) {
  try {
    if (!env.DD_INTELLIGENCE_DB) return ddError('Crash Intelligence is unavailable.', 503);
    const version = Number(params.version); if (!Number.isSafeInteger(version) || version < 1) return ddError('Database version is invalid.', 400);
    const row = await env.DD_INTELLIGENCE_DB.prepare('SELECT dataset_json,content_sha256 FROM dd_database_versions WHERE version = ?').bind(version).first();
    if (!row) return ddError('Published database version was not found.', 404);
    if ((request.headers.get('If-None-Match') || '') === `"${row.content_sha256}"`) return new Response(null, { status: 304, headers: { ETag: `"${row.content_sha256}"`, 'Cache-Control': 'public, max-age=300' } });
    return new Response(row.dataset_json, { headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'public, max-age=300', ETag: `"${row.content_sha256}"`, 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { console.error('DD database lookup failed.', { type: error?.name || 'Error' }); return ddError('Crash Intelligence is unavailable.', 503); }
}
