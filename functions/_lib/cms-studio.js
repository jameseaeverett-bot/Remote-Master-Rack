import { validCmsMediaId } from './cms-media.js';

export const STUDIO_PAGE_ID = 'the-rmr-studio';
export const STUDIO_SESSION_TYPES = Object.freeze(['remote', 'assisted']);
const sessionTypes = new Set(STUDIO_SESSION_TYPES);
const idPattern = /^[a-z0-9][a-z0-9-]{0,158}$/;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const text = (value, limit, label, { required = false } = {}) => {
  if (typeof value !== 'string') value = value == null ? '' : String(value);
  const clean = value.trim();
  if (clean.length > limit) fail(`${label} is too long.`);
  if (required && !clean) fail(`${label} is required.`);
  return clean;
};
const bool = (value) => value === true;
const stableId = (value, label) => { const clean = text(value, 160, label, { required: true }); if (!idPattern.test(clean)) fail(`${label} is invalid.`); return clean; };
const optionalMedia = (value, alt, label) => {
  const mediaId = value == null || value === '' ? null : text(value, 96, `${label} image`);
  if (mediaId && !validCmsMediaId(mediaId)) fail(`${label} image is invalid.`);
  const altText = text(alt, 500, `${label} image alt text`);
  if (mediaId && !altText) fail(`${label} image alt text is required when an image is selected.`);
  return { mediaId, altText };
};

export const normaliseYouTubeUrl = (value) => {
  const raw = text(value, 2048, 'YouTube video URL');
  if (!raw) return '';
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  let url;
  try { url = new URL(raw); } catch { fail('YouTube video URL is invalid.'); }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const id = host === 'youtu.be' ? url.pathname.slice(1).split('/')[0]
    : host === 'youtube.com' && url.pathname === '/watch' ? url.searchParams.get('v')
      : host === 'youtube.com' && url.pathname.startsWith('/embed/') ? url.pathname.split('/')[2] : '';
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) fail('YouTube video URL is invalid.');
  return id;
};
const videoProjection = (video, index) => ({
  youtubeVideoId: normaliseYouTubeUrl(video?.url ?? video?.youtubeVideoId ?? ''),
  displayOrder: index,
  title: text(video?.title, 160, 'Video title'),
  caption: text(video?.caption, 1000, 'Video caption'),
});
const normaliseVideos = (videos) => {
  if (!Array.isArray(videos)) fail('Hardware videos must be a list.');
  if (videos.length > 3) fail('A studio hardware item may have no more than three YouTube videos.');
  const result = videos.map(videoProjection).filter((video) => video.youtubeVideoId);
  if (new Set(result.map((video) => video.youtubeVideoId)).size !== result.length) fail('A hardware item cannot contain the same YouTube video twice.');
  return result;
};
const normaliseHardware = (item, index) => {
  const image = optionalMedia(item?.mediaId, item?.imageAltText, 'Hardware');
  const sessionType = text(item?.sessionType, 16, 'Session type', { required: true });
  if (!sessionTypes.has(sessionType)) fail('Session type must be remote or assisted.');
  return {
    id: stableId(item?.id, 'Hardware ID'),
    catalogueHardwareId: item?.catalogueHardwareId == null || item?.catalogueHardwareId === '' ? null : stableId(item.catalogueHardwareId, 'Catalogue hardware ID'),
    publicName: text(item?.publicName, 160, 'Public name', { required: true }),
    manufacturer: text(item?.manufacturer, 160, 'Manufacturer'),
    shortDescription: text(item?.shortDescription, 4000, 'Short description'),
    chainRationale: text(item?.chainRationale, 4000, 'Why it is in the chain'),
    imageCaption: text(item?.imageCaption, 1000, 'Hardware image caption'),
    sessionType,
    visible: bool(item?.visible),
    displayOrder: index,
    ...image,
    videos: normaliseVideos(item?.videos || []),
  };
};
const normaliseSoftwareGroup = (group, index) => {
  const image = optionalMedia(group?.mediaId, group?.imageAltText, 'Software group');
  return {
    id: stableId(group?.id, 'Software group ID'),
    displayName: text(group?.displayName, 160, 'Group / manufacturer name', { required: true }),
    description: text(group?.description, 1600, 'Software group description'),
    visible: bool(group?.visible),
    displayOrder: index,
    ...image,
  };
};

