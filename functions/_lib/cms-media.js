import { CMS_V2_MEDIA_LIMITS, normaliseCmsV2MediaMetadata } from './content-v2.js';

export const CMS_MEDIA_ORPHAN_RETENTION_DAYS = 30;
export const CMS_MEDIA_REVISION_LENGTH = 16;
export const CMS_MEDIA_MAX_REQUEST_BYTES = CMS_V2_MEDIA_LIMITS.maxBytes + (256 * 1024);

const MEDIA_ID = /^[a-z0-9][a-z0-9-]{0,94}[a-z0-9]$|^[a-z0-9]$/;
const REVISION = new RegExp(`^[a-f0-9]{${CMS_MEDIA_REVISION_LENGTH}}$`);
const FORMAT_EXTENSIONS = Object.freeze({ jpeg: ['.jpg', '.jpeg'], png: ['.png'], webp: ['.webp'] });
const FORMAT_TYPES = Object.freeze({ jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' });

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const bytesView = (value) => value instanceof Uint8Array ? value : new Uint8Array(value || 0);
const ascii = (bytes, offset, length) => String.fromCharCode(...bytes.slice(offset, offset + length));
const uint24le = (bytes, offset) => bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
const crc32 = (bytes, start, end) => {
  let crc = 0xffffffff;
  for (let index = start; index < end; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const inspectPng = (bytes) => {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 45 || !signature.every((value, index) => bytes[index] === value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let width;
  let height;
  let foundEnd = false;
  let foundData = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = ascii(bytes, offset + 4, 4);
    const end = offset + 12 + length;
    if (end > bytes.length) fail('The uploaded image is malformed or truncated.');
    const storedCrc = view.getUint32(offset + 8 + length);
    if (storedCrc !== crc32(bytes, offset + 4, offset + 8 + length)) fail('The uploaded image is malformed or truncated.');
    if (offset === 8 && (type !== 'IHDR' || length !== 13)) fail('The uploaded image is malformed or truncated.');
    if (type === 'IHDR') {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
    }
    if (type === 'IDAT') foundData = true;
    if (type === 'IEND') {
      if (length !== 0 || end !== bytes.length) fail('The uploaded image is malformed or truncated.');
      foundEnd = true;
      break;
    }
    offset = end;
  }
  if (!foundEnd || !foundData || !width || !height) fail('The uploaded image is malformed or truncated.');
  return { format: 'png', width, height };
};

const inspectJpeg = (bytes) => {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
  if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) fail('The uploaded image is malformed or truncated.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  let width;
  let height;
  while (offset < bytes.length - 2) {
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++];
    if (marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > bytes.length) fail('The uploaded image is malformed or truncated.');
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length) fail('The uploaded image is malformed or truncated.');
    if (startOfFrame.has(marker)) {
      if (length < 11 || length !== 8 + (3 * bytes[offset + 7])) fail('The uploaded image is malformed or truncated.');
      height = view.getUint16(offset + 3);
      width = view.getUint16(offset + 5);
      if (!width || !height) fail('The uploaded image is malformed or truncated.');
    }
    if (marker === 0xda) {
      if (!width || !height || length < 8 || offset + length >= bytes.length - 2) fail('The uploaded image is malformed or truncated.');
      return { format: 'jpeg', width, height };
    }
    offset += length;
  }
  fail('The uploaded image is malformed or truncated.');
};

const inspectWebp = (bytes) => {
  if (bytes.length < 12 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null;
  if (bytes.length < 30) fail('The uploaded image is malformed or truncated.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 !== bytes.length) fail('The uploaded image is malformed or truncated.');
  let offset = 12;
  let dimensions;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4);
    const length = view.getUint32(offset + 4, true);
    const payload = offset + 8;
    const end = payload + length;
    const next = end + (length % 2);
    if (end > bytes.length || next > bytes.length) fail('The uploaded image is malformed or truncated.');
    if (type === 'VP8X') {
      if (length < 10 || dimensions) fail('The uploaded image is malformed or truncated.');
      dimensions = { width: uint24le(bytes, payload + 4) + 1, height: uint24le(bytes, payload + 7) + 1 };
    }
    if (type === 'VP8L') {
      if (length < 5 || bytes[payload] !== 0x2f || dimensions) fail('The uploaded image is malformed or truncated.');
      dimensions = {
        width: 1 + (bytes[payload + 1] | ((bytes[payload + 2] & 0x3f) << 8)),
        height: 1 + ((bytes[payload + 2] >> 6) | (bytes[payload + 3] << 2) | ((bytes[payload + 4] & 0x0f) << 10)),
      };
    }
    if (type === 'VP8 ') {
      if (length < 10 || bytes[payload + 3] !== 0x9d || bytes[payload + 4] !== 0x01 || bytes[payload + 5] !== 0x2a || dimensions) fail('The uploaded image is malformed or truncated.');
      dimensions = { width: view.getUint16(payload + 6, true) & 0x3fff, height: view.getUint16(payload + 8, true) & 0x3fff };
    }
    offset = next;
  }
  if (offset !== bytes.length || !dimensions?.width || !dimensions?.height) fail('The uploaded image is malformed or truncated.');
  return { format: 'webp', ...dimensions };
};

const extension = (filename) => {
  const clean = String(filename || '').toLowerCase();
  const separator = clean.lastIndexOf('.');
  return separator >= 0 ? clean.slice(separator) : '';
};

export const safeMediaFilename = (value) => String(value || 'image')
  .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').slice(0, 255) || 'image';

export const validateCmsImageBytes = (value, filename, suppliedContentType = '') => {
  const bytes = bytesView(value);
  if (!bytes.length) fail('The uploaded image is empty.');
  if (bytes.length > CMS_V2_MEDIA_LIMITS.maxBytes) fail('The uploaded image is too large.', 413);
  const detected = inspectPng(bytes) || inspectJpeg(bytes) || inspectWebp(bytes);
  if (!detected) fail('The uploaded file is not a supported image.');
  const contentType = FORMAT_TYPES[detected.format];
  const supplied = String(suppliedContentType || '').toLowerCase();
  if (supplied && supplied !== contentType) fail('The uploaded image type does not match its content.');
  if (!FORMAT_EXTENSIONS[detected.format].includes(extension(filename))) fail('The uploaded image extension does not match its content.');
  if (detected.width > CMS_V2_MEDIA_LIMITS.maxDimension || detected.height > CMS_V2_MEDIA_LIMITS.maxDimension || detected.width * detected.height > CMS_V2_MEDIA_LIMITS.maxPixels) {
    fail('The uploaded image dimensions are too large.', 413);
  }
  return { bytes, contentType, extension: FORMAT_EXTENSIONS[detected.format][0], width: detected.width, height: detected.height };
};

export const sha256Hex = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytesView(bytes)))]
  .map((byte) => byte.toString(16).padStart(2, '0')).join('');
