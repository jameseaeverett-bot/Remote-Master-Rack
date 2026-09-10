const detailRoot = document.querySelector('[data-editor-detail]');

if (detailRoot) {
  const editor = getRmrVstEditor(detailRoot.dataset.editorDetail);

  if (!editor) {
    detailRoot.innerHTML = '<p class="destination-note">This editor could not be found.</p><a class="secondary" href="/plugins/vst-editors">Return to VST Editors</a>';
  } else {
    document.title = `${editor.name} — Remote Master Rack`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', `${editor.name}. ${editor.hardware}.`);
    detailRoot.querySelectorAll('[data-editor-hardware]').forEach((element) => { element.textContent = editor.hardware; });
    detailRoot.querySelector('[data-editor-title]').textContent = editor.name;
    detailRoot.querySelector('[data-editor-description]').textContent = editor.description;
    detailRoot.querySelector('[data-editor-status]').textContent = editor.status;
    detailRoot.querySelector('[data-editor-presets]').href = presetUrl(editor.slug);
    detailRoot.querySelector('[data-editor-share]').href = sharePresetUrl(editor.slug);
    detailRoot.querySelector('[data-editor-visual]').dataset.editorVisual = editor.slug;
    detailRoot.querySelector('[data-editor-visual-label]').textContent = editor.visualLabel;
  }
}
