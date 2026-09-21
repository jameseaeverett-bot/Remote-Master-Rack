import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRODUCT_CONTENT_IDS,
  listProductMediaAssignments,
  removeProductMediaAssignment,
  upsertProductMediaAssignment,
  validateProductContentId,
  validateProductMediaSlotKey,
} from '../functions/_lib/cms-product-media.js';
import { onRequestGet as listEndpoint } from '../functions/api/admin/product-media/[contentId].js';
import { onRequestPut as upsertEndpoint } from '../functions/api/admin/product-media/[contentId]/[slotKey].js';

const active = (id) => ({ id, lifecycle_state: 'active', original_filename: `${id}.png`, content_type: 'image/png', file_size_bytes: 1234, width: 100, height: 80, sha256: 'a'.repeat(64) });
const makeDatabase = () => {
  const media = new Map([['media-a', active('media-a')], ['media-b', active('media-b')], ['media-orphaned', { ...active('media-orphaned'), lifecycle_state: 'orphaned' }], ['media-deleted', { ...active('media-deleted'), lifecycle_state: 'deleted' }]]);
  const assignments = new Map();
  const row = (assignment) => ({ ...assignment, ...media.get(assignment.media_id) });
  return {
    media, assignments,
    prepare(sql) { return { bind(...values) { return {
      async first() { return sql.includes('FROM cms_media_assets') ? media.get(values[0]) || null : null; },
      async all() { return { results: [...assignments.values()].filter((item) => item.content_id === values[0]).map(row) }; },
      async run() {
        if (sql.includes('INSERT INTO cms_product_media_slots')) {
          const [contentId, slotKey, mediaId, altText, caption, publishedAt, publishedBy] = values;
          assignments.set(`${contentId}:${slotKey}`, { content_id: contentId, slot_key: slotKey, media_id: mediaId, alt_text: altText, caption, published_at: publishedAt, published_by: publishedBy });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('DELETE FROM cms_product_media_slots')) {
          const key = `${values[0]}:${values[1]}`; const existed = assignments.delete(key);
          return { meta: { changes: existed ? 1 : 0 } };
        }
        throw new Error(`Unexpected write: ${sql}`);
      },
    }; } }; },
  };
};

const create = (database, contentId = 'ssl-fusion', slotKey = 'card-artwork', mediaId = 'media-a', altText = 'A secure example image', caption = '') => upsertProductMediaAssignment({ database, contentId, slotKey, assignment: { mediaId, altText, caption }, subject: 'auth0|owner' });

test('supports only the approved individual product IDs and card/detail slots', () => {
  assert.deepEqual(PRODUCT_CONTENT_IDS, ['ssl-fusion', 'pultec-eqp-1a', 'folktek-resonant-garden', 'age-filter', 'age-drive', 'age-space', 'age-move', 'age-sample', 'daw-detectives', 'compare']);
  assert.equal(validateProductContentId('compare'), 'compare');
  assert.throws(() => validateProductContentId('tools'), /does not support/);
  assert.equal(validateProductMediaSlotKey('detail-hero'), 'detail-hero');
  assert.throws(() => validateProductMediaSlotKey('studio-hardware'), /not supported/);
});

test('reads a clean empty result and creates card and detail assignments independently', async () => {
  const database = makeDatabase();
  assert.deepEqual(await listProductMediaAssignments(database, 'ssl-fusion'), []);
  await create(database, 'ssl-fusion', 'card-artwork', 'media-a', 'Fusion card', 'Card caption');
  await create(database, 'ssl-fusion', 'detail-hero', 'media-b', 'Fusion hero');
  const result = await listProductMediaAssignments(database, 'ssl-fusion');
  assert.equal(result.length, 2);
  assert.equal(result.find((item) => item.slotKey === 'card-artwork').mediaId, 'media-a');
  assert.equal(result.find((item) => item.slotKey === 'detail-hero').mediaId, 'media-b');
  assert.equal(result[0].media.object_key, undefined);
  assert.equal(result[0].media.sha256, undefined);
});

