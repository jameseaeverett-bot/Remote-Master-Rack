import { PRODUCT_CONTENT_IDS, PRODUCT_MEDIA_SLOT_KEYS } from './cms-product-media.js';
import { cmsMediaRevision, validCmsMediaId, validCmsMediaRevision } from './cms-media.js';

const productIds = new Set(PRODUCT_CONTENT_IDS);
const slotKeys = new Set(PRODUCT_MEDIA_SLOT_KEYS);

// This is intentionally the complete public projection. It never returns object
// keys, hashes, lifecycle state, uploader identity, or any storage metadata.
export const publicProductMediaAssignment = (row) => {
  if (!row || !productIds.has(row.content_id) || !slotKeys.has(row.slot_key) || !validCmsMediaId(row.media_id)) return null;
  const revision = cmsMediaRevision(row.sha256);
  if (!validCmsMediaRevision(revision) || typeof row.alt_text !== 'string' || !row.alt_text.trim() || row.alt_text.length > 500) return null;
  if (typeof row.caption !== 'string' || row.caption.length > 1000) return null;
  return {
    contentId: row.content_id,
    slotKey: row.slot_key,
    mediaId: row.media_id,
    revision,
    altText: row.alt_text,
    caption: row.caption,
  };
};

export const publicProductMediaProjection = (rows) => (Array.isArray(rows) ? rows : [])
  .map(publicProductMediaAssignment)
  .filter(Boolean);

export const listPublicProductMediaAssignments = async (database) => {
  const result = await database.prepare(`
    SELECT p.content_id,p.slot_key,p.media_id,p.alt_text,p.caption,m.sha256
    FROM cms_product_media_slots p
    JOIN cms_media_assets m ON m.id=p.media_id
    WHERE p.publication_state='published'
      AND p.slot_key IN ('card-artwork','detail-hero')
      AND m.lifecycle_state='active'
    ORDER BY p.content_id ASC,p.slot_key ASC
  `).all();
  return publicProductMediaProjection(result?.results || []);
};