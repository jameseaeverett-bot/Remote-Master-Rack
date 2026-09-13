import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, sha256, validateKnowledge, validateSource } from '../functions/_lib/dd-crash-intelligence.js';

const reviewedKnowledge = {
  id: 'example-access-violation', title: 'Example access violation', platforms: ['windows'],
  dawApplicability: [{ dawId: 'cubase', versionMin: '13', versionMax: '' }],
  exceptionCode: '0xC0000005', canonicalName: 'Access violation',
  plainEnglishMeaning: 'The process attempted an invalid memory access.',
  eventType: 'application-crash', faultModules: ['example.dll'], pluginVendorEvidence: [], causeCategories: ['process-crash'],
  safeGuidance: 'Save work if possible, note the circumstances, then investigate from supported evidence.',
  confidence: 'medium', evidenceStatus: 'provisional', sourceIds: ['official-example'], publicationState: 'approved',
};

test('canonical JSON has deterministic recursive key ordering', async () => {
  const first = canonicalJson({ z: [{ b: 2, a: 1 }], a: true });
  const second = canonicalJson({ a: true, z: [{ a: 1, b: 2 }] });
  assert.equal(first, second);
  assert.equal(await sha256(first), await sha256(second));
});

test('approved knowledge retains structured evidence and required safety text', () => {
  const result = validateKnowledge(reviewedKnowledge);
  assert.equal(result.id, 'example-access-violation');
  assert.equal(result.publicationState, 'approved');
  assert.deepEqual(result.platforms, ['windows']);
});

test('knowledge validation rejects publication without sources or required guidance', () => {
  assert.throws(() => validateKnowledge({ ...reviewedKnowledge, sourceIds: [] }), /requires at least one source/);
  assert.throws(() => validateKnowledge({ ...reviewedKnowledge, safeGuidance: '' }), /text value is invalid/);
});

test('source validation rejects unsupported categories and accepts stable source IDs', () => {
  assert.equal(validateSource({ id: 'official-example', title: 'Official example', category: 'primary-official', platforms: ['windows'], daws: ['cubase'] }).id, 'official-example');
  assert.throws(() => validateSource({ id: 'bad-source', title: 'Bad source', category: 'unverified', platforms: [] }), /Source category is invalid/);
});
