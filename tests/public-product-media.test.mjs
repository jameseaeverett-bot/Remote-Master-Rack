import assert from 'node:assert/strict';
import test from 'node:test';
import { publicProductMediaAssignment, publicProductMediaProjection } from '../functions/_lib/public-product-media.js';
import { onRequestGet as contentEndpoint } from '../functions/api/content.js';

const row = (contentId = 'daw-detectives', slotKey = 'card-artwork', overrides = {}) => ({
  content_id: contentId, slot_key: slotKey, media_id: 'media-11111111-1111-1111-1111-111111111111',
  sha256: 'a'.repeat(64), alt_text: 'A customer-facing test image', caption: 'Optional caption', ...overrides,
});

const makeDatabase = ({ mediaRows = [], failMedia = false } = {}) => ({
  prepare(sql) {
    return {
      bind() { return this; },
      async all() {
        if (sql.includes('customer_content')) return { results: [{ content_id: 'daw-detectives', content_json: JSON.stringify({ title: 'DAW Detectives' }) }] };
        if (failMedia) throw new Error('CMS V2 media unavailable');
        return { results: mediaRows };
      },
    };
  },
});

test('public projection exposes only safe revisioned product-media fields for all supported products', () => {
  const ids = ['ssl-fusion','pultec-eqp-1a','folktek-resonant-garden','age-filter','age-drive','age-space','age-move','age-sample','daw-detectives','compare'];
  const projection = publicProductMediaProjection(ids.map((id) => row(id)));
  assert.deepEqual(projection.map((entry) => entry.contentId), ids);
  assert.deepEqual(Object.keys(projection[0]), ['contentId','slotKey','mediaId','revision','altText','caption']);
  assert.equal(projection[0].revision, 'a'.repeat(16));
  assert.equal(JSON.stringify(projection).includes('sha256'), false);
  assert.equal(JSON.stringify(projection).includes('object_key'), false);
  assert.equal(JSON.stringify(projection).includes('lifecycle'), false);
});

test('public projection rejects malformed, unsupported, or non-public product-media assignments', () => {
  assert.equal(publicProductMediaAssignment(row('tools')), null);
  assert.equal(publicProductMediaAssignment(row('compare', 'studio-hardware')), null);
  assert.equal(publicProductMediaAssignment(row('compare', 'card-artwork', { media_id: '../private-key' })), null);
  assert.equal(publicProductMediaAssignment(row('compare', 'card-artwork', { sha256: 'not-a-checksum' })), null);
  assert.equal(publicProductMediaAssignment(row('compare', 'card-artwork', { alt_text: '' })), null);
});

test('api content keeps CMS V1 intact while adding a safe CMS V2 product-media extension', async () => {
  const response = await contentEndpoint({ env: { CONTENT_DB: makeDatabase({ mediaRows: [row('daw-detectives', 'card-artwork'), row('daw-detectives', 'detail-hero', { sha256: 'b'.repeat(64) })] }) } });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.version, 1);
  assert.deepEqual(payload.records, { 'daw-detectives': { title: 'DAW Detectives' } });
  assert.deepEqual(payload.extensions.cmsV2.productMedia.map((entry) => [entry.contentId, entry.slotKey, entry.revision]), [['daw-detectives','card-artwork','aaaaaaaaaaaaaaaa'], ['daw-detectives','detail-hero','bbbbbbbbbbbbbbbb']]);
});

test('api content preserves CMS V1 when the optional CMS V2 media lookup fails', async () => {
  const response = await contentEndpoint({ env: { CONTENT_DB: makeDatabase({ failMedia: true }) } });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.records['daw-detectives'].title, 'DAW Detectives');
  assert.deepEqual(payload.extensions.cmsV2.productMedia, []);
});