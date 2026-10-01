import { loadAboutDocument } from './cms-about.js';
import { validCmsMediaId, validCmsMediaRevision } from './cms-media.js';

const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : null;
const text = value => typeof value === 'string' ? value : '';
const publicMedia = (media, altText) => {
  const source = object(media);
  if (!source || !validCmsMediaId(source.id) || !validCmsMediaRevision(source.revision) || !text(altText).trim()) return null;
  return { mediaId: source.id, revision: source.revision, altText: text(altText) };
};
export const publicAboutProjection = document => {
  const source = object(document);
  if (!source || source.visible !== true) return null;
  const link = object(source.profile);
  return { image: publicMedia(source.image?.media, source.image?.imageAltText), heading: text(source.heading), intro: text(source.intro), paragraphs: Array.isArray(source.paragraphs) ? source.paragraphs.map(item => text(object(item).body)).filter(Boolean) : [], profile: text(link.label).trim() && text(link.url).trim() ? { label: text(link.label), url: text(link.url) } : null };
};

export const loadPublicAboutDocument = async database => publicAboutProjection(await loadAboutDocument(database));
