import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTENT_SCHEMA_VERSION,
  normaliseContentRecords,
  publicContentProjection,
} from '../functions/_lib/content.js';

test('CMS contract accepts stable IDs and field-level text', () => {
  const records = normaliseContentRecords([{ id: 'daw-detectives', fields: { cardDescription: 'Updated description.' } }]);
  assert.deepEqual(records, [{ id: 'daw-detectives', fields: { cardDescription: 'Updated description.' } }]);
});

test('CMS contract rejects unknown IDs and fields', () => {
  assert.throws(() => normaliseContentRecords([{ id: 'unknown-product', fields: { title: 'No.' } }]));
  assert.throws(() => normaliseContentRecords([{ id: 'compare', fields: { html: '<b>Not supported</b>' } }]));
});

test('public projection returns published text only in the versioned shape', () => {
  assert.deepEqual(publicContentProjection([{ content_id: 'compare', content_json: JSON.stringify({ title: 'COMPARE' }) }]), {
    version: CONTENT_SCHEMA_VERSION,
    records: { compare: { title: 'COMPARE' } },
  });
});
