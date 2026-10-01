(() => {
  const target = document.getElementById('about-content');
  if (!target) return;
  const element = (tag, className = '', value = '') => { const node = document.createElement(tag); if (className) node.className = className; if (value) node.textContent = value; return node; };
  const image = asset => {
    if (!asset?.mediaId || !asset?.revision || !asset?.altText) return null;
    const node = document.createElement('img'); node.className = 'about-media'; node.alt = asset.altText; node.src = `/media/${encodeURIComponent(asset.mediaId)}/${encodeURIComponent(asset.revision)}`; node.addEventListener('error', () => node.remove());
    return node;
  };
  const copy = (value, className) => value ? element('p', className, value) : null;
  const section = (data, key) => {
    if (!data || !(data.eyebrow || data.heading || data.body || data.image)) return null;
    const node = element('section', `about-section about-section--${key}`); const content = element('div', 'about-section__copy');
    if (data.eyebrow) content.append(element('p', 'eyebrow', data.eyebrow)); if (data.heading) content.append(element('h2', '', data.heading)); const body = copy(data.body, 'about-section__body'); if (body) content.append(body); node.append(content); const visual = image(data.image); if (visual) node.append(visual); return node;
  };
  const link = (data, primary) => { if (!data?.label || !data?.destination) return null; const node = element('a', primary ? 'primary' : 'secondary', data.label); node.href = data.destination; return node; };
  const render = () => {
    const about = window.RMRContent?.getExtension('cmsV2')?.about;
    if (!about?.hero?.heading) return;
    const fragment = document.createDocumentFragment(); const hero = element('section', 'about-hero'); const heroCopy = element('div', 'about-hero__copy');
    if (about.hero.eyebrow) heroCopy.append(element('p', 'eyebrow', about.hero.eyebrow)); heroCopy.append(element('h1', '', about.hero.heading)); const intro = copy(about.hero.intro, 'intro'); if (intro) heroCopy.append(intro); hero.append(heroCopy); const heroImage = image(about.hero.image); if (heroImage) hero.append(heroImage); fragment.append(hero);
    ['why', 'approach', 'story', 'future'].forEach(key => { const node = section(about.sections?.[key], key); if (node) fragment.append(node); });
    const cta = about.cta; if (cta && (cta.eyebrow || cta.heading || cta.body || cta.primary || cta.secondary)) { const node = element('section', 'about-cta'); if (cta.eyebrow) node.append(element('p', 'eyebrow', cta.eyebrow)); if (cta.heading) node.append(element('h2', '', cta.heading)); const body = copy(cta.body, 'about-section__body'); if (body) node.append(body); const actions = element('div', 'about-cta__actions'); [link(cta.primary, true), link(cta.secondary, false)].filter(Boolean).forEach(item => actions.append(item)); if (actions.childNodes.length) node.append(actions); fragment.append(node); }
    target.replaceChildren(fragment);
  };
  window.RMRContent?.subscribe(render); render();
})();
