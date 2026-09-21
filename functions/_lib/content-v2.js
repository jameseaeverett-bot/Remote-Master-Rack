import { CONTENT_IDS } from './content.js';

export const CMS_V2_SCHEMA_VERSION = 1;
export const CMS_V2_MEDIA_SLOT_KEYS = Object.freeze(['card-artwork', 'detail-hero', 'studio-hardware']);
export const CMS_V2_HARDWARE_SESSION_TYPES = Object.freeze(['remote', 'assisted']);
export const CMS_V2_VISIBILITY_VALUES = Object.freeze(['visible', 'hidden']);
export const CMS_V2_MEDIA_CONTENT_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
export const CMS_V2_MEDIA_LIMITS = Object.freeze({ maxBytes: 10 * 1024 * 1024, maxDimension: 6000, maxPixels: 20_000_000 });

const contentIds = new Set(CONTENT_IDS);
const mediaSlotKeys = new Set(CMS_V2_MEDIA_SLOT_KEYS);
const sessionTypes = new Set(CMS_V2_HARDWARE_SESSION_TYPES);
const visibilityValues = new Set(CMS_V2_VISIBILITY_VALUES);
const mediaContentTypes = new Set(CMS_V2_MEDIA_CONTENT_TYPES);
const stableId = /^[a-z0-9][a-z0-9-]{0,158}[a-z0-9]$|^[a-z0-9]$/;
const youtubeId = /^[A-Za-z0-9_-]{11}$/;

const object = (value, message) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value;
};