export const cmsMediaRevision = (sha256) => String(sha256).slice(0, CMS_MEDIA_REVISION_LENGTH);
export const cmsMediaObjectKey = (mediaId, sha256, fileExtension) => `cms-media/${mediaId}/${cmsMediaRevision(sha256)}${fileExtension}`;
export const validCmsMediaId = (value) => typeof value === 'string' && MEDIA_ID.test(value);
export const validCmsMediaRevision = (value) => typeof value === 'string' && REVISION.test(value);

const adminProjection = (row) => row && ({
  id: row.id,
  originalFilename: row.original_filename,
  contentType: row.content_type,
  fileSizeBytes: Number(row.file_size_bytes),
  width: Number(row.width),
  height: Number(row.height),
  revision: cmsMediaRevision(row.sha256),
  defaultAltText: row.default_alt_text,
  defaultCaption: row.default_caption,
  lifecycleState: row.lifecycle_state,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  orphanedAt: row.orphaned_at || null,
});

export const listCmsMedia = async (database) => {
  const result = await database.prepare(`
    SELECT id,original_filename,content_type,file_size_bytes,width,height,sha256,default_alt_text,default_caption,lifecycle_state,created_at,updated_at,orphaned_at
    FROM cms_media_assets ORDER BY created_at DESC, id ASC LIMIT 250
  `).all();
  return (result?.results || []).map(adminProjection);
};

