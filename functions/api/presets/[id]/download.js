import { json, safeDownloadFilename } from '../../../_lib/presets.js';

export async function onRequestGet({ params, env }) {
  if (!env.PRESETS_DB || !env.PRESET_FILES) return json({ error: 'Preset download is unavailable.' }, 503);
  const id = String(params.id || '');
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) return json({ error: 'Preset not found.' }, 404);
  try {
    const preset = await env.PRESETS_DB.prepare(`
      SELECT id, file_key, original_filename FROM preset_entries WHERE id = ? AND status = 'published' LIMIT 1
    `).bind(id).first();
    if (!preset) return json({ error: 'Preset not found.' }, 404);

    const object = await env.PRESET_FILES.get(preset.file_key);
    if (!object) return json({ error: 'Preset file is unavailable.' }, 404);

    await env.PRESETS_DB.prepare('UPDATE preset_entries SET download_count = download_count + 1 WHERE id = ? AND status = \'published\'')
      .bind(preset.id).run();
    const headers = new Headers({
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeDownloadFilename(preset.original_filename)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    if (object.httpEtag) headers.set('ETag', object.httpEtag);
    return new Response(object.body, { headers });
  } catch (error) {
    console.error('RMR preset download failed.', { type: error?.name || 'Error' });
    return json({ error: 'Preset download is temporarily unavailable.' }, 503);
  }
}
