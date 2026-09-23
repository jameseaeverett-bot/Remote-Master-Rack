import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { publicStudioProjection } from '../functions/_lib/public-studio.js';
import { normalisePublicStudio } from '../studio-page.js';

const media = (id = 'media-11111111-1111-1111-1111-111111111111') => ({ id, revision: 'a'.repeat(16) });
const studio = () => ({
  page: { title: 'The RMR Studio', intro: 'A working studio.', hardwareHeading: 'Remote Mastering Chain', hardwareIntro: 'Recallable path.', softwareHeading: 'Software & Plugins', softwareSummary: 'Useful tools.', visible: true, heroMedia: media(), heroAltText: 'Studio overview' },
  hardware: [
    { id: 'studio-mammut', catalogueHardwareId: 'hardware-mammut', publicName: 'Mammut', manufacturer: 'Elysia', shortDescription: 'Public Mammut copy.', chainRationale: 'Curated chain rationale.', sessionType: 'remote', visible: true, media: media('media-22222222-2222-2222-2222-222222222222'), imageAltText: 'Mammut hardware', imageCaption: 'A caption', videos: [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Mammut overview', caption: '' }] },
    { id: 'studio-assisted', catalogueHardwareId: 'hardware-assisted', publicName: 'Assisted unit', manufacturer: 'Example', shortDescription: '', chainRationale: '', sessionType: 'assisted', visible: true, media: null, imageAltText: '', imageCaption: '', videos: [] },
    { id: 'studio-hidden', catalogueHardwareId: 'hardware-hidden', publicName: 'Hidden unit', manufacturer: 'Example', shortDescription: '', chainRationale: '', sessionType: 'remote', visible: false, media: null, imageAltText: '', imageCaption: '', videos: [] },
  ],
  softwareGroups: [{ id: 'studio-software', displayName: 'RMR Tools', description: 'Public tools.', visible: true, media: null, imageAltText: '' }],
});

test('published Studio projection keeps presentation data, revisioned media and safe videos only', () => {
  const value = publicStudioProjection(studio());
  assert.equal(value.hardware.length, 2);
  assert.equal(value.hardware[0].publicName, 'Mammut');
  assert.equal(value.hardware[0].image.revision, 'a'.repeat(16));
  assert.equal(value.hardware[0].videos[0].youtubeVideoId, 'dQw4w9WgXcQ');
  assert.equal(JSON.stringify(value).includes('catalogueHardwareId'), false);
  assert.equal(JSON.stringify(value).includes('lifecycleState'), false);
  assert.equal(JSON.stringify(value).includes('object_key'), false);
});

test('page visibility, empty optional sections, invalid videos and malformed CMS responses fail gracefully', () => {
  const hidden = studio(); hidden.page.visible = false;
  assert.equal(publicStudioProjection(hidden), null);
  const value = studio(); value.hardware[0].videos = [{ url: 'https://example.com/not-youtube', title: 'Unsafe' }]; value.hardware[1].visible = false; value.softwareGroups = [];
  const client = normalisePublicStudio(publicStudioProjection(value));
  assert.deepEqual(client.hardware.filter(item => item.sessionType === 'assisted'), []);
  assert.equal(client.hardware[0].videos.length, 0);
  assert.deepEqual(client.softwareGroups, []);
  assert.equal(normalisePublicStudio(null), null);
});

test('Studio page uses the generic revisioned media route and safe YouTube embeds without an empty public state', async () => {
  const [source, page] = await Promise.all([
    readFile(new URL('../studio-page.js', import.meta.url), 'utf8'),
    readFile(new URL('../the-rmr-studio.html', import.meta.url), 'utf8'),
  ]);
  assert.match(source, /\/media\/\$\{encodeURIComponent\(item\.mediaId\)\}/);
  assert.match(source, /www\.youtube-nocookie\.com\/embed/);
  assert.match(source, /studioYouTubeId/);
  assert.doesNotMatch(source, /innerHTML/);
  assert.match(page, /studio-section--assisted/);
});