const text = (value, maximum, { required = false, field = 'Text' } = {}) => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${field} must be text.`);
  const clean = value.trim().replace(/\r\n?/g, '\n');
  if ((required && !clean) || clean.length > maximum) throw new Error(`${field} is invalid.`);
  return clean;
};

const id = (value, field = 'ID') => {
  if (typeof value !== 'string' || !stableId.test(value)) throw new Error(`${field} is invalid.`);
  return value;
};

const wholeNumber = (value, field, minimum, maximum) => {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`${field} is invalid.`);
  return value;
};

const optionalFields = (source, rules) => Object.fromEntries(Object.entries(rules)
  .filter(([key]) => Object.hasOwn(source, key))
  .map(([key, maximum]) => [key, text(source[key], maximum, { field: key })]));

export const normaliseCmsV2MediaMetadata = (value) => {
  const source = object(value, 'Media metadata is invalid.');
  const width = wholeNumber(source.width, 'Media width', 1, CMS_V2_MEDIA_LIMITS.maxDimension);
  const height = wholeNumber(source.height, 'Media height', 1, CMS_V2_MEDIA_LIMITS.maxDimension);
  const fileSizeBytes = wholeNumber(source.fileSizeBytes, 'Media file size', 1, CMS_V2_MEDIA_LIMITS.maxBytes);
  if (width * height > CMS_V2_MEDIA_LIMITS.maxPixels) throw new Error('Media pixel count is invalid.');
  if (!mediaContentTypes.has(source.contentType)) throw new Error('Media content type is invalid.');
  if (typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(source.sha256)) throw new Error('Media checksum is invalid.');
  return {
    id: id(source.id, 'Media ID'),
    originalFilename: text(source.originalFilename, 255, { required: true, field: 'Media filename' }),
    contentType: source.contentType,
    fileSizeBytes,
    width,
    height,
    sha256: source.sha256.toLowerCase(),
    ...optionalFields(source, { defaultAltText: 500, defaultCaption: 1000 }),
  };
};

export const normaliseCmsV2ProductMediaSlot = (value) => {
  const source = object(value, 'Product media slot is invalid.');
  if (!contentIds.has(source.contentId)) throw new Error('Product media content ID is invalid.');
  if (!mediaSlotKeys.has(source.slotKey)) throw new Error('Product media slot key is invalid.');
  return {
    contentId: source.contentId,
    slotKey: source.slotKey,
    mediaId: id(source.mediaId, 'Media ID'),
    altText: text(source.altText, 500, { required: true, field: 'Image alt text' }),
    ...optionalFields(source, { caption: 1000 }),
  };
};

export const normaliseCmsV2YouTubeVideo = (value) => {
  const source = object(value, 'YouTube video is invalid.');
  if (typeof source.videoId !== 'string' || !youtubeId.test(source.videoId)) throw new Error('YouTube video ID is invalid.');
  return {
    videoId: source.videoId,
    displayOrder: wholeNumber(source.displayOrder, 'YouTube video order', 0, 2),
    ...optionalFields(source, { title: 160, caption: 1000 }),
  };
};

export const normaliseCmsV2StudioHardwareItem = (value) => {
  const source = object(value, 'Studio hardware item is invalid.');
  if (!sessionTypes.has(source.sessionType)) throw new Error('Studio hardware session type is invalid.');
  const videos = source.videos === undefined ? [] : source.videos;
  if (!Array.isArray(videos) || videos.length > 3) throw new Error('Studio hardware videos are invalid.');
  const normalisedVideos = videos.map(normaliseCmsV2YouTubeVideo);
  const videoOrders = new Set(normalisedVideos.map((video) => video.displayOrder));
  const videoIds = new Set(normalisedVideos.map((video) => video.videoId));
  if (videoOrders.size !== normalisedVideos.length || videoIds.size !== normalisedVideos.length) throw new Error('Studio hardware videos are duplicated.');
  const result = {
    id: id(source.id, 'Studio hardware ID'),
    displayName: text(source.displayName, 160, { required: true, field: 'Studio hardware name' }),
    displayOrder: wholeNumber(source.displayOrder, 'Studio hardware order', 0, Number.MAX_SAFE_INTEGER),
    sessionType: source.sessionType,
    visibility: source.visibility === undefined ? 'visible' : source.visibility,
    videos: normalisedVideos.sort((left, right) => left.displayOrder - right.displayOrder),
    ...optionalFields(source, { mediaId: 160, imageAltText: 500, imageCaption: 1000, description: 4000, chainRationale: 4000 }),
  };
  if (!visibilityValues.has(result.visibility)) throw new Error('Studio hardware visibility is invalid.');
  if (result.mediaId !== undefined) {
    result.mediaId = id(result.mediaId, 'Media ID');
    if (!result.imageAltText) throw new Error('Studio hardware image alt text is required.');
  }
  return result;
};

export const normaliseCmsV2StudioPage = (value) => {
  const source = object(value, 'Studio page is invalid.');
  if (source.id !== 'the-rmr-studio') throw new Error('Studio page ID is invalid.');
  const result = { id: 'the-rmr-studio', visibility: source.visibility === undefined ? 'visible' : source.visibility, ...optionalFields(source, {
    title: 160, intro: 1600, hardwareHeading: 160, hardwareIntro: 1600, softwareHeading: 160, softwareSummary: 1600,
  }) };
  if (!visibilityValues.has(result.visibility)) throw new Error('Studio page visibility is invalid.');
  return result;
};

export const normaliseCmsV2Document = (value) => {
  const source = object(value, 'CMS V2 content is invalid.');
  if (source.version !== CMS_V2_SCHEMA_VERSION) throw new Error('Unsupported CMS V2 schema version.');
  const productMedia = source.productMedia === undefined ? [] : source.productMedia;
  const studioHardware = source.studioHardware === undefined ? [] : source.studioHardware;
  if (!Array.isArray(productMedia) || !Array.isArray(studioHardware)) throw new Error('CMS V2 collections are invalid.');
  const slots = productMedia.map(normaliseCmsV2ProductMediaSlot);
  const hardware = studioHardware.map(normaliseCmsV2StudioHardwareItem);
  const slotIds = new Set(slots.map((slot) => `${slot.contentId}:${slot.slotKey}`));
  const hardwareIds = new Set(hardware.map((item) => item.id));
  const hardwareOrders = new Set(hardware.map((item) => item.displayOrder));
  if (slotIds.size !== slots.length || hardwareIds.size !== hardware.length || hardwareOrders.size !== hardware.length) throw new Error('CMS V2 records are duplicated.');
  return {
    version: CMS_V2_SCHEMA_VERSION,
    studio: normaliseCmsV2StudioPage(source.studio || { id: 'the-rmr-studio' }),
    productMedia: slots,
    studioHardware: hardware.sort((left, right) => left.displayOrder - right.displayOrder),
  };
};

// Public projections deliberately omit object keys, checksums, uploader identities,
// lifecycle metadata, and all owner-only management state.
export const publicCmsV2Projection = (document) => normaliseCmsV2Document(document);
