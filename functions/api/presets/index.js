import { json, parseListQuery, popularityScore, presetProjection } from '../../_lib/presets.js';

const ratingJoin = `
  LEFT JOIN (
    SELECT preset_id, ROUND(AVG(stars), 2) AS rating_average, COUNT(*) AS rating_count
    FROM preset_ratings
    GROUP BY preset_id
  ) ratings ON ratings.preset_id = preset_entries.id
`;

const orderFor = (sort) => ({
  popular: `
    (((COALESCE(ratings.rating_count, 0) * COALESCE(ratings.rating_average, 0)) + 17.5) /
      (COALESCE(ratings.rating_count, 0) + 5)) + (MIN(preset_entries.download_count, 1000) / 100.0) DESC,
    preset_entries.published_at DESC`,
  'highest-rated': 'COALESCE(ratings.rating_average, 0) DESC, COALESCE(ratings.rating_count, 0) DESC, preset_entries.published_at DESC',
  'most-downloaded': 'preset_entries.download_count DESC, preset_entries.published_at DESC',
  newest: 'preset_entries.published_at DESC',
}[sort]);

export async function onRequestGet({ request, env }) {
  if (!env.PRESETS_DB) return json({ error: 'Preset catalogue is unavailable.' }, 503);
  const query = parseListQuery(new URL(request.url));
  if (query.error) return json({ error: query.error }, 400);

  const conditions = ["preset_entries.status = 'published'"];
  const values = [];
  for (const [column, value] of [
    ['editor_slug', query.editor],
    ['creator_display_name', query.creator],
    ['genre', query.genre],
    ['source_bus', query.sourceBus],
  ]) {
    if (value) { conditions.push(`preset_entries.${column} = ?`); values.push(value); }
  }

  try {
    const sql = `
      SELECT preset_entries.*, COALESCE(ratings.rating_average, 0) AS rating_average,
        COALESCE(ratings.rating_count, 0) AS rating_count
      FROM preset_entries ${ratingJoin}
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderFor(query.sort)}
      LIMIT ? OFFSET ?
    `;
    const result = await env.PRESETS_DB.prepare(sql).bind(...values, query.limit, query.offset).all();
    const presets = (result.results || []).map((row) => ({
      ...presetProjection(row),
      popularityScore: popularityScore(row.rating_average, row.rating_count, row.download_count),
    }));
    return json({ presets, page: { limit: query.limit, offset: query.offset, returned: presets.length }, filters: {
      editor: query.editor, creator: query.creator, genre: query.genre, sourceBus: query.sourceBus, sort: query.sort,
    } });
  } catch (error) {
    console.error('RMR preset listing failed.', { type: error?.name || 'Error' });
    return json({ error: 'Preset catalogue is temporarily unavailable.' }, 503);
  }
}