export const inspectCmsMedia = async (database, mediaId) => {
  if (!validCmsMediaId(mediaId)) fail('Media asset was not found.', 404);
  const row = await database.prepare(`
    SELECT id,original_filename,content_type,file_size_bytes,width,height,sha256,default_alt_text,default_caption,lifecycle_state,created_at,updated_at,orphaned_at
    FROM cms_media_assets WHERE id = ? LIMIT 1
  `).bind(mediaId).first();
  if (!row) fail('Media asset was not found.', 404);
  return adminProjection(row);
};

// Orphaned media remains recoverable during its retention period, so an owner
// may preview it. Deleted media is deliberately excluded.
export const resolveOwnerCmsMediaPreview = async (database, mediaId) => {
  if (!validCmsMediaId(mediaId)) fail('Media asset was not found.', 404);
  const row = await database.prepare(`
    SELECT id,object_key,content_type,file_size_bytes,lifecycle_state
    FROM cms_media_assets
    WHERE id = ? AND lifecycle_state IN ('active','orphaned')
    LIMIT 1
  `).bind(mediaId).first();
  if (!row) fail('Media asset was not found.', 404);
  return row;
};

export const uploadCmsMedia = async ({ database, bucket, file, defaultAltText = '', defaultCaption = '', subject }) => {
  if (!(file instanceof File)) fail('An image file is required.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = validateCmsImageBytes(bytes, file.name, file.type);
  const sha256 = await sha256Hex(bytes);
  const mediaId = `media-${crypto.randomUUID()}`;
  const objectKey = cmsMediaObjectKey(mediaId, sha256, image.extension);
  const originalFilename = safeMediaFilename(file.name);
  const metadata = normaliseCmsV2MediaMetadata({
    id: mediaId, originalFilename, contentType: image.contentType, fileSizeBytes: bytes.byteLength,
    width: image.width, height: image.height, sha256, defaultAltText, defaultCaption,
  });
  await bucket.put(objectKey, bytes, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: metadata.contentType },
  });
  try {
    await database.prepare(`
      INSERT INTO cms_media_assets (
        id,object_key,original_filename,content_type,file_size_bytes,width,height,pixel_count,sha256,
        default_alt_text,default_caption,lifecycle_state,created_by,updated_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,'active',?,?)
    `).bind(
      metadata.id, objectKey, metadata.originalFilename, metadata.contentType, metadata.fileSizeBytes,
      metadata.width, metadata.height, metadata.width * metadata.height, metadata.sha256,
      metadata.defaultAltText || '', metadata.defaultCaption || '', subject, subject,
    ).run();
  } catch (error) {
    await bucket.delete(objectKey);
    throw error;
  }
  return {
    id: metadata.id,
    originalFilename: metadata.originalFilename,
    contentType: metadata.contentType,
    fileSizeBytes: metadata.fileSizeBytes,
    width: metadata.width,
    height: metadata.height,
    revision: cmsMediaRevision(sha256),
    defaultAltText: metadata.defaultAltText || '',
    defaultCaption: metadata.defaultCaption || '',
    lifecycleState: 'active',
  };
};