test('replaces only one assignment and retains alt text/caption exactly', async () => {
  const database = makeDatabase();
  await create(database, 'ssl-fusion', 'card-artwork', 'media-a', 'Original artwork', 'Original caption');
  await create(database, 'ssl-fusion', 'detail-hero', 'media-a', 'Hero artwork');
  const changed = await create(database, 'ssl-fusion', 'card-artwork', 'media-b', 'Replacement artwork', '');
  assert.equal(changed.mediaId, 'media-b');
  assert.equal(changed.altText, 'Replacement artwork');
  assert.equal(changed.caption, '');
  const all = await listProductMediaAssignments(database, 'ssl-fusion');
  assert.equal(all.find((item) => item.slotKey === 'detail-hero').mediaId, 'media-a');
});

test('intentionally supports shared media across slots and products', async () => {
  const database = makeDatabase();
  await create(database, 'ssl-fusion', 'card-artwork');
  await create(database, 'ssl-fusion', 'detail-hero');
  await create(database, 'compare', 'card-artwork');
  assert.equal((await listProductMediaAssignments(database, 'ssl-fusion')).length, 2);
  assert.equal((await listProductMediaAssignments(database, 'compare'))[0].mediaId, 'media-a');
});

test('rejects unsupported assignments and inactive/nonexistent source media', async () => {
  const database = makeDatabase();
  await assert.rejects(create(database, 'plugins'), /does not support/);
  await assert.rejects(create(database, 'ssl-fusion', 'studio-hardware'), /not supported/);
  await assert.rejects(create(database, 'ssl-fusion', 'card-artwork', 'media-none'), /Only active/);
  await assert.rejects(create(database, 'ssl-fusion', 'card-artwork', 'media-orphaned'), /Only active/);
  await assert.rejects(create(database, 'ssl-fusion', 'card-artwork', 'media-deleted'), /Only active/);
  await assert.rejects(create(database, 'ssl-fusion', 'card-artwork', 'media-a', ''), /alt text/);
});

test('removal deletes only the assignment and leaves the underlying active media and other references intact', async () => {
  const database = makeDatabase();
  await create(database, 'ssl-fusion', 'card-artwork', 'media-a');
  await create(database, 'compare', 'card-artwork', 'media-a');
  assert.deepEqual(await removeProductMediaAssignment({ database, contentId: 'ssl-fusion', slotKey: 'card-artwork' }), { contentId: 'ssl-fusion', slotKey: 'card-artwork', removed: true });
  assert.equal(database.media.get('media-a').lifecycle_state, 'active');
  assert.equal((await listProductMediaAssignments(database, 'compare')).length, 1);
  await assert.rejects(removeProductMediaAssignment({ database, contentId: 'ssl-fusion', slotKey: 'card-artwork' }), /not found/);
});

test('owner API rejects an unauthenticated request before exposing assignments', async () => {
  const response = await listEndpoint({ request: new Request('https://remotemasterrack.com/api/admin/product-media/ssl-fusion'), env: {}, params: { contentId: 'ssl-fusion' } });
  assert.equal(response.status, 401);
});
test('assignment write rejects an authenticated non-owner before it can alter media references', async () => {
  const keyPair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  Object.assign(publicJwk, { kid: 'product-media-non-owner', use: 'sig' });
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'RS256', typ: 'JWT', kid: publicJwk.kid });
  const claims = encode({ iss: 'https://product-media-test.auth0.com/', aud: 'https://api.remotemasterrack.com', azp: 'rmr-native-client', sub: 'auth0|not-owner', scope: 'read:account', iat: now, exp: now + 300 });
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(`${header}.${claims}`));
  const token = `${header}.${claims}.${Buffer.from(signature).toString('base64url')}`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ keys: [publicJwk] });
  try {
    const response = await upsertEndpoint({
      request: new Request('https://remotemasterrack.com/api/admin/product-media/ssl-fusion/card-artwork', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ mediaId: 'media-a', altText: 'No access' }) }),
      env: { AUTH0_DOMAIN: 'product-media-test.auth0.com', AUTH0_API_AUDIENCE: 'https://api.remotemasterrack.com', AUTH0_DESKTOP_CLIENT_ID: 'rmr-native-client', CMS_OWNER_SUBJECTS: 'auth0|actual-owner', CONTENT_DB: makeDatabase() },
      params: { contentId: 'ssl-fusion', slotKey: 'card-artwork' },
    });
    assert.equal(response.status, 403);
  } finally { globalThis.fetch = originalFetch; }
});