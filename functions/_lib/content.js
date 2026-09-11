const FIELD_LIMITS = Object.freeze({
  heading: 160,
  intro: 800,
  title: 160,
  cardDescription: 800,
  detailIntro: 800,
  description: 4000,
  compatibility: 800,
  status: 120,
  requirements: 1600,
  availability: 800,
  ctaLabel: 120,
});

export const CONTENT_SCHEMA_VERSION = 1;
export const CONTENT_IDS = Object.freeze([
  'plugins', 'vst-editors', 'ssl-fusion', 'pultec-eqp-1a', 'folktek-resonant-garden',
  'age-series', 'age-filter', 'age-drive', 'age-space', 'age-move', 'age-sample',
  'tools', 'daw-detectives', 'compare',
]);

const contentIdSet = new Set(CONTENT_IDS);

export const normaliseContentFields = (fields) => {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error('Content fields are invalid.');
  const result = {};
  for (const [field, value] of Object.entries(fields)) {
    const maximum = FIELD_LIMITS[field];
    if (!maximum) throw new Error(`Unsupported content field: ${field}.`);
    if (typeof value !== 'string') throw new Error(`Content field ${field} must be text.`);
    const clean = value.trim().replace(/\r\n?/g, '\n');
    // An explicitly empty field is meaningful: it lets an owner deliberately
    // suppress optional customer-facing copy. An absent field remains the
    // signal to use the presentation layer's built-in default.
    if (clean.length > maximum) throw new Error(`Content field ${field} is invalid.`);
    result[field] = clean;
  }
  return result;
};

export const normaliseContentRecords = (records) => {
  if (!Array.isArray(records) || records.length > CONTENT_IDS.length) throw new Error('Content records are invalid.');
  const seen = new Set();
  return records.map((record) => {
    if (!record || typeof record !== 'object' || typeof record.id !== 'string' || !contentIdSet.has(record.id) || seen.has(record.id)) {
      throw new Error('Content record IDs are invalid.');
    }
    seen.add(record.id);
    return { id: record.id, fields: normaliseContentFields(record.fields) };
  });
};

export const publicContentProjection = (rows) => ({
  version: CONTENT_SCHEMA_VERSION,
  records: Object.fromEntries((rows || []).map((row) => [row.content_id, JSON.parse(row.content_json)])),
});

const noStoreJson = (body, status = 200, cors = false) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=UTF-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(cors ? { 'Access-Control-Allow-Origin': '*', Vary: 'Origin' } : {}),
  },
});

export const contentJson = noStoreJson;

export const listPublishedContent = async (database) => {
  const result = await database.prepare(`
    SELECT content_id, content_json FROM customer_content
    WHERE schema_version = ? AND publication_state = 'published'
    ORDER BY content_id ASC
  `).bind(CONTENT_SCHEMA_VERSION).all();
  return publicContentProjection(result?.results || []);
};

export const listAdminContent = async (database) => {
  const result = await database.prepare(`
    SELECT content_id, content_json, schema_version, publication_state, published_at, published_by
    FROM customer_content
    WHERE schema_version = ? AND publication_state = 'published'
    ORDER BY content_id ASC
  `).bind(CONTENT_SCHEMA_VERSION).all();
  return {
    ...publicContentProjection(result?.results || []),
    updatedAt: Object.fromEntries((result?.results || []).map((row) => [row.content_id, row.published_at])),
  };
};

export const replacePublishedContent = async (database, records, subject) => {
  const now = new Date().toISOString();
  const statements = [database.prepare(`
    DELETE FROM customer_content WHERE schema_version = ? AND publication_state = 'published'
  `).bind(CONTENT_SCHEMA_VERSION)];
  for (const record of records) {
    statements.push(database.prepare(`
      INSERT INTO customer_content (
        content_id, schema_version, content_json, publication_state, published_at, published_by
      ) VALUES (?, ?, ?, 'published', ?, ?)
    `).bind(record.id, CONTENT_SCHEMA_VERSION, JSON.stringify(record.fields), now, subject));
  }
  await database.batch(statements);
  return listAdminContent(database);
};

export const isCmsOwner = (env, subject) => {
  const owners = String(env.CMS_OWNER_SUBJECTS || '').split(',').map((value) => value.trim()).filter(Boolean);
  return owners.includes(subject);
};
