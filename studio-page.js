const studioMediaId = value => typeof value === 'string' && /^media-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const studioRevision = value => typeof value === 'string' && /^[a-f0-9]{16}$/i.test(value);
const studioYouTubeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{11}$/.test(value);

export const normalisePublicStudio = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !value.page || typeof value.page !== 'object') return null;
  const media = (item) => item && studioMediaId(item.mediaId) && studioRevision(item.revision) && typeof item.altText === 'string' && item.altText.trim()
    ? { mediaId: item.mediaId, revision: item.revision, altText: item.altText, caption: typeof item.caption === 'string' ? item.caption : '' } : null;
  const hardware = (Array.isArray(value.hardware) ? value.hardware : []).filter(item => item && ['remote', 'assisted'].includes(item.sessionType) && typeof item.publicName === 'string');
  const softwareGroups = (Array.isArray(value.softwareGroups) ? value.softwareGroups : []).filter(item => item && typeof item.displayName === 'string');
  return {
    page: { title: typeof value.page.title === 'string' ? value.page.title : '', intro: typeof value.page.intro === 'string' ? value.page.intro : '', hardwareHeading: typeof value.page.hardwareHeading === 'string' ? value.page.hardwareHeading : '', hardwareIntro: typeof value.page.hardwareIntro === 'string' ? value.page.hardwareIntro : '', softwareHeading: typeof value.page.softwareHeading === 'string' ? value.page.softwareHeading : '', softwareSummary: typeof value.page.softwareSummary === 'string' ? value.page.softwareSummary : '', hero: media(value.page.hero) },
    hardware: hardware.map(item => ({ ...item, image: media(item.image), videos: (Array.isArray(item.videos) ? item.videos : []).filter(video => studioYouTubeId(video?.youtubeVideoId)) })),
    softwareGroups: softwareGroups.map(item => ({ ...item, image: media(item.image) })),
  };
};

const mediaUrl = item => `/media/${encodeURIComponent(item.mediaId)}/${encodeURIComponent(item.revision)}`;
const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; };

const applyImage = (container, image) => {
  if (!image || !container) return;
  const request = mediaUrl(image);
  const node = new Image();
  node.alt = image.altText;
  // This image is intentionally loaded before it replaces the built-in artwork.
  // A detached lazy image may never be requested by Chromium, leaving the
  // fallback visible indefinitely.
  node.loading = 'eager';
  node.decoding = 'async';
  node.onload = () => { if (container.dataset.rmrMediaRequest === request) { container.replaceChildren(node); container.classList.add('has-cms-media'); } };
  node.onerror = () => { if (container.dataset.rmrMediaRequest === request) delete container.dataset.rmrMediaRequest; };
  container.dataset.rmrMediaRequest = request;
  node.src = request;
};

const renderVideos = (videos) => {
  const collection = element('div', 'studio-video-grid');
  videos.forEach((video) => {
    const frame = element('figure', 'studio-video');
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.youtubeVideoId)}`;
    iframe.title = video.title || 'RMR Studio video';
    iframe.loading = 'lazy';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    frame.append(iframe);
    if (video.title || video.caption) { const caption = element('figcaption'); if (video.title) caption.append(element('strong', '', video.title)); if (video.caption) caption.append(element('span', '', video.caption)); frame.append(caption); }
    collection.append(frame);
  });
  return collection;
};

const renderHardware = (target, items) => {
  target.replaceChildren();
  items.forEach((item) => {
    const card = element('article', 'studio-hardware-card');
    const art = element('div', 'studio-hardware-card__visual');
    art.append(element('span', 'studio-hardware-card__mark', 'RMR'));
    applyImage(art, item.image);
    const content = element('div', 'studio-hardware-card__content');
    content.append(element('p', 'eyebrow', item.manufacturer || 'RMR STUDIO'), element('h3', '', item.publicName));
    if (item.shortDescription) content.append(element('p', 'studio-copy', item.shortDescription));
    if (item.chainRationale) { const rationale = element('section', 'studio-rationale'); rationale.append(element('p', 'eyebrow', 'IN THE CHAIN'), element('p', 'studio-copy', item.chainRationale)); content.append(rationale); }
    card.append(art, content);
    const videos = (item.videos || []).filter(video => studioYouTubeId(video.youtubeVideoId));
    if (videos.length) card.append(renderVideos(videos));
    target.append(card);
  });
};

const renderSoftware = (target, groups) => {
  target.replaceChildren();
  groups.forEach((group) => {
    const card = element('article', 'studio-software-card');
    const art = element('div', 'studio-software-card__visual');
    art.append(element('span', '', 'RMR SOFTWARE'));
    applyImage(art, group.image);
    const content = element('div'); content.append(element('h3', '', group.displayName)); if (group.description) content.append(element('p', 'studio-copy', group.description));
    card.append(art, content); target.append(card);
  });
};

const setText = (selector, value, fallback = '') => { const target = document.querySelector(selector); if (target) target.textContent = value || fallback; };

const render = () => {
  const studio = normalisePublicStudio(window.RMRContent?.getExtension?.('cmsV2')?.studio);
  if (!studio) return;
  const remote = studio.hardware.filter(item => item.sessionType === 'remote');
  const assisted = studio.hardware.filter(item => item.sessionType === 'assisted');
  setText('[data-studio-title]', studio.page.title, 'The RMR Studio');
  setText('[data-studio-intro]', studio.page.intro, 'The RMR Studio is being prepared for supervised sessions.');
  applyImage(document.querySelector('[data-studio-hero-image]'), studio.page.hero);
  const remoteSection = document.querySelector('[data-studio-remote]');
  if (remoteSection) { remoteSection.hidden = !remote.length; setText('[data-studio-hardware-heading]', studio.page.hardwareHeading, 'Remote Mastering Chain'); setText('[data-studio-hardware-intro]', studio.page.hardwareIntro); renderHardware(remoteSection.querySelector('[data-studio-remote-list]'), remote); }
  const assistedSection = document.querySelector('[data-studio-assisted]');
  if (assistedSection) { assistedSection.hidden = !assisted.length; renderHardware(assistedSection.querySelector('[data-studio-assisted-list]'), assisted); }
  const softwareSection = document.querySelector('[data-studio-software]');
  if (softwareSection) { softwareSection.hidden = !studio.softwareGroups.length; setText('[data-studio-software-heading]', studio.page.softwareHeading, 'Software & Plugins'); setText('[data-studio-software-summary]', studio.page.softwareSummary); renderSoftware(softwareSection.querySelector('[data-studio-software-list]'), studio.softwareGroups); }
};

if (typeof document !== 'undefined') { render(); window.RMRContent?.subscribe(render); }