const referenceCount = async (database, mediaId) => {
  const row = await database.prepare(`
    SELECT
      (SELECT COUNT(*) FROM cms_product_media_slots WHERE media_id = ?) AS product_references,
      (SELECT COUNT(*) FROM cms_studio_hardware_items WHERE media_id = ?) AS hardware_references,
      (SELECT COUNT(*) FROM cms_studio_pages WHERE hero_media_id = ?) AS studio_page_references,
      (SELECT COUNT(*) FROM cms_studio_software_groups WHERE media_id = ?) AS software_group_references
  `).bind(mediaId, mediaId, mediaId, mediaId).first();
  return Number(row?.product_references || 0) + Number(row?.hardware_references || 0)
    + Number(row?.studio_page_references || 0) + Number(row?.software_group_references || 0);
};

export const retireCmsMedia = async ({ database, bucket, mediaId, subject, purge = false, now = new Date() }) => {
  if (!validCmsMediaId(mediaId)) fail('Media asset was not found.', 404);
  const row = await database.prepare('SELECT id,object_key,lifecycle_state,orphaned_at FROM cms_media_assets WHERE id = ? LIMIT 1').bind(mediaId).first();
  if (!row || row.lifecycle_state === 'deleted') fail('Media asset was not found.', 404);
  if (await referenceCount(database, mediaId)) fail('Referenced media cannot be removed.', 409);
  if (!purge) {
    if (row.lifecycle_state === 'orphaned') return { id: mediaId, lifecycleState: 'orphaned', orphanedAt: row.orphaned_at };
    const orphanedAt = now.toISOString();
    await database.prepare(`UPDATE cms_media_assets SET lifecycle_state='orphaned',orphaned_at=?,updated_at=?,updated_by=? WHERE id=? AND lifecycle_state='active'`)
      .bind(orphanedAt, orphanedAt, subject, mediaId).run();
    return { id: mediaId, lifecycleState: 'orphaned', orphanedAt };
  }
  if (row.lifecycle_state !== 'orphaned' || !row.orphaned_at) fail('Media must be marked as orphaned before deletion.', 409);
  const eligibleAt = new Date(row.orphaned_at);
  eligibleAt.setUTCDate(eligibleAt.getUTCDate() + CMS_MEDIA_ORPHAN_RETENTION_DAYS);
  if (!Number.isFinite(eligibleAt.getTime()) || now < eligibleAt) fail('Media is still within its orphan retention period.', 409);
  await bucket.delete(row.object_key);
  const changedAt = now.toISOString();
  await database.prepare(`UPDATE cms_media_assets SET lifecycle_state='deleted',updated_at=?,updated_by=? WHERE id=? AND lifecycle_state='orphaned'`)
    .bind(changedAt, subject, mediaId).run();
  return { id: mediaId, lifecycleState: 'deleted' };
};

export const resolvePublicCmsMedia = async (database, mediaId, revision) => {
  if (!validCmsMediaId(mediaId) || !validCmsMediaRevision(revision)) return null;
  const row = await database.prepare(`
    SELECT m.id,m.object_key,m.content_type,m.file_size_bytes,m.sha256
    FROM cms_media_assets m
    WHERE m.id=? AND m.lifecycle_state='active'
      AND (
        EXISTS (SELECT 1 FROM cms_product_media_slots p WHERE p.media_id=m.id AND p.publication_state='published')
        OR EXISTS (SELECT 1 FROM cms_studio_hardware_items h WHERE h.media_id=m.id AND h.publication_state='published' AND h.visibility='visible')
        OR EXISTS (SELECT 1 FROM cms_studio_pages p WHERE p.hero_media_id=m.id AND p.publication_state='published' AND p.visibility='visible')
        OR EXISTS (SELECT 1 FROM cms_studio_software_groups s WHERE s.media_id=m.id AND s.publication_state='published' AND s.visibility='visible')
      )
    LIMIT 1
  `).bind(mediaId).first();
  if (!row || cmsMediaRevision(row.sha256) !== revision) return null;
  return row;
};

export const mediaJson = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

export const mediaErrorResponse = (error, fallback = 'Media request could not be completed.') => {
  const status = Number(error?.status) || 500;
  return mediaJson({ error: status >= 500 ? fallback : error.message }, status);
};
