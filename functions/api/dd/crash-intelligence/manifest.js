import { DD_FORMAT, DD_SCHEMA_VERSION, ddError, ddJson } from '../../../_lib/dd-crash-intelligence.js';

export async function onRequestGet({ env }) {
  try {
    if (!env.DD_INTELLIGENCE_DB) return ddError('Crash Intelligence is unavailable.', 503);
    const current = await env.DD_INTELLIGENCE_DB.prepare(`SELECT v.version,v.schema_version,v.content_sha256,v.content_size_bytes,v.published_at_utc FROM dd_current_manifest m JOIN dd_database_versions v ON v.version=m.current_version WHERE m.singleton=1`).first();
    if (!current) return ddError('No Crash Intelligence database has been published.', 404);
    return ddJson({ format: DD_FORMAT, schema_version: DD_SCHEMA_VERSION, latest_database_version: current.version, published_at_utc: current.published_at_utc, database_url: `/api/dd/crash-intelligence/database/${current.version}`, content_sha256: current.content_sha256, size_bytes: current.content_size_bytes }, 200, { 'ETag': `"${current.content_sha256}"`, 'Cache-Control': 'public, max-age=300' });
  } catch (error) { console.error('DD manifest lookup failed.', { type: error?.name || 'Error' }); return ddError('Crash Intelligence is unavailable.', 503); }
}
