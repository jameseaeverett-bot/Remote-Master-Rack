import { loadAboutDocument } from './cms-about.js';
import { validCmsMediaId, validCmsMediaRevision } from './cms-media.js';

const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : null;
const text = value => typeof value === 'string' ? value : '';
const publicMedia = (media, altText) => {
  const source = object(media);
  if (!source || !validCmsMediaId(source.id) || !validCmsMediaRevision(source.revision) || !text(altText).trim()) return null;
  return { mediaId: source.id, revision: source.revision, altText: text(altText) };
};
const publicSection = section => {
  const source = object(section);
  return { eyebrow: text(source?.eyebrow), heading: text(source?.heading), body: text(source?.body), image: publicMedia(source?.media, source?.imageAltText) };
};
const publicCta = cta => {
  const source = object(cta);
  const link = (label, destination) => text(label).trim() && text(destination).trim() ? { label: text(label), destination: text(destination) } : null;
  return { eyebrow: text(source?.eyebrow), heading: text(source?.heading), body: text(source?.body), primary: link(source?.primaryLabel, source?.primaryDestination), secondary: link(source?.secondaryLabel, source?.secondaryDestination) };
};

export const publicAboutProjection = document => {
  const source = object(document);
  if (!source || source.visible !== true) return null;
  return { hero: { eyebrow: text(source.hero?.eyebrow), heading: text(source.hero?.heading), intro: text(source.hero?.intro), image: publicMedia(source.hero?.media, source.hero?.imageAltText) }, sections: { why: publicSection(source.sections?.why), approach: publicSection(source.sections?.approach), story: publicSection(source.sections?.story), future: publicSection(source.sections?.future) }, cta: publicCta(source.cta) };
};

export const loadPublicAboutDocument = async database => publicAboutProjection(await loadAboutDocument(database));
