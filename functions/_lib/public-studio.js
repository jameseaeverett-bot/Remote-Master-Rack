import { loadStudioDocument } from './cms-studio.js';
import { validCmsMediaId, validCmsMediaRevision } from './cms-media.js';

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : null;
const text = value => typeof value === 'string' ? value : '';

const publicMedia = (media, altText, caption = '') => {
  const source = object(media);
  if (!source || !validCmsMediaId(source.id) || !validCmsMediaRevision(source.revision) || !text(altText).trim()) return null;
  return { mediaId: source.id, revision: source.revision, altText: text(altText), caption: text(caption) };
};

const videoId = (value) => {
  try {
    const url = new URL(String(value || ''));
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const id = host === 'youtu.be' ? url.pathname.slice(1).split('/')[0]
      : host === 'youtube.com' && url.pathname === '/watch' ? url.searchParams.get('v') : '';
    return YOUTUBE_ID.test(id || '') ? id : null;
  } catch { return null; }
};

const publicHardware = (item) => {
  const source = object(item);
  if (!source || source.visible !== true || !['remote', 'assisted'].includes(source.sessionType)) return null;
  return {
    id: text(source.id),
    publicName: text(source.publicName),
    manufacturer: text(source.manufacturer),
    shortDescription: text(source.shortDescription),
    chainRationale: text(source.chainRationale),
    sessionType: source.sessionType,
    image: publicMedia(source.media, source.imageAltText, source.imageCaption),
    videos: (Array.isArray(source.videos) ? source.videos : []).map((video) => {
      const youtubeVideoId = videoId(video?.url);
      return youtubeVideoId ? { youtubeVideoId, title: text(video?.title), caption: text(video?.caption) } : null;
    }).filter(Boolean),
  };
};

const publicSoftwareGroup = (group) => {
  const source = object(group);
  if (!source || source.visible !== true) return null;
  return {
    id: text(source.id),
    displayName: text(source.displayName),
    description: text(source.description),
    image: publicMedia(source.media, source.imageAltText),
  };
};

// The public page receives only authored presentation fields and revisioned
// media references. Operational catalogue links and media storage state remain
// owner-only.
export const publicStudioProjection = (document) => {
  const source = object(document);
  const page = object(source?.page);
  if (!page || page.visible !== true) return null;
  return {
    page: {
      title: text(page.title),
      intro: text(page.intro),
      hardwareHeading: text(page.hardwareHeading),
      hardwareIntro: text(page.hardwareIntro),
      softwareHeading: text(page.softwareHeading),
      softwareSummary: text(page.softwareSummary),
      hero: publicMedia(page.heroMedia, page.heroAltText),
    },
    hardware: (Array.isArray(source.hardware) ? source.hardware : []).map(publicHardware).filter(Boolean),
    softwareGroups: (Array.isArray(source.softwareGroups) ? source.softwareGroups : []).map(publicSoftwareGroup).filter(Boolean),
  };
};

export const loadPublicStudioDocument = async (database) => publicStudioProjection(await loadStudioDocument(database));
