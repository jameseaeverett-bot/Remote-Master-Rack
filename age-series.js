const ageGallery = document.querySelector('[data-age-gallery]');
const ageContent = (id, fallback) => window.RMRContent?.get(id, fallback) || fallback;
const applyAgePageContent = () => {
  const content = ageContent('age-series', {});
  if (content.heading) document.querySelector('[data-age-heading]')?.replaceChildren(document.createTextNode(content.heading));
  if (content.intro) document.querySelector('[data-age-intro]')?.replaceChildren(document.createTextNode(content.intro));
};
const renderAgeGallery = () => {
  if (!ageGallery) return;
  ageGallery.replaceChildren();
  rmrAgeProducts.forEach((baseProduct) => {
    const product = { ...baseProduct, ...ageContent(baseProduct.slug, {}) };
    const card = document.createElement('article');
    card.className = `editor-card age-card age-card--${product.slug}`;

    const visual = document.createElement('div');
    visual.className = 'editor-visual age-visual';
    visual.setAttribute('aria-hidden', 'true');
    visual.innerHTML = '<span>RMR</span><i></i><b></b>';
    visual.querySelector('b').textContent = product.visualLabel;

    const content = document.createElement('div');
    content.className = 'editor-card__content';
    content.innerHTML = '<p class="eyebrow">AGE SERIES</p><h2></h2><p class="editor-card__description"></p><p class="status-pill"></p><button class="editor-card__link secondary" type="button" disabled></button>';
    content.querySelector('h2').textContent = product.title || product.name;
    const description = content.querySelector('.editor-card__description');
    description.textContent = product.cardDescription;
    description.hidden = product.cardDescription === '';
    content.querySelector('.status-pill').textContent = product.status;
    content.querySelector('button').textContent = product.ctaLabel || 'Coming Soon';

    card.append(visual, content);
    ageGallery.append(card);
  });
};
applyAgePageContent();
renderAgeGallery();
window.RMRContent?.subscribe(() => { applyAgePageContent(); renderAgeGallery(); });
