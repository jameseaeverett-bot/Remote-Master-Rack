import assert from 'node:assert/strict';
import test from 'node:test';
import { EDITOR_CATALOGUE, MAX_PRESET_FILE_BYTES, parseListQuery, popularityScore, presetProjection, safeDownloadFilename, validatePresetDocument } from '../functions/_lib/presets.js';
import { onRequestPost as sharePreset } from '../functions/api/presets/share.js';
import { SESSION_COOKIE, sealCookie } from '../functions/_lib/auth.js';

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

const unsignedPreset = {
  editorId: 'ssl-fusion', format: 'rmr-vst-editor-preset', formatVersion: 1,
  payload: { parameters: {} }, preset: { creator: 'James', genre: 'Electronic', name: 'Real test', sourceBus: 'Bass' }, productStateVersion: 1,
};
const integrityValue = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(unsignedPreset))))]
  .map((byte) => byte.toString(16).padStart(2, '0')).join('');
const validPresetBytes = new TextEncoder().encode(JSON.stringify({
  ...unsignedPreset, integrity: { algorithm: 'sha-256', scope: 'canonical-envelope-without-integrity', value: integrityValue },
}));

test('SSL Fusion accepts only a non-empty bounded .rmrpreset document with verified integrity', async () => {
  assert.equal(await validatePresetDocument('ssl-fusion', 'test.rmrpreset', validPresetBytes), null);
  assert.match(await validatePresetDocument('ssl-fusion', 'test.exe', validPresetBytes), /not approved/);
  assert.match(await validatePresetDocument('ssl-fusion', 'test.rmrpreset', new Uint8Array()), /empty/);
  assert.match(await validatePresetDocument('ssl-fusion', 'test.rmrpreset', new Uint8Array(MAX_PRESET_FILE_BYTES + 1)), /large/);
  assert.match(await validatePresetDocument('ssl-fusion', 'test.rmrpreset', new TextEncoder().encode('{}')), /structure is invalid/);
  assert.match(await validatePresetDocument('pultec-eqp-1a', 'test.rmrpreset', validPresetBytes), /not approved/);
  const tampered = JSON.parse(new TextDecoder().decode(validPresetBytes)); tampered.payload.parameters.changed = true;
  assert.match(await validatePresetDocument('ssl-fusion', 'test.rmrpreset', new TextEncoder().encode(JSON.stringify(tampered))), /integrity check failed/);
});

const sessionSecret = Buffer.alloc(32, 8).toString('base64url');
const authEnvironment = {
  AUTH0_DOMAIN: 'example.auth0.com', AUTH0_CLIENT_ID: 'web', AUTH0_CLIENT_SECRET: 'secret',
  AUTH_SESSION_SECRET: sessionSecret, AUTH_BASE_URL: 'https://remotemasterrack.com',
};

const buildUpload = async ({ duplicate = false, r2Failure = false, d1Failure = false } = {}) => {
  const session = await sealCookie({ accountId: 'account-1', provider: 'auth0', subject: 'auth0|one', exp: Math.floor(Date.now() / 1000) + 300 }, sessionSecret, 'rmr-session-v1');
  const calls = { put: 0, delete: 0, insert: 0 };
  const form = new FormData();
  form.set('editor', 'ssl-fusion'); form.set('title', 'Real test'); form.set('genre', 'Electronic'); form.set('sourceBus', 'Bass'); form.set('description', 'Test'); form.set('rightsConfirmed', 'true');
  form.set('file', new File([validPresetBytes], 'real-test.rmrpreset', { type: 'application/octet-stream' }));
  const accountDb = { prepare: () => ({ bind: () => ({ first: async () => ({ id: 'account-1', email: 'one@example.com', display_name: 'James', account_status: 'active' }) }) }) };
  const presetsDb = { prepare: (sql) => ({ bind: () => ({
    first: async () => sql.includes('COUNT(*)') ? { total: 0, count: 0 } : (sql.includes('checksum_sha256') && duplicate ? { id: 'existing' } : null),
    run: async () => { if (sql.includes('INSERT INTO')) { calls.insert += 1; if (d1Failure) throw new Error('D1 failure'); } },
  }) }) };
  const r2 = { put: async () => { calls.put += 1; if (r2Failure) throw new Error('R2 failure'); }, delete: async () => { calls.delete += 1; } };
  const request = new Request('https://remotemasterrack.com/api/presets/share', { method: 'POST', headers: { Cookie: `${SESSION_COOKIE}=${session}` }, body: form });
  const response = await sharePreset({ request, env: { ...authEnvironment, ACCOUNTS_DB: accountDb, PRESETS_DB: presetsDb, PRESET_FILES: r2 } });
  return { response, calls };
};

test('authenticated sharing stores R2 first and records pending review metadata', async () => {
  const { response, calls } = await buildUpload();
  assert.equal(response.status, 201); assert.deepEqual(calls, { put: 1, delete: 0, insert: 1 });
  assert.equal((await response.json()).submission.editorSlug, 'ssl-fusion');
});

test('duplicate sharing is rejected before R2 storage', async () => {
  const { response, calls } = await buildUpload({ duplicate: true });
  assert.equal(response.status, 409); assert.equal(calls.put, 0);
});

test('R2 failure never creates D1 metadata and D1 failure cleans up its R2 object', async () => {
  const r2 = await buildUpload({ r2Failure: true }); assert.equal(r2.response.status, 503); assert.equal(r2.calls.insert, 0);
  const d1 = await buildUpload({ d1Failure: true }); assert.equal(d1.response.status, 503); assert.equal(d1.calls.delete, 1);
});
