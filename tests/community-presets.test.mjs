import assert from 'node:assert/strict';
import test from 'node:test';
import { EDITOR_CATALOGUE, parseListQuery, popularityScore, presetProjection, safeDownloadFilename } from '../functions/_lib/presets.js';

test('preset editor catalogue contains the established VST editor slugs only', () => {
  assert.deepEqual(EDITOR_CATALOGUE, ['folktek-resonant-garden', 'pultec-eqp-1a', 'ssl-fusion']);
  assert.equal(parseListQuery(new URL('https://example.test/api/presets?editor=unknown')).error, 'Unknown editor.');
});

test('preset list query accepts supported filters and sort modes', () => {
  const query = parseListQuery(new URL('https://example.test/api/presets?editor=ssl-fusion&creator=James&genre=Electronic&sourceBus=Mix%20bus&sort=newest&limit=10&offset=2'));
  assert.equal(query.error, undefined);
  assert.equal(query.editor, 'ssl-fusion');
  assert.equal(query.sort, 'newest');
  assert.equal(query.limit, 10);
  assert.equal(query.offset, 2);
  assert.ok(parseListQuery(new URL('https://example.test/api/presets?sort=invalid')).error);
});

test('popularity rewards established quality instead of a single five-star rating', () => {
  assert.ok(popularityScore(4.8, 200, 50) > popularityScore(5, 1, 0));
});

test('public preset projection excludes storage and ownership internals', () => {
  const preset = presetProjection({ id: 'preset-1', editor_slug: 'ssl-fusion', title: 'Warm Bus', creator_display_name: 'James', genre: 'Electronic', source_bus: 'Mix bus', description: 'Test', original_filename: 'warm.rmr', file_extension: '.rmr', file_size_bytes: 100, checksum_sha256: 'x'.repeat(64), file_key: 'private/object', rating_average: 4.5, rating_count: 3, download_count: 8, published_at: '2026-09-09', updated_at: '2026-09-09' });
  assert.equal(preset.file.originalFilename, 'warm.rmr');
  assert.equal('fileKey' in preset, false);
  assert.equal('checksumSha256' in preset, false);
  assert.equal('creatorAccountId' in preset, false);
});

test('download filenames cannot carry header or path separators', () => {
  assert.equal(safeDownloadFilename('../unsafe\r\nname.exe'), '.._unsafe_name.exe');
});
