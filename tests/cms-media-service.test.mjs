import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CMS_MEDIA_ORPHAN_RETENTION_DAYS,
  cmsMediaRevision,
  retireCmsMedia,
  uploadCmsMedia,
  validateCmsImageBytes,
} from '../functions/_lib/cms-media.js';
import { CMS_V2_MEDIA_LIMITS } from '../functions/_lib/content-v2.js';
import { onRequestPost as uploadMediaEndpoint } from '../functions/api/admin/media/index.js';
import { onRequestGet as deliverMediaEndpoint } from '../functions/media/[id]/[revision].js';

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const uint32be = (value) => Uint8Array.of(value >>> 24, value >>> 16, value >>> 8, value);
const concat = (...values) => Uint8Array.from(values.flatMap((value) => [...value]));
const pngChunk = (type, payload = new Uint8Array()) => {
  const typeBytes = new TextEncoder().encode(type);
  return concat(uint32be(payload.length), typeBytes, payload, uint32be(crc32(concat(typeBytes, payload))));
};
const png = (width = 32, height = 24) => concat(
  Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
  pngChunk('IHDR', concat(uint32be(width), uint32be(height), Uint8Array.of(8, 6, 0, 0, 0))),
  pngChunk('IDAT', Uint8Array.of(120, 1, 1, 0, 0, 255, 255, 0, 0, 0, 1)),
  pngChunk('IEND'),
);
const jpeg = (width = 32, height = 24) => Uint8Array.of(
  0xff, 0xd8,
  0xff, 0xc0, 0, 11, 8, height >>> 8, height, width >>> 8, width, 1, 1, 0x11, 0,
  0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0,
  0,
  0xff, 0xd9,
);
const webp = (width = 32, height = 24) => {
  const payload = Uint8Array.of(0, 0, 0, 0, (width - 1), (width - 1) >>> 8, (width - 1) >>> 16, (height - 1), (height - 1) >>> 8, (height - 1) >>> 16);
  const total = 12 + 8 + payload.length;
  const result = new Uint8Array(total);
  result.set(new TextEncoder().encode('RIFF'), 0);
  new DataView(result.buffer).setUint32(4, total - 8, true);
  result.set(new TextEncoder().encode('WEBPVP8X'), 8);
  new DataView(result.buffer).setUint32(16, payload.length, true);
  result.set(payload, 20);
  return result;
};

const makeR2 = () => {
  const objects = new Map();
  const calls = [];
  return {
    objects,
    calls,
    async put(key, value, options) {
      calls.push({ operation: 'put', key, options });
      if (objects.has(key)) throw new Error('Object already exists.');
      objects.set(key, { body: Uint8Array.from(value), options });
    },
    async get(key) { calls.push({ operation: 'get', key }); return objects.get(key) || null; },
    async delete(key) { calls.push({ operation: 'delete', key }); objects.delete(key); },
  };
};

const makeDatabase = () => {
  const media = new Map();
  const references = new Map();
  return {
    media,
    references,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() {
              if (sql.includes('INSERT INTO cms_media_assets')) {
                const [id, objectKey, originalFilename, contentType, fileSizeBytes, width, height, pixelCount, sha256, defaultAltText, defaultCaption, createdBy] = values;
                media.set(id, {
                  id, object_key: objectKey, original_filename: originalFilename, content_type: contentType,
                  file_size_bytes: fileSizeBytes, width, height, pixel_count: pixelCount, sha256,
                  default_alt_text: defaultAltText, default_caption: defaultCaption,
                  lifecycle_state: 'active', created_by: createdBy, updated_by: createdBy,
                  created_at: '2026-09-21T12:00:00.000Z', updated_at: '2026-09-21T12:00:00.000Z', orphaned_at: null,
                });
                return { success: true };
              }
              if (sql.includes("SET lifecycle_state='deleted'")) {
                const [updatedAt, updatedBy, id] = values;
                Object.assign(media.get(id), { lifecycle_state: 'deleted', updated_at: updatedAt, updated_by: updatedBy });
                return { success: true };
              }
              if (sql.includes("SET lifecycle_state='orphaned'")) {
                const [orphanedAt, updatedAt, updatedBy, id] = values;
                Object.assign(media.get(id), { lifecycle_state: 'orphaned', orphaned_at: orphanedAt, updated_at: updatedAt, updated_by: updatedBy });
                return { success: true };
              }
              throw new Error(`Unexpected write query: ${sql}`);
            },
            async first() {
              if (sql.includes('product_references')) {
                const counts = references.get(values[0]) || { product: 0, hardware: 0 };
                return { product_references: counts.product, hardware_references: counts.hardware };
              }
              const row = media.get(values[0]);
              if (!row) return null;
              if (sql.includes("m.lifecycle_state='active'")) {
                const counts = references.get(values[0]) || { product: 0, hardware: 0 };
                return row.lifecycle_state === 'active' && counts.product + counts.hardware > 0 ? row : null;
              }
              return row;
            },
            async all() { return { results: [...media.values()] }; },
          };
        },
        async all() { return { results: [...media.values()] }; },
      };
    },
  };
};

