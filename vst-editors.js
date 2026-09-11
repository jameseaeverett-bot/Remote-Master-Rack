const editorGallery = document.querySelector('[data-editor-gallery]');
const contentFor = (id, fallback) => window.RMRContent?.get(id, fallback) || fallback;

const applyVstPageContent = () => {
  const content = contentFor('vst-editors', {});
  if (content.heading) document.querySelector('[data-vst-heading]')?.replaceChildren(document.createTextNode(content.heading));
  if (content.intro) document.querySelector('[data-vst-intro]')?.replaceChildren(document.createTextNode(content.intro));
};

const renderEditorGallery = () => {
  if (!editorGallery) return;
  editorGallery.replaceChildren();
  rmrVstEditors.forEach((baseEditor) => {
    const editor = { ...baseEditor, ...contentFor(baseEditor.slug, {}) };
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
    metadata.querySelector('h2').textContent = editor.title || editor.name;
    const description = metadata.querySelector('.editor-card__description');
    description.textContent = editor.cardDescription;
    description.hidden = editor.cardDescription === '';
    metadata.querySelector('.status-pill').textContent = editor.status;

    const link = document.createElement('a');
    link.className = 'editor-card__link secondary';
    link.href = editorUrl(editor.slug);
    link.textContent = editor.ctaLabel || `Explore ${editor.title || editor.name}`;
    link.setAttribute('aria-label', editor.ctaLabel || `Explore ${editor.title || editor.name}`);

    metadata.append(link);
    card.append(visual, metadata);
    editorGallery.append(card);
  });
};

applyVstPageContent();
renderEditorGallery();
window.RMRContent?.subscribe(() => { applyVstPageContent(); renderEditorGallery(); });
