const editorGallery = document.querySelector('[data-editor-gallery]');

if (editorGallery) {
  rmrVstEditors.forEach((editor) => {
    const card = document.createElement('article');
    card.className = 'editor-card';

    const visual = document.createElement('div');
    visual.className = 'editor-visual';
    visual.setAttribute('aria-hidden', 'true');
    visual.innerHTML = '<span>RMR</span><i></i><b>EDITOR</b>';

    const metadata = document.createElement('div');
    metadata.className = 'editor-card__content';
    metadata.innerHTML = '<p class="eyebrow"></p><h2></h2><p class="editor-card__description"></p>';
    metadata.querySelector('.eyebrow').textContent = editor.hardware;
    metadata.querySelector('h2').textContent = editor.name;
    metadata.querySelector('.editor-card__description').textContent = editor.description;

    const link = document.createElement('a');
    link.className = 'editor-card__link';
    link.href = editorUrl(editor.slug);
    link.textContent = `Explore ${editor.name}`;
    link.setAttribute('aria-label', `Explore ${editor.name}`);

    card.append(visual, metadata, link);
    editorGallery.append(card);
  });
}