const expectStatus = async (promise, status, pattern) => assert.rejects(promise, (error) => error.status === status && pattern.test(error.message));

test('byte validation accepts genuine JPEG, PNG and WebP dimensions', () => {
  assert.deepEqual(validateCmsImageBytes(jpeg(300, 200), 'photo.jpg', 'image/jpeg').width, 300);
  assert.deepEqual(validateCmsImageBytes(png(640, 480), 'art.png', 'image/png').height, 480);
  assert.deepEqual(validateCmsImageBytes(webp(1920, 1080), 'hero.webp', 'image/webp').width, 1920);
});

test('byte validation rejects spoofing, unsupported, malformed and excessive images', async () => {
  assert.throws(() => validateCmsImageBytes(new TextEncoder().encode('<svg/>'), 'fake.png', 'image/png'), /not a supported image/);
  assert.throws(() => validateCmsImageBytes(png(), 'fake.jpg', 'image/png'), /extension does not match/);
  assert.throws(() => validateCmsImageBytes(png(), 'fake.png', 'image/jpeg'), /type does not match/);
  assert.throws(() => validateCmsImageBytes(png(6001, 1), 'wide.png', 'image/png'), /dimensions are too large/);
  assert.throws(() => validateCmsImageBytes(png(5000, 5000), 'pixels.png', 'image/png'), /dimensions are too large/);
  const corrupt = png();
  corrupt[corrupt.length - 1] ^= 1;
  assert.throws(() => validateCmsImageBytes(corrupt, 'corrupt.png', 'image/png'), /malformed or truncated/);
  assert.throws(() => validateCmsImageBytes(jpeg().slice(0, -2), 'truncated.jpg', 'image/jpeg'), /malformed or truncated/);
  assert.throws(() => validateCmsImageBytes(webp().slice(0, -1), 'truncated.webp', 'image/webp'), /malformed or truncated/);
  const oversized = new Uint8Array(CMS_V2_MEDIA_LIMITS.maxBytes + 1);
  await expectStatus(Promise.resolve().then(() => validateCmsImageBytes(oversized, 'huge.png', 'image/png')), 413, /too large/);
});

test('upload uses generated immutable keys and persists private metadata without returning it', async () => {
  const database = makeDatabase();
  const bucket = makeR2();
  const media = await uploadCmsMedia({
    database, bucket,
    file: new File([png()], '../../owner-chosen-name.png', { type: 'image/png' }),
    defaultAltText: 'A test image', defaultCaption: 'Test only', subject: 'auth0|owner',
  });
  assert.match(media.id, /^media-[0-9a-f-]{36}$/);
  assert.match(media.revision, /^[a-f0-9]{16}$/);
  assert.equal(media.sha256, undefined);
  const row = database.media.get(media.id);
  assert.match(row.object_key, new RegExp(`^cms-media/${media.id}/[a-f0-9]{16}\\.png$`));
  assert.equal(row.original_filename, '.._.._owner-chosen-name.png');
  assert.equal(bucket.calls[0].options.onlyIf.etagDoesNotMatch, '*');
  assert.equal(bucket.calls[0].key.includes('owner-chosen-name'), false);
});

