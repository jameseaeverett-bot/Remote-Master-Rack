import { CONTENT_IDS } from './content.js';
import { normaliseCmsV2ProductMediaSlot } from './content-v2.js';

const PRODUCT_CONTENT_IDS = Object.freeze([
  'ssl-fusion', 'pultec-eqp-1a', 'folktek-resonant-garden',
  'age-filter', 'age-drive', 'age-space', 'age-move', 'age-sample',
  'daw-detectives', 'compare',
]);
const PRODUCT_MEDIA_SLOT_KEYS = Object.freeze(['card-artwork', 'detail-hero']);
const productIds = new Set(PRODUCT_CONTENT_IDS);
const productSlots = new Set(PRODUCT_MEDIA_SLOT_KEYS);
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

export { PRODUCT_CONTENT_IDS, PRODUCT_MEDIA_SLOT_KEYS };

export const validateProductContentId = (contentId) => {
  if (!CONTENT_IDS.includes(contentId) || !productIds.has(contentId)) fail('This content record does not support product media assignments.', 404);
  return contentId;
};

export const validateProductMediaSlotKey = (slotKey) => {
  if (!productSlots.has(slotKey)) fail('This product media slot is not supported.', 400);
  return slotKey;
};

const assignmentProjection = (row) => row && ({
  contentId: row.content_id,
  slotKey: row.slot_key,
  mediaId: row.media_id,
  altText: row.alt_text,
  caption: row.caption,
  media: {
    id: row.media_id,
    originalFilename: row.original_filename,
    contentType: row.content_type,
    fileSizeBytes: Number(row.file_size_bytes),
    width: Number(row.width),
    height: Number(row.height),
    revision: String(row.sha256 || '').slice(0, 16),
    lifecycleState: row.lifecycle_state,
  },
});

export const listProductMediaAssignments = async (database, contentId) => {
  validateProductContentId(contentId);
  const result = await database.prepare(`
    SELECT p.content_id,p.slot_key,p.media_id,p.alt_text,p.caption,
      m.original_filename,m.content_type,m.file_size_bytes,m.width,m.height,m.sha256,m.lifecycle_state
    FROM cms_product_media_slots p
    JOIN cms_media_assets m ON m.id=p.media_id
    WHERE p.content_id=? AND p.publication_state='published'
    ORDER BY p.slot_key ASC
  `).bind(contentId).all();
  return (result?.results || []).map(assignmentProjection);
};

export const upsertProductMediaAssignment = async ({ database, contentId, slotKey, assignment, subject }) => {
  validateProductContentId(contentId);
  validateProductMediaSlotKey(slotKey);
  const normalised = normaliseCmsV2ProductMediaSlot({ ...assignment, contentId, slotKey });
  const media = await database.prepare(`SELECT id,lifecycle_state FROM cms_media_assets WHERE id=? LIMIT 1`).bind(normalised.mediaId).first();
  if (!media || media.lifecycle_state !== 'active') fail('Only active Media Library images can be assigned.', 409);
  const now = new Date().toISOString();
  await database.prepare(`
    INSERT INTO cms_product_media_slots (content_id,slot_key,media_id,alt_text,caption,publication_state,published_at,published_by)
    VALUES (?,?,?,?,?,'published',?,?)
    ON CONFLICT(content_id,slot_key,publication_state) DO UPDATE SET
      media_id=excluded.media_id,alt_text=excluded.alt_text,caption=excluded.caption,
      published_at=excluded.published_at,published_by=excluded.published_by
  `).bind(contentId, slotKey, normalised.mediaId, normalised.altText, normalised.caption || '', now, subject).run();
  const assignments = await listProductMediaAssignments(database, contentId);
  return assignments.find((item) => item.slotKey === slotKey) || null;
};

export const removeProductMediaAssignment = async ({ database, contentId, slotKey }) => {
  validateProductContentId(contentId);
  validateProductMediaSlotKey(slotKey);
  const result = await database.prepare(`
    DELETE FROM cms_product_media_slots
    WHERE content_id=? AND slot_key=? AND publication_state='published'
  `).bind(contentId, slotKey).run();
  if (!Number(result?.meta?.changes || result?.changes || 0)) fail('Product media assignment was not found.', 404);
  return { contentId, slotKey, removed: true };
};