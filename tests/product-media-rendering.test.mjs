import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../product-media.js', import.meta.url), 'utf8');

const createClient = () => {
  const images = [];
  class MockImage {
    constructor() { images.push(this); this.classList = { add() {} }; }
    triggerLoad() { this.onload?.(); }
    triggerError() { this.onerror?.(); }
  }
  const window = {};
  vm.runInNewContext(source, { window, Image: MockImage });
  return { client: window.RMRProductMedia, images };
};
const element = () => ({
  dataset: {}, children: [], attributes: { 'aria-hidden': 'true' },
  classList: { values: new Set(), add(value) { this.values.add(value); }, remove(value) { this.values.delete(value); } },
  replaceChildren(...children) { this.children = children; },
  setAttribute(name, value) { this.attributes[name] = value; },
  removeAttribute(name) { delete this.attributes[name]; },
});
const assignment = (contentId, slotKey, revision = 'a'.repeat(16)) => ({
  contentId, slotKey, mediaId: 'media-11111111-1111-1111-1111-111111111111', revision,
  altText: `${contentId} ${slotKey} artwork`, caption: 'Not used as alt text',
});

test('generic client resolves independent card and detail assignments for DAW Detectives and COMPARE', () => {
  const { client } = createClient();
  client.setAssignments([assignment('daw-detectives', 'card-artwork'), assignment('daw-detectives', 'detail-hero', 'b'.repeat(16)), assignment('compare', 'card-artwork', 'c'.repeat(16))]);
  assert.equal(client.urlFor(client.get('daw-detectives', 'card-artwork')), '/media/media-11111111-1111-1111-1111-111111111111/aaaaaaaaaaaaaaaa');
  assert.equal(client.get('daw-detectives', 'detail-hero').revision, 'b'.repeat(16));
  assert.equal(client.get('compare', 'card-artwork').revision, 'c'.repeat(16));
  assert.equal(client.get('compare', 'detail-hero'), null);
});

test('successful image loading replaces built-in artwork with the assigned alt text', () => {
  const { client, images } = createClient(); const visual = element();
  client.setAssignments([assignment('daw-detectives', 'card-artwork')]);
  assert.equal(client.apply(visual, 'daw-detectives', 'card-artwork', () => { throw new Error('Should not fall back before an image error.'); }), true);
  images[0].triggerLoad();
  assert.equal(visual.children[0], images[0]);
  assert.equal(images[0].alt, 'daw-detectives card-artwork artwork');
  assert.equal(visual.classList.values.has('has-cms-media'), true);
  assert.equal(visual.attributes['aria-hidden'], undefined);
});

test('detached gallery preloads eagerly so Chromium can fire onload before insertion', () => {
  const { client, images } = createClient(); const visual = element();
  client.setAssignments([assignment('daw-detectives', 'card-artwork')]);
  client.apply(visual, 'daw-detectives', 'card-artwork', () => {});
  assert.equal(images[0].loading, 'eager');
  assert.equal(visual.children.length, 0);
  images[0].triggerLoad();
  assert.equal(visual.children[0], images[0]);
});

test('card and detail slots remain independent and use their own assigned alt text', () => {
  const { client, images } = createClient(); const cardVisual = element(); const detailVisual = element();
  client.setAssignments([
    assignment('daw-detectives', 'card-artwork', 'a'.repeat(16)),
    assignment('daw-detectives', 'detail-hero', 'b'.repeat(16)),
  ]);
  client.apply(cardVisual, 'daw-detectives', 'card-artwork', () => {});
  client.apply(detailVisual, 'daw-detectives', 'detail-hero', () => {});
  images[0].triggerLoad(); images[1].triggerLoad();
  assert.equal(images[0].src.endsWith('/aaaaaaaaaaaaaaaa'), true);
  assert.equal(images[1].src.endsWith('/bbbbbbbbbbbbbbbb'), true);
  assert.equal(images[0].alt, 'daw-detectives card-artwork artwork');
  assert.equal(images[1].alt, 'daw-detectives detail-hero artwork');
});
test('missing, malformed, and failed media assignments preserve the existing fallback artwork', () => {
  const { client, images } = createClient(); const visual = element(); let fallbackCalls = 0;
  client.setAssignments([assignment('daw-detectives', 'card-artwork', 'invalid')]);
  assert.equal(client.apply(visual, 'daw-detectives', 'card-artwork', () => { fallbackCalls += 1; }), false);
  client.setAssignments([assignment('daw-detectives', 'card-artwork')]);
  client.apply(visual, 'daw-detectives', 'card-artwork', () => { fallbackCalls += 1; });
  images[0].triggerError();
  assert.equal(fallbackCalls, 1);
});

test('renderer uses revisioned public URLs and explicit onload/onerror fallback behaviour', () => {
  assert.match(source, /\/media\/\$\{encodeURIComponent\(assignment\.mediaId\)\}\/\$\{encodeURIComponent\(assignment\.revision\)\}/);
  assert.match(source, /image\.onload/);
  assert.match(source, /image\.onerror/);
  assert.doesNotMatch(source, /object_key|sha256|preview/);
});
test('all public galleries and existing product detail views request the generic CMS slots', () => {
  const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  for (const script of ['../vst-editors.js','../age-series.js','../tools-data.js']) assert.match(read(script), /'card-artwork'/);
  for (const script of ['../editor-detail.js','../tools-data.js']) assert.match(read(script), /'detail-hero'/);
  for (const page of ['../plugins/vst-editors.html','../plugins/age-series.html','../tools.html','../tools/daw-detectives.html','../tools/compare.html','../plugins/vst-editors/ssl-fusion.html','../plugins/vst-editors/pultec-eqp-1a.html','../plugins/vst-editors/folktek-resonant-garden.html']) assert.match(read(page), /product-media\.js/);
});
