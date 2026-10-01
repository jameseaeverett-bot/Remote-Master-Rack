import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ABOUT_PAGE_ID, normaliseAboutDocument } from '../functions/_lib/cms-about.js';

const mediaId = 'media-12345678-1234-1234-1234-123456789abc';
const document = () => ({
  hero: { eyebrow: 'ABOUT RMR', heading: 'About RMR', intro: 'A short lead.', mediaId, imageAltText: 'Studio image' },
  sections: { why: { eyebrow: '01', heading: 'Why RMR', body: 'Paragraph one.\n\nParagraph two.', mediaId: null, imageAltText: '' }, approach: { eyebrow: '02', heading: 'The RMR Approach', body: '', mediaId, imageAltText: 'Approach image' }, story: { eyebrow: '03', heading: 'The Story', body: '', mediaId: null, imageAltText: '' }, future: { eyebrow: '04', heading: 'Where RMR Is Going', body: '', mediaId: null, imageAltText: '' } },
  cta: { eyebrow: '', heading: 'Continue', body: '', primaryLabel: 'Login & Book', primaryDestination: '/login-book', secondaryLabel: '', secondaryDestination: '' }, visible: true,
});

test('About document is a fixed structured page with optional images and secondary CTA', () => {
  const result = normaliseAboutDocument(document());
  assert.equal(ABOUT_PAGE_ID, 'about');
  assert.equal(result.hero.mediaId, mediaId);
  assert.equal(result.sections[0].body, 'Paragraph one.\n\nParagraph two.');
  assert.equal(result.sections[1].altText, 'Approach image');
  assert.equal(result.cta.secondaryLabel, '');
});

test('About validation requires alt text only when an existing Media Library image is selected', () => {
  const missingAlt = document(); missingAlt.sections.approach.imageAltText = '';
  assert.throws(() => normaliseAboutDocument(missingAlt), /alt text/i);
  const incompleteButton = document(); incompleteButton.cta.primaryDestination = '';
  assert.throws(() => normaliseAboutDocument(incompleteButton), /provided together/i);
  const externalDestination = document(); externalDestination.cta.primaryDestination = 'https://example.test';
  assert.throws(() => normaliseAboutDocument(externalDestination), /RMR website path/i);
});

test('About migration uses the existing Content DB and Media Library references', async () => {
  const migration = await readFile(new URL('../migrations/content/0004_cms_about_page.sql', import.meta.url), 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS cms_about_pages/);
  assert.match(migration, /REFERENCES cms_media_assets/);
});
