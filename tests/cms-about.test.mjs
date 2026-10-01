import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ABOUT_PAGE_ID, normaliseAboutDocument } from '../functions/_lib/cms-about.js';
import { publicAboutProjection } from '../functions/_lib/public-about.js';

const mediaId = 'media-12345678-1234-1234-1234-123456789abc';
const document = () => ({
  image: { mediaId, imageAltText: 'Studio image' }, heading: 'About RMR', intro: 'A short lead.', paragraphs: [{ id: 'first', body: 'Paragraph one.' }, { id: 'second', body: 'Paragraph two.' }], profile: { label: 'James Everett Music', url: 'https://jameseverettmusic.example/' }, visible: true,
});

test('About document is an ordered long-form article with one optional image and profile link', () => {
  const result = normaliseAboutDocument(document());
  assert.equal(ABOUT_PAGE_ID, 'about');
  assert.equal(result.image.mediaId, mediaId);
  assert.deepEqual(result.paragraphs.map(item => item.body), ['Paragraph one.', 'Paragraph two.']);
  assert.equal(result.profile.label, 'James Everett Music');
});

test('About validation retains image accessibility and permits only safe external profile links', () => {
  const missingAlt = document(); missingAlt.image.imageAltText = '';
  assert.throws(() => normaliseAboutDocument(missingAlt), /alt text/i);
  const incompleteLink = document(); incompleteLink.profile.url = '';
  assert.throws(() => normaliseAboutDocument(incompleteLink), /provided together/i);
  const insecureLink = document(); insecureLink.profile.url = 'http://example.test';
  assert.throws(() => normaliseAboutDocument(insecureLink), /HTTPS/i);
});

test('About article migration is additive and retains Media Library references', async () => {
  const migration = await readFile(new URL('../migrations/content/0005_cms_about_article.sql', import.meta.url), 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS cms_about_articles/);
  assert.match(migration, /cms_about_article_paragraphs/);
  assert.match(migration, /REFERENCES cms_media_assets/);
});

test('public About projection exposes only visible presentation fields and revisioned media', () => {
  const source = document();
  source.image.media = { id: mediaId, revision: '0123456789abcdef', lifecycleState: 'active', sha256: 'private' };
  const result = publicAboutProjection(source);
  assert.equal(result.heading, 'About RMR');
  assert.deepEqual(result.image, { mediaId, revision: '0123456789abcdef', altText: 'Studio image' });
  assert.deepEqual(result.paragraphs, ['Paragraph one.', 'Paragraph two.']);
  assert.equal(JSON.stringify(result).includes('sha256'), false);
  assert.equal(publicAboutProjection({ ...source, visible: false }), null);
});

test('About page consumes the existing CMS extension and uses revisioned public media URLs', async () => {
  const page = await readFile(new URL('../about-page.js', import.meta.url), 'utf8');
  assert.match(page, /getExtension\('cmsV2'\).*\.about/);
  assert.match(page, /about\.paragraphs/);
  assert.match(page, /\/media\/\$\{encodeURIComponent\(asset\.mediaId\)\}/);
  assert.match(page, /encodeURIComponent\(asset\.revision\)/);
  assert.match(page, /target\.replaceChildren/);
});