export const normaliseStudioDocument = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('A Studio content document is required.');
  const hero = optionalMedia(value.page?.heroMediaId, value.page?.heroAltText, 'Hero');
  const hardware = Array.isArray(value.hardware) ? value.hardware.map(normaliseHardware) : fail('Studio hardware must be a list.');
  const softwareGroups = Array.isArray(value.softwareGroups) ? value.softwareGroups.map(normaliseSoftwareGroup) : fail('Software groups must be a list.');
  const unique = (items, label) => { if (new Set(items.map((item) => item.id)).size !== items.length) fail(`${label} IDs must be unique.`); };
  unique(hardware, 'Hardware'); unique(softwareGroups, 'Software group');
  return {
    page: {
      pageId: STUDIO_PAGE_ID,
      title: text(value.page?.title, 160, 'Page title', { required: true }),
      intro: text(value.page?.intro, 1600, 'Intro / subtitle'),
      hardwareHeading: text(value.page?.hardwareHeading, 160, 'Hardware heading') || 'Remote Mastering Chain',
      hardwareIntro: text(value.page?.hardwareIntro, 1600, 'Hardware intro'),
      softwareHeading: text(value.page?.softwareHeading, 160, 'Software & Plugins heading') || 'Software & Plugins',
      softwareSummary: text(value.page?.softwareSummary, 1600, 'Software & Plugins intro'),
      visible: value.page?.visible !== false,
      heroMediaId: hero.mediaId,
      heroAltText: hero.altText,
    }, hardware, softwareGroups,
  };
};

const mediaProjection = (row, prefix = 'media') => row?.[`${prefix}_id`] ? ({ id: row[`${prefix}_id`], originalFilename: row[`${prefix}_filename`], contentType: row[`${prefix}_content_type`], fileSizeBytes: Number(row[`${prefix}_file_size_bytes`]), width: Number(row[`${prefix}_width`]), height: Number(row[`${prefix}_height`]), revision: String(row[`${prefix}_sha256`] || '').slice(0, 16), lifecycleState: row[`${prefix}_lifecycle_state`] }) : null;
const asVideoUrl = (id) => `https://www.youtube.com/watch?v=${id}`;

export const loadStudioDocument = async (database) => {
  const page = await database.prepare(`SELECT p.*,m.id AS hero_id,m.original_filename AS hero_filename,m.content_type AS hero_content_type,m.file_size_bytes AS hero_file_size_bytes,m.width AS hero_width,m.height AS hero_height,m.sha256 AS hero_sha256,m.lifecycle_state AS hero_lifecycle_state FROM cms_studio_pages p LEFT JOIN cms_media_assets m ON m.id=p.hero_media_id WHERE p.page_id=? LIMIT 1`).bind(STUDIO_PAGE_ID).first();
  const hardwareResult = await database.prepare(`SELECT h.*,m.id AS media_id,m.original_filename AS media_filename,m.content_type AS media_content_type,m.file_size_bytes AS media_file_size_bytes,m.width AS media_width,m.height AS media_height,m.sha256 AS media_sha256,m.lifecycle_state AS media_lifecycle_state FROM cms_studio_hardware_items h LEFT JOIN cms_media_assets m ON m.id=h.media_id WHERE h.page_id=? AND h.publication_state='published' ORDER BY h.display_order,h.id`).bind(STUDIO_PAGE_ID).all();
  const videosResult = await database.prepare(`SELECT hardware_item_id,display_order,youtube_video_id,title,caption FROM cms_studio_hardware_videos ORDER BY hardware_item_id,display_order`).all();
  const softwareResult = await database.prepare(`SELECT s.*,m.id AS media_id,m.original_filename AS media_filename,m.content_type AS media_content_type,m.file_size_bytes AS media_file_size_bytes,m.width AS media_width,m.height AS media_height,m.sha256 AS media_sha256,m.lifecycle_state AS media_lifecycle_state FROM cms_studio_software_groups s LEFT JOIN cms_media_assets m ON m.id=s.media_id WHERE s.page_id=? AND s.publication_state='published' ORDER BY s.display_order,s.id`).bind(STUDIO_PAGE_ID).all();
  const videos = new Map();
  for (const video of videosResult?.results || []) { const list = videos.get(video.hardware_item_id) || []; list.push({ url: asVideoUrl(video.youtube_video_id), title: video.title, caption: video.caption }); videos.set(video.hardware_item_id, list); }
  const pageData = page ? { title: page.title, intro: page.intro, hardwareHeading: page.hardware_heading, hardwareIntro: page.hardware_intro, softwareHeading: page.software_heading, softwareSummary: page.software_summary, visible: page.visibility === 'visible', heroMediaId: page.hero_media_id || null, heroAltText: page.hero_alt_text || '', heroMedia: mediaProjection(page, 'hero') } : null;
  return { page: pageData, hardware: (hardwareResult?.results || []).map((item) => ({ id: item.id, catalogueHardwareId: item.catalogue_hardware_id || null, publicName: item.display_name, manufacturer: item.manufacturer || '', shortDescription: item.description, chainRationale: item.chain_rationale, sessionType: item.session_type, visible: item.visibility === 'visible', mediaId: item.media_id || null, imageAltText: item.image_alt_text || '', imageCaption: item.image_caption || '', media: mediaProjection(item), videos: videos.get(item.id) || [] })), softwareGroups: (softwareResult?.results || []).map((group) => ({ id: group.id, displayName: group.display_name, description: group.description, visible: group.visibility === 'visible', mediaId: group.media_id || null, imageAltText: group.image_alt_text || '', media: mediaProjection(group) })) };
};

