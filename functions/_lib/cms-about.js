import { validCmsMediaId } from './cms-media.js';

export const ABOUT_PAGE_ID = 'about';
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value, limit, label, { required = false } = {}) => {
  const clean = typeof value === 'string' ? value.trim().replace(/\r\n?/g, '\n') : value == null ? '' : String(value).trim();
  if (clean.length > limit) fail(`${label} is too long.`);
  if (required && !clean) fail(`${label} is required.`);
  return clean;
};
const optionalMedia = (value, altText, label) => {
  const mediaId = value == null || value === '' ? null : text(value, 96, `${label} image`);
  if (mediaId && !validCmsMediaId(mediaId)) fail(`${label} image is invalid.`);
  const alt = text(altText, 500, `${label} image alt text`);
  if (mediaId && !alt) fail(`${label} image alt text is required when an image is selected.`);
  return { mediaId, altText: alt };
};
const destination = (value, label) => {
  const clean = text(value, 512, label);
  if (clean && !/^\/(?:[a-z0-9-]+)?(?:#[a-z0-9-]+)?$/i.test(clean)) fail(`${label} must be an RMR website path.`);
  return clean;
};
const cta = (value, label) => {
  const source = object(value);
  const result = { eyebrow: text(source.eyebrow, 160, `${label} eyebrow`), heading: text(source.heading, 160, `${label} heading`), body: text(source.body, 4000, `${label} body`), primaryLabel: text(source.primaryLabel, 120, 'Primary button label'), primaryDestination: destination(source.primaryDestination, 'Primary button destination'), secondaryLabel: text(source.secondaryLabel, 120, 'Secondary button label'), secondaryDestination: destination(source.secondaryDestination, 'Secondary button destination') };
  if (Boolean(result.primaryLabel) !== Boolean(result.primaryDestination)) fail('Primary button label and destination must be provided together.');
  if (Boolean(result.secondaryLabel) !== Boolean(result.secondaryDestination)) fail('Secondary button label and destination must be provided together.');
  return result;
};
const section = (value, key, label) => {
  const source = object(value); const image = optionalMedia(source.mediaId, source.imageAltText, label);
  return { key, eyebrow: text(source.eyebrow, 160, `${label} eyebrow`), heading: text(source.heading, 160, `${label} heading`), body: text(source.body, 6000, `${label} body`), ...image };
};

export const normaliseLegacyAboutDocument = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('An About page document is required.');
  const heroSource = object(value.hero); const heroImage = optionalMedia(heroSource.mediaId, heroSource.imageAltText, 'Hero');
  return {
    hero: { eyebrow: text(heroSource.eyebrow, 160, 'Hero eyebrow'), heading: text(heroSource.heading, 160, 'Hero heading', { required: true }), intro: text(heroSource.intro, 4000, 'Hero intro'), ...heroImage },
    sections: [section(value.sections?.why, 'why', 'Why RMR'), section(value.sections?.approach, 'approach', 'The RMR Approach'), section(value.sections?.story, 'story', 'The Story'), section(value.sections?.future, 'future', 'Where RMR Is Going')],
    cta: cta(value.cta, 'Final CTA'),
    visible: value.visible !== false,
  };
};

const mediaProjection = (row, prefix) => row?.[`${prefix}_id`] ? ({ id: row[`${prefix}_id`], originalFilename: row[`${prefix}_filename`], contentType: row[`${prefix}_content_type`], fileSizeBytes: Number(row[`${prefix}_file_size_bytes`]), width: Number(row[`${prefix}_width`]), height: Number(row[`${prefix}_height`]), revision: String(row[`${prefix}_sha256`] || '').slice(0, 16), lifecycleState: row[`${prefix}_lifecycle_state`] }) : null;
const selectMedia = (prefix) => `m_${prefix}.id AS ${prefix}_id,m_${prefix}.original_filename AS ${prefix}_filename,m_${prefix}.content_type AS ${prefix}_content_type,m_${prefix}.file_size_bytes AS ${prefix}_file_size_bytes,m_${prefix}.width AS ${prefix}_width,m_${prefix}.height AS ${prefix}_height,m_${prefix}.sha256 AS ${prefix}_sha256,m_${prefix}.lifecycle_state AS ${prefix}_lifecycle_state`;
const joins = ['hero', 'why', 'approach', 'story', 'future'].map(prefix => `LEFT JOIN cms_media_assets m_${prefix} ON m_${prefix}.id=p.${prefix}_media_id`).join(' ');
const mediaFields = ['hero', 'why', 'approach', 'story', 'future'].map(selectMedia).join(',');
const rowDocument = row => row ? {
  hero: { eyebrow: row.hero_eyebrow, heading: row.hero_heading, intro: row.hero_intro, mediaId: row.hero_media_id || null, imageAltText: row.hero_alt_text || '', media: mediaProjection(row, 'hero') },
  sections: {
    why: { eyebrow: row.why_eyebrow, heading: row.why_heading, body: row.why_body, mediaId: row.why_media_id || null, imageAltText: row.why_alt_text || '', media: mediaProjection(row, 'why') },
    approach: { eyebrow: row.approach_eyebrow, heading: row.approach_heading, body: row.approach_body, mediaId: row.approach_media_id || null, imageAltText: row.approach_alt_text || '', media: mediaProjection(row, 'approach') },
    story: { eyebrow: row.story_eyebrow, heading: row.story_heading, body: row.story_body, mediaId: row.story_media_id || null, imageAltText: row.story_alt_text || '', media: mediaProjection(row, 'story') },
    future: { eyebrow: row.future_eyebrow, heading: row.future_heading, body: row.future_body, mediaId: row.future_media_id || null, imageAltText: row.future_alt_text || '', media: mediaProjection(row, 'future') },
  },
  cta: { eyebrow: row.cta_eyebrow, heading: row.cta_heading, body: row.cta_body, primaryLabel: row.primary_cta_label, primaryDestination: row.primary_cta_destination, secondaryLabel: row.secondary_cta_label, secondaryDestination: row.secondary_cta_destination },
  visible: row.visibility === 'visible',
} : null;

export const loadLegacyAboutDocument = async database => {
  const row = await database.prepare(`SELECT p.*,${mediaFields} FROM cms_about_pages p ${joins} WHERE p.page_id=? LIMIT 1`).bind(ABOUT_PAGE_ID).first();
  return rowDocument(row);
};
const assertActiveMedia = async (database, ids) => {
  for (const id of ids.filter(Boolean)) { const item = await database.prepare('SELECT id,lifecycle_state FROM cms_media_assets WHERE id=? LIMIT 1').bind(id).first(); if (!item || item.lifecycle_state !== 'active') fail('Only active Media Library images can be assigned.', 409); }
};

export const saveLegacyAboutDocument = async ({ database, document, subject }) => {
  const data = normaliseLegacyAboutDocument(document); const sections = Object.fromEntries(data.sections.map(item => [item.key, item]));
  await assertActiveMedia(database, [data.hero.mediaId, ...data.sections.map(item => item.mediaId)]);
  const now = new Date().toISOString();
  await database.prepare(`INSERT INTO cms_about_pages (page_id,hero_eyebrow,hero_heading,hero_intro,hero_media_id,hero_alt_text,why_eyebrow,why_heading,why_body,why_media_id,why_alt_text,approach_eyebrow,approach_heading,approach_body,approach_media_id,approach_alt_text,story_eyebrow,story_heading,story_body,story_media_id,story_alt_text,future_eyebrow,future_heading,future_body,future_media_id,future_alt_text,cta_eyebrow,cta_heading,cta_body,primary_cta_label,primary_cta_destination,secondary_cta_label,secondary_cta_destination,visibility,publication_state,published_at,published_by,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'published',?,?,?,?) ON CONFLICT(page_id) DO UPDATE SET hero_eyebrow=excluded.hero_eyebrow,hero_heading=excluded.hero_heading,hero_intro=excluded.hero_intro,hero_media_id=excluded.hero_media_id,hero_alt_text=excluded.hero_alt_text,why_eyebrow=excluded.why_eyebrow,why_heading=excluded.why_heading,why_body=excluded.why_body,why_media_id=excluded.why_media_id,why_alt_text=excluded.why_alt_text,approach_eyebrow=excluded.approach_eyebrow,approach_heading=excluded.approach_heading,approach_body=excluded.approach_body,approach_media_id=excluded.approach_media_id,approach_alt_text=excluded.approach_alt_text,story_eyebrow=excluded.story_eyebrow,story_heading=excluded.story_heading,story_body=excluded.story_body,story_media_id=excluded.story_media_id,story_alt_text=excluded.story_alt_text,future_eyebrow=excluded.future_eyebrow,future_heading=excluded.future_heading,future_body=excluded.future_body,future_media_id=excluded.future_media_id,future_alt_text=excluded.future_alt_text,cta_eyebrow=excluded.cta_eyebrow,cta_heading=excluded.cta_heading,cta_body=excluded.cta_body,primary_cta_label=excluded.primary_cta_label,primary_cta_destination=excluded.primary_cta_destination,secondary_cta_label=excluded.secondary_cta_label,secondary_cta_destination=excluded.secondary_cta_destination,visibility=excluded.visibility,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(ABOUT_PAGE_ID,data.hero.eyebrow,data.hero.heading,data.hero.intro,data.hero.mediaId,data.hero.altText,sections.why.eyebrow,sections.why.heading,sections.why.body,sections.why.mediaId,sections.why.altText,sections.approach.eyebrow,sections.approach.heading,sections.approach.body,sections.approach.mediaId,sections.approach.altText,sections.story.eyebrow,sections.story.heading,sections.story.body,sections.story.mediaId,sections.story.altText,sections.future.eyebrow,sections.future.heading,sections.future.body,sections.future.mediaId,sections.future.altText,data.cta.eyebrow,data.cta.heading,data.cta.body,data.cta.primaryLabel,data.cta.primaryDestination,data.cta.secondaryLabel,data.cta.secondaryDestination,data.visible ? 'visible' : 'hidden',now,subject,now,subject).run();
  return loadLegacyAboutDocument(database);
};

const articleImage = (value, altText) => {
  const mediaId = value == null || value === '' ? null : text(value, 96, 'About image');
  if (mediaId && !validCmsMediaId(mediaId)) fail('About image is invalid.');
  const imageAltText = text(altText, 500, 'About image alt text');
  if (mediaId && !imageAltText) fail('About image alt text is required when an image is selected.');
  return { mediaId, imageAltText };
};
const articleProfile = value => {
  const source = object(value); const label = text(source.label, 120, 'External profile link label'); const url = text(source.url, 2048, 'External profile URL');
  if (Boolean(label) !== Boolean(url)) fail('External profile link label and URL must be provided together.');
  if (!url) return { label: '', url: '' };
  let parsed; try { parsed = new URL(url); } catch { fail('External profile URL must be a valid HTTPS URL.'); }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) fail('External profile URL must be a valid HTTPS URL.');
  return { label, url: parsed.toString() };
};
const articleParagraphs = value => {
  if (!Array.isArray(value)) fail('Body paragraphs must be a list.');
  return value.map((item, index) => ({ id: text(object(item).id, 96, `Paragraph ${index + 1} ID`) || crypto.randomUUID(), body: text(object(item).body, 20000, `Paragraph ${index + 1}`, { required: true }) }));
};
export const blankAboutDocument = () => ({ image: { mediaId: null, imageAltText: '', media: null }, heading: 'About RMR', intro: '', paragraphs: [], profile: { label: '', url: '' }, visible: true });
export const normaliseAboutDocument = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('An About page document is required.');
  const source = object(value); const image = articleImage(source.image?.mediaId ?? source.mediaId, source.image?.imageAltText ?? source.imageAltText);
  return { image, heading: text(source.heading, 240, 'Page heading', { required: true }), intro: text(source.intro, 20000, 'Intro paragraph'), paragraphs: articleParagraphs(source.paragraphs ?? []), profile: articleProfile(source.profile), visible: source.visible !== false };
};
const articleMedia = row => row?.media_id ? ({ id: row.media_id, originalFilename: row.original_filename, contentType: row.content_type, fileSizeBytes: Number(row.file_size_bytes), width: Number(row.width), height: Number(row.height), revision: String(row.sha256 || '').slice(0, 16), lifecycleState: row.lifecycle_state }) : null;
const articleFromRows = (page, rows) => page ? ({ image: { mediaId: page.media_id || null, imageAltText: page.image_alt_text || '', media: articleMedia(page) }, heading: page.heading || '', intro: page.intro || '', paragraphs: (rows || []).map(row => ({ id: row.paragraph_id, body: row.body })), profile: { label: page.profile_label || '', url: page.profile_url || '' }, visible: page.visibility === 'visible' }) : null;
const loadArticle = async database => {
  const page = await database.prepare(`SELECT p.*,m.id AS media_id,m.original_filename,m.content_type,m.file_size_bytes,m.width,m.height,m.sha256,m.lifecycle_state FROM cms_about_articles p LEFT JOIN cms_media_assets m ON m.id=p.media_id WHERE p.page_id=? LIMIT 1`).bind(ABOUT_PAGE_ID).first();
  if (!page) return null;
  const result = await database.prepare('SELECT paragraph_id,body FROM cms_about_article_paragraphs WHERE page_id=? ORDER BY sort_order ASC, paragraph_id ASC').bind(ABOUT_PAGE_ID).all();
  return articleFromRows(page, result?.results || []);
};
const legacyArticle = legacy => legacy ? ({ image: legacy.hero ? { mediaId: legacy.hero.mediaId, imageAltText: legacy.hero.imageAltText, media: legacy.hero.media } : { mediaId: null, imageAltText: '', media: null }, heading: legacy.hero?.heading || 'About RMR', intro: legacy.hero?.intro || '', paragraphs: ['why', 'approach', 'story', 'future'].flatMap(key => [legacy.sections?.[key]?.heading, legacy.sections?.[key]?.body].filter(Boolean).map((body, index) => ({ id: `legacy-${key}-${index}`, body }))).concat(legacy.cta?.body ? [{ id: 'legacy-cta', body: legacy.cta.body }] : []), profile: { label: '', url: '' }, visible: legacy.visible }) : null;
export const loadAboutDocument = async database => {
  try { const article = await loadArticle(database); if (article) return article; } catch (error) { if (!/no such table/i.test(error?.message || '')) throw error; }
  return legacyArticle(await loadLegacyAboutDocument(database));
};
const assertArticleMedia = async (database, mediaId) => { if (mediaId) { const item = await database.prepare('SELECT id,lifecycle_state FROM cms_media_assets WHERE id=? LIMIT 1').bind(mediaId).first(); if (!item || item.lifecycle_state !== 'active') fail('Only active Media Library images can be assigned.', 409); } };
export const saveAboutDocument = async ({ database, document, subject }) => {
  const data = normaliseAboutDocument(document); await assertArticleMedia(database, data.image.mediaId); const now = new Date().toISOString();
  await database.batch([
    database.prepare(`INSERT INTO cms_about_articles (page_id,media_id,image_alt_text,heading,intro,profile_label,profile_url,visibility,publication_state,published_at,published_by,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,'published',?,?,?,?) ON CONFLICT(page_id) DO UPDATE SET media_id=excluded.media_id,image_alt_text=excluded.image_alt_text,heading=excluded.heading,intro=excluded.intro,profile_label=excluded.profile_label,profile_url=excluded.profile_url,visibility=excluded.visibility,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(ABOUT_PAGE_ID,data.image.mediaId,data.image.imageAltText,data.heading,data.intro,data.profile.label,data.profile.url,data.visible ? 'visible' : 'hidden',now,subject,now,subject),
    database.prepare('DELETE FROM cms_about_article_paragraphs WHERE page_id=?').bind(ABOUT_PAGE_ID),
    ...data.paragraphs.map((paragraph, index) => database.prepare('INSERT INTO cms_about_article_paragraphs (page_id,paragraph_id,sort_order,body) VALUES (?,?,?,?)').bind(ABOUT_PAGE_ID,paragraph.id,index,paragraph.body)),
  ]);
  return loadArticle(database);
};
