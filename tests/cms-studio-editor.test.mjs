import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { normaliseStudioDocument, normaliseYouTubeUrl, STUDIO_PAGE_ID, STUDIO_SESSION_TYPES } from '../functions/_lib/cms-studio.js';

const mediaId = 'media-12345678-1234-1234-1234-123456789abc';
const document = () => ({ page: { title: 'The RMR Studio', intro: '', hardwareHeading: 'Remote Mastering Chain', hardwareIntro: '', softwareHeading: 'Software & Plugins', softwareSummary: '', visible: true, heroMediaId: mediaId, heroAltText: 'Studio overview' }, hardware: [{ id: 'studio-hardware-remote', catalogueHardwareId: 'catalogue-remote', publicName: 'Remote unit', manufacturer: 'Example', shortDescription: '', chainRationale: '', sessionType: 'remote', visible: true, mediaId, imageAltText: 'Remote hardware', videos: [] }, { id: 'studio-hardware-assisted', catalogueHardwareId: null, publicName: 'Assisted unit', manufacturer: 'Example', shortDescription: '', chainRationale: '', sessionType: 'assisted', visible: false, mediaId: null, imageAltText: '', videos: [] }], softwareGroups: [{ id: 'studio-software-example', displayName: 'Example group', description: '', visible: true, mediaId: null, imageAltText: '' }] });

test('Studio editor contract preserves remote and assisted categories and independent public metadata', () => {
  const result = normaliseStudioDocument(document());
  assert.equal(STUDIO_PAGE_ID, 'the-rmr-studio');
  assert.deepEqual(STUDIO_SESSION_TYPES, ['remote', 'assisted']);
  assert.equal(result.page.heroMediaId, mediaId);
  assert.deepEqual(result.hardware.map(item => item.sessionType), ['remote', 'assisted']);
  assert.equal(result.hardware[0].catalogueHardwareId, 'catalogue-remote');
  assert.equal(result.hardware[1].catalogueHardwareId, null);
  assert.equal(result.hardware[0].manufacturer, 'Example');
});

test('Studio editor contract validates media, videos, IDs, and controlled session types', () => {
  const invalid = document(); invalid.hardware[0].sessionType = 'uncontrolled';
  assert.throws(() => normaliseStudioDocument(invalid), /session type/i);
  const missingAlt = document(); missingAlt.page.heroAltText = '';
  assert.throws(() => normaliseStudioDocument(missingAlt), /alt text/i);
  const tooManyVideos = document(); tooManyVideos.hardware[0].videos = Array(4).fill({ url: 'https://youtu.be/dQw4w9WgXcQ' });
  assert.throws(() => normaliseStudioDocument(tooManyVideos), /three/i);
  assert.equal(normaliseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('Stage 4A migration adds Studio hero, independent public hardware metadata, and software groups only', async () => {
  const sql = await readFile(new URL('../migrations/content/0003_cms_studio_editor.sql', import.meta.url), 'utf8');
  for (const field of ['hero_media_id', 'hero_alt_text', 'manufacturer', 'catalogue_hardware_id']) assert.match(sql, new RegExp(field));
  assert.match(sql, /CREATE TABLE IF NOT EXISTS cms_studio_software_groups/);
  assert.match(sql, /idx_cms_studio_software_groups_public/);
  assert.doesNotMatch(sql, /customer_content/);
});
