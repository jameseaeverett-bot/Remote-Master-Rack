import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  CMS_V2_SCHEMA_VERSION,
  normaliseCmsV2Document,
  normaliseCmsV2MediaMetadata,
  normaliseCmsV2ProductMediaSlot,
  publicCmsV2Projection,
} from '../functions/_lib/content-v2.js';
import { CONTENT_SCHEMA_VERSION, normaliseContentRecords } from '../functions/_lib/content.js';

const image = {
  id: 'media-ngbuscomp-hero', originalFilename: 'ngbuscomp.webp', contentType: 'image/webp',
  fileSizeBytes: 1024, width: 1600, height: 900,
  sha256: 'a'.repeat(64), defaultAltText: 'Example image', defaultCaption: '',
};

const document = {
  version: CMS_V2_SCHEMA_VERSION,
  studio: { id: 'the-rmr-studio', title: '', intro: 'A studio introduction.' },
  productMedia: [{ contentId: 'ssl-fusion', slotKey: 'card-artwork', mediaId: image.id, altText: 'Fusion artwork', caption: '' }],
  studioHardware: [{
    id: 'studio-hardware-example', displayName: 'Example hardware', displayOrder: 0, sessionType: 'assisted',
    mediaId: image.id, imageAltText: 'Example hardware front panel', imageCaption: '', description: '', chainRationale: 'Owner-assisted use only.',
    videos: [{ videoId: 'dQw4w9WgXcQ', displayOrder: 0, title: '', caption: '' }],
  }],
};

test('CMS V2 preserves controlled remote and assisted hardware categories', () => {
  const result = normaliseCmsV2Document({ ...document, studioHardware: [
    { ...document.studioHardware[0], sessionType: 'remote', id: 'studio-hardware-remote', displayOrder: 1 },
    document.studioHardware[0],
  ] });
  assert.deepEqual(result.studioHardware.map((item) => item.sessionType), ['assisted', 'remote']);
  assert.throws(() => normaliseCmsV2Document({ ...document, studioHardware: [{ ...document.studioHardware[0], sessionType: 'hybrid' }] }), /session type/);
});

test('CMS V2 supports only approved typed media slots and preserves explicit blanks', () => {
  assert.deepEqual(normaliseCmsV2ProductMediaSlot(document.productMedia[0]), document.productMedia[0]);
  assert.throws(() => normaliseCmsV2ProductMediaSlot({ ...document.productMedia[0], slotKey: 'freeform-banner' }), /slot key/);
  assert.equal(normaliseCmsV2Document(document).studio.title, '');
});

test('CMS V2 media contract enforces image policy metadata', () => {
  assert.equal(normaliseCmsV2MediaMetadata(image).contentType, 'image/webp');
  assert.throws(() => normaliseCmsV2MediaMetadata({ ...image, contentType: 'image/svg+xml' }), /content type/);
  assert.throws(() => normaliseCmsV2MediaMetadata({ ...image, width: 6001 }), /width/);
});

test('CMS V2 limits and orders YouTube records per hardware item', () => {
  const videos = [0, 1, 2].map((displayOrder) => ({ videoId: `abcdefghij${displayOrder}`, displayOrder }));
  assert.equal(normaliseCmsV2Document({ ...document, studioHardware: [{ ...document.studioHardware[0], videos }] }).studioHardware[0].videos.length, 3);
  assert.throws(() => normaliseCmsV2Document({ ...document, studioHardware: [{ ...document.studioHardware[0], videos: [...videos, { videoId: 'abcdefghijZ', displayOrder: 2 }] }] }), /videos/);
});

test('CMS V2 public projection contains no storage or owner metadata', () => {
  const projection = publicCmsV2Projection(document);
  assert.deepEqual(projection, normaliseCmsV2Document(document));
  assert.equal(JSON.stringify(projection).includes('objectKey'), false);
  assert.equal(JSON.stringify(projection).includes('sha256'), false);
  assert.equal(JSON.stringify(projection).includes('publishedBy'), false);
});

test('CMS V1 remains unchanged and continues to preserve explicit blank text', () => {
  assert.equal(CONTENT_SCHEMA_VERSION, 1);
  assert.deepEqual(normaliseContentRecords([{ id: 'ssl-fusion', fields: { cardDescription: '' } }]), [{ id: 'ssl-fusion', fields: { cardDescription: '' } }]);
});

test('CMS V2 migration declares typed tables, enums, indexes, and video-limit triggers', async () => {
  const sql = await readFile(new URL('../migrations/content/0002_cms_v2_structured_content.sql', import.meta.url), 'utf8');
  for (const table of ['cms_media_assets', 'cms_product_media_slots', 'cms_studio_pages', 'cms_studio_hardware_items', 'cms_studio_hardware_videos']) assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(sql, /slot_key IN \('card-artwork', 'detail-hero', 'studio-hardware'\)/);
  assert.match(sql, /session_type IN \('remote', 'assisted'\)/);
  assert.match(sql, /cms_studio_hardware_videos_limit_insert/);
  assert.match(sql, /cms_studio_hardware_videos_limit_move/);
  assert.match(sql, /idx_cms_studio_hardware_public/);
});
