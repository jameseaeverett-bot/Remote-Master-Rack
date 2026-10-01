(() => {
  const target = document.getElementById('about-content');
  if (!target) return;
  const element = (tag, className = '', value = '') => { const node = document.createElement(tag); if (className) node.className = className; if (value) node.textContent = value; return node; };
  const image = (asset, className = 'about-media') => {
    if (!asset?.mediaId || !asset?.revision || !asset?.altText) return null;
    const node = document.createElement('img'); node.className = className; node.alt = asset.altText; node.src = `/media/${encodeURIComponent(asset.mediaId)}/${encodeURIComponent(asset.revision)}`; node.addEventListener('error', () => node.remove());
    return node;
  };
  const copy = (value, className) => value ? element('p', className, value) : null;
  const render = () => {
    const about = window.RMRContent?.getExtension('cmsV2')?.about;
    if (!about?.heading) return;
    target.className = 'about-page';
    const fragment = document.createDocumentFragment(); const article = element('article', 'about-article'); const opening = element('header', 'about-article__opening'); const visual = image(about.image, 'about-article__image'); if (visual) opening.append(visual); const copyBlock = element('div', 'about-article__intro'); copyBlock.append(element('h1', '', about.heading)); const intro = copy(about.intro, 'intro'); if (intro) copyBlock.append(intro); opening.append(copyBlock); article.append(opening);
    const body = element('div', 'about-article__body'); (about.paragraphs || []).forEach(value => body.append(element('p', '', value))); article.append(body); if (about.profile?.label && about.profile?.url) { const profile = element('p', 'about-article__profile'); const link = element('a', 'text-link', about.profile.label); link.href = about.profile.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; profile.append(link); article.append(profile); } fragment.append(article);
    target.replaceChildren(fragment);
  };
  window.RMRContent?.subscribe(render); render();
})();
