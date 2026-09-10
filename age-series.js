const ageGallery = document.querySelector('[data-age-gallery]');

if (ageGallery) {
  rmrAgeProducts.forEach((product) => {
    const card = document.createElement('article');
    card.className = `editor-card age-card age-card--${product.slug}`;

    const visual = document.createElement('div');
    visual.className = 'editor-visual age-visual';
    visual.setAttribute('aria-hidden', 'true');
    visual.innerHTML = '<span>RMR</span><i></i><b></b>';
    visual.querySelector('b').textContent = product.visualLabel;

    const content = document.createElement('div');
    content.className = 'editor-card__content';
    content.innerHTML = '<p class="eyebrow">AGE SERIES</p><h2></h2><p class="editor-card__description"></p><p class="status-pill"></p><button class="editor-card__link secondary" type="button" disabled>Coming Soon</button>';
    content.querySelector('h2').textContent = product.name;
    content.querySelector('.editor-card__description').textContent = product.description;
    content.querySelector('.status-pill').textContent = product.status;

    card.append(visual, content);
    ageGallery.append(card);
  });
}
