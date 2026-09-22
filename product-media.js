(() => {
  const validContentId = (value) => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,158}$/.test(value);
  const validMediaId = (value) => typeof value === 'string' && /^media-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  const validRevision = (value) => typeof value === 'string' && /^[a-f0-9]{16}$/i.test(value);
  const slotKeys = new Set(['card-artwork', 'detail-hero']);
  const assignments = new Map();

  const normalise = (value) => {
    if (!value || !validContentId(value.contentId) || !slotKeys.has(value.slotKey) || !validMediaId(value.mediaId) || !validRevision(value.revision)) return null;
    if (typeof value.altText !== 'string' || !value.altText.trim() || value.altText.length > 500) return null;
    if (typeof value.caption !== 'string' || value.caption.length > 1000) return null;
    return { contentId: value.contentId, slotKey: value.slotKey, mediaId: value.mediaId, revision: value.revision, altText: value.altText, caption: value.caption };
  };

  const keyFor = (contentId, slotKey) => `${contentId}:${slotKey}`;
  const setAssignments = (values) => {
    assignments.clear();
    (Array.isArray(values) ? values : []).forEach((value) => {
      const assignment = normalise(value);
      if (assignment) assignments.set(keyFor(assignment.contentId, assignment.slotKey), assignment);
    });
  };
  const get = (contentId, slotKey) => assignments.get(keyFor(contentId, slotKey)) || null;
  const urlFor = (assignment) => assignment && `/media/${encodeURIComponent(assignment.mediaId)}/${encodeURIComponent(assignment.revision)}`;

  // The fallback is drawn first by each existing product view. The CMS image
  // replaces it only after a successful load, so a failed request never leaves
  // an empty artwork region or a broken-image icon.
  const apply = (element, contentId, slotKey, renderFallback) => {
    const assignment = get(contentId, slotKey);
    if (!assignment || !element) return false;
    const url = urlFor(assignment);
    element.dataset.rmrMediaRequest = url;
    const image = new Image();
    image.className = 'cms-product-media';
    image.alt = assignment.altText;
    image.decoding = 'async';
    image.loading = slotKey === 'card-artwork' ? 'lazy' : 'eager';
    image.onload = () => {
      if (element.dataset.rmrMediaRequest !== url) return;
      element.replaceChildren(image);
      element.classList.add('has-cms-media');
      element.removeAttribute('aria-hidden');
    };
    image.onerror = () => {
      if (element.dataset.rmrMediaRequest !== url) return;
      delete element.dataset.rmrMediaRequest;
      renderFallback?.();
    };
    image.src = url;
    return true;
  };

  window.RMRProductMedia = { setAssignments, get, urlFor, apply };
})();