const assertActiveMedia = async (database, ids) => {
  for (const id of ids.filter(Boolean)) { const media = await database.prepare('SELECT id,lifecycle_state FROM cms_media_assets WHERE id=? LIMIT 1').bind(id).first(); if (!media || media.lifecycle_state !== 'active') fail('Only active Media Library images can be assigned.', 409); }
};
const statement = (database, sql, ...values) => database.prepare(sql).bind(...values);

export const saveStudioDocument = async ({ database, document, subject }) => {
  const data = normaliseStudioDocument(document);
  await assertActiveMedia(database, [data.page.heroMediaId, ...data.hardware.map((item) => item.mediaId), ...data.softwareGroups.map((item) => item.mediaId)]);
  const now = new Date().toISOString();
  const operations = [
    statement(database, `INSERT INTO cms_studio_pages (page_id,title,intro,hardware_heading,hardware_intro,software_heading,software_summary,hero_media_id,hero_alt_text,visibility,publication_state,published_at,published_by,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,'published',?,?,?,?) ON CONFLICT(page_id) DO UPDATE SET title=excluded.title,intro=excluded.intro,hardware_heading=excluded.hardware_heading,hardware_intro=excluded.hardware_intro,software_heading=excluded.software_heading,software_summary=excluded.software_summary,hero_media_id=excluded.hero_media_id,hero_alt_text=excluded.hero_alt_text,visibility=excluded.visibility,updated_at=excluded.updated_at,updated_by=excluded.updated_by`, STUDIO_PAGE_ID, data.page.title, data.page.intro, data.page.hardwareHeading, data.page.hardwareIntro, data.page.softwareHeading, data.page.softwareSummary, data.page.heroMediaId, data.page.heroAltText, data.page.visible ? 'visible' : 'hidden', now, subject, now, subject),
    statement(database, 'DELETE FROM cms_studio_hardware_items WHERE page_id=?', STUDIO_PAGE_ID),
    statement(database, 'DELETE FROM cms_studio_software_groups WHERE page_id=?', STUDIO_PAGE_ID),
  ];
  for (const item of data.hardware) {
    operations.push(statement(database, `INSERT INTO cms_studio_hardware_items (id,page_id,display_name,display_order,session_type,manufacturer,catalogue_hardware_id,media_id,image_alt_text,image_caption,description,chain_rationale,visibility,publication_state,published_at,published_by,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'published',?,?,?,?)`, item.id, STUDIO_PAGE_ID, item.publicName, item.displayOrder, item.sessionType, item.manufacturer, item.catalogueHardwareId, item.mediaId, item.altText, item.imageCaption, item.shortDescription, item.chainRationale, item.visible ? 'visible' : 'hidden', now, subject, now, subject));
    for (const video of item.videos) operations.push(statement(database, 'INSERT INTO cms_studio_hardware_videos (hardware_item_id,display_order,youtube_video_id,title,caption) VALUES (?,?,?,?,?)', item.id, video.displayOrder, video.youtubeVideoId, video.title, video.caption));
  }
  for (const group of data.softwareGroups) operations.push(statement(database, `INSERT INTO cms_studio_software_groups (id,page_id,display_name,description,media_id,image_alt_text,display_order,visibility,publication_state,published_at,published_by,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,'published',?,?,?,?)`, group.id, STUDIO_PAGE_ID, group.displayName, group.description, group.mediaId, group.altText, group.displayOrder, group.visible ? 'visible' : 'hidden', now, subject, now, subject));
  await database.batch(operations);
  return loadStudioDocument(database);
};
