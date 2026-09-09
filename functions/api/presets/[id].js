import { json, popularityScore, presetProjection } from '../../_lib/presets.js';

export async function onRequestGet({ params, env }) {
  if (!env.PRESETS_DB) return json({ error: 'Preset catalogue is unavailable.' }, 503);
  const id = String(params.id || '');
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) return json({ error: 'Preset not found.' }, 404);
  try {
    const row = await env.PRESETS_DB.prepare(`
      SELECT preset_entries.*, COALESCE(ratings.rating_average, 0) AS rating_average,
        COALESCE(ratings.rating_count, 0) AS rating_count
      FROM preset_entries
      LEFT JOIN (SELECT preset_id, ROUND(AVG(stars), 2) AS rating_average, COUNT(*) AS rating_count FROM preset_ratings GROUP BY preset_id) ratings
        ON ratings.preset_id = preset_entries.id
      WHERE preset_entries.id = ? AND preset_entries.status = 'published' LIMIT 1
    `).bind(id).first();
    if (!row) return json({ error: 'Preset not found.' }, 404);
    return json({ preset: { ...presetProjection(row), popularityScore: popularityScore(row.rating_average, row.rating_count, row.download_count) } });
  } catch (error) {
    console.error('RMR preset lookup failed.', { type: error?.name || 'Error' });
    return json({ error: 'Preset catalogue is temporarily unavailable.' }, 503);
  }
}
