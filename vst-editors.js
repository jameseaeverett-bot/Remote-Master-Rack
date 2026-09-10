const editorGallery = document.querySelector('[data-editor-gallery]');

if (editorGallery) {
  rmrVstEditors.forEach((editor) => {
    const card = document.createElement('article');
    card.className = `editor-card editor-card--${editor.slug}`;

    const visual = document.createElement('div');
    visual.className = 'editor-visual';
    visual.setAttribute('aria-hidden', 'true');
    visual.innerHTML = '<span>RMR</span><i></i><b></b>';
    visual.querySelector('b').textContent = editor.visualLabel;

    const metadata = document.createElement('div');
    metadata.className = 'editor-card__content';
    metadata.innerHTML = '<p class="eyebrow"></p><h2></h2><p class="editor-card__description"></p><p class="status-pill"></p>';
    metadata.querySelector('.eyebrow').textContent = editor.hardware;
    metadata.querySelector('h2').textContent = editor.name;
    metadata.querySelector('.editor-card__description').textContent = editor.description;
    metadata.querySelector('.status-pill').textContent = editor.status;

    const link = document.createElement('a');
    link.className = 'editor-card__link secondary';
    link.href = editorUrl(editor.slug);
    link.textContent = `Explore ${editor.name}`;
    link.setAttribute('aria-label', `Explore ${editor.name}`);

    metadata.append(link);
    card.append(visual, metadata);
    editorGallery.append(card);
  });
}
