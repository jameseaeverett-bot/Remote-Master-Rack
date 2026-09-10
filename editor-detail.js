const detailRoot = document.querySelector('[data-editor-detail]');

if (detailRoot) {
  const baseEditor = getRmrVstEditor(detailRoot.dataset.editorDetail);
  const render = () => {
  const editor = baseEditor && { ...baseEditor, ...(window.RMRContent?.get(baseEditor.slug, {}) || {}) };

  if (!editor) {
    detailRoot.innerHTML = '<p class="destination-note">This editor could not be found.</p><a class="secondary" href="/plugins/vst-editors">Return to VST Editors</a>';
  } else {
    document.title = `${editor.name} — Remote Master Rack`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', `${editor.name}. ${editor.hardware}.`);
    detailRoot.querySelectorAll('[data-editor-hardware]').forEach((element) => { element.textContent = editor.hardware; });
    detailRoot.querySelector('[data-editor-compatibility]').textContent = editor.compatibility || editor.hardware;
    detailRoot.querySelector('[data-editor-title]').textContent = editor.title || editor.name;
    detailRoot.querySelector('[data-editor-description]').textContent = editor.cardDescription || editor.description;
    detailRoot.querySelector('[data-editor-status]').textContent = editor.status;
    detailRoot.querySelector('[data-editor-requirements]').textContent = editor.requirements || 'Windows and macOS release details will be announced with the editor. No download is available yet.';
    detailRoot.querySelector('[data-editor-about]').textContent = editor.description || `RMR ${editor.name} is a future RMR editor product for supported hardware workflows. Features and release notes will be published only when verified.`;
    detailRoot.querySelector('[data-editor-presets]').href = presetUrl(editor.slug);
    detailRoot.querySelector('[data-editor-share]').href = sharePresetUrl(editor.slug);
    detailRoot.querySelector('[data-editor-visual]').dataset.editorVisual = editor.slug;
    detailRoot.querySelector('[data-editor-visual-label]').textContent = editor.visualLabel;
  }
  };
  render();
  window.RMRContent?.subscribe(render);
}