test('owner media upload rejects unauthenticated and authenticated non-owner requests', async () => {
  const unauthenticated = await uploadMediaEndpoint({
    request: new Request('https://remotemasterrack.com/api/admin/media', { method: 'POST' }), env: {},
  });
  assert.equal(unauthenticated.status, 401);

  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1), hash: 'SHA-256' },
    true, ['sign', 'verify'],
  );
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  Object.assign(publicJwk, { kid: 'cms-media-non-owner', use: 'sig' });
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'RS256', typ: 'JWT', kid: publicJwk.kid });
  const claims = encode({
    iss: 'https://cms-media-test.auth0.com/', aud: 'https://api.remotemasterrack.com', azp: 'rmr-native-client',
    sub: 'auth0|not-owner', scope: 'read:account', iat: now, exp: now + 300,
  });
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(`${header}.${claims}`));
  const token = `${header}.${claims}.${Buffer.from(signature).toString('base64url')}`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ keys: [publicJwk] });
  try {
    const request = new Request('https://remotemasterrack.com/api/admin/media', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    const response = await uploadMediaEndpoint({ request, env: {
      AUTH0_DOMAIN: 'cms-media-test.auth0.com', AUTH0_API_AUDIENCE: 'https://api.remotemasterrack.com',
      AUTH0_DESKTOP_CLIENT_ID: 'rmr-native-client', CMS_OWNER_SUBJECTS: 'auth0|actual-owner',
    } });
    assert.equal(response.status, 403);
    const missingBinding = await uploadMediaEndpoint({ request: new Request('https://remotemasterrack.com/api/admin/media', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    }), env: {
      AUTH0_DOMAIN: 'cms-media-test.auth0.com', AUTH0_API_AUDIENCE: 'https://api.remotemasterrack.com',
      AUTH0_DESKTOP_CLIENT_ID: 'rmr-native-client', CMS_OWNER_SUBJECTS: 'auth0|not-owner',
    } });
    assert.equal(missingBinding.status, 503);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('public delivery is D1-reference gated, immutable, conditional and cannot address arbitrary R2 keys', async () => {
  const database = makeDatabase();
  const bucket = makeR2();
  const media = await uploadCmsMedia({ database, bucket, file: new File([png()], 'public.png', { type: 'image/png' }), subject: 'auth0|owner' });
  const context = (headers = {}, params = { id: media.id, revision: media.revision }) => ({
    request: new Request(`https://remotemasterrack.com/media/${params.id}/${params.revision}`, { headers }),
    env: { CONTENT_DB: database, CMS_MEDIA: bucket }, params,
  });
  assert.equal((await deliverMediaEndpoint(context())).status, 404);
  database.references.set(media.id, { product: 1, hardware: 0 });
  const delivered = await deliverMediaEndpoint(context());
  assert.equal(delivered.status, 200);
  assert.equal(delivered.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
  assert.equal(delivered.headers.get('ETag'), `"${database.media.get(media.id).sha256}"`);
  assert.equal((await deliverMediaEndpoint(context({ 'If-None-Match': delivered.headers.get('ETag') }))).status, 304);
  const getsBefore = bucket.calls.filter((call) => call.operation === 'get').length;
  assert.equal((await deliverMediaEndpoint(context({}, { id: '..-private-key', revision: media.revision }))).status, 404);
  assert.equal(bucket.calls.filter((call) => call.operation === 'get').length, getsBefore);
  database.media.get(media.id).lifecycle_state = 'orphaned';
  assert.equal((await deliverMediaEndpoint(context())).status, 404);
});

test('retirement protects references and requires an explicit 30-day orphan purge', async () => {
  const database = makeDatabase();
  const bucket = makeR2();
  const media = await uploadCmsMedia({ database, bucket, file: new File([png()], 'lifecycle.png', { type: 'image/png' }), subject: 'auth0|owner' });
  database.references.set(media.id, { product: 0, hardware: 1 });
  await expectStatus(retireCmsMedia({ database, bucket, mediaId: media.id, subject: 'auth0|owner' }), 409, /Referenced media/);
  database.references.set(media.id, { product: 0, hardware: 0 });
  const orphanedAt = new Date('2026-09-21T12:00:00.000Z');
  const orphaned = await retireCmsMedia({ database, bucket, mediaId: media.id, subject: 'auth0|owner', now: orphanedAt });
  assert.equal(orphaned.lifecycleState, 'orphaned');
  assert.equal(bucket.calls.some((call) => call.operation === 'delete'), false);
  await expectStatus(retireCmsMedia({ database, bucket, mediaId: media.id, subject: 'auth0|owner', purge: true, now: new Date('2026-10-20T12:00:00.000Z') }), 409, /retention period/);
  const purged = await retireCmsMedia({ database, bucket, mediaId: media.id, subject: 'auth0|owner', purge: true, now: new Date(`2026-10-${21 + (CMS_MEDIA_ORPHAN_RETENTION_DAYS - 30)}T12:00:00.000Z`) });
  assert.equal(purged.lifecycleState, 'deleted');
  assert.equal(database.media.get(media.id).lifecycle_state, 'deleted');
  assert.equal(bucket.calls.some((call) => call.operation === 'delete'), true);
});
