const detailRoot = document.querySelector('[data-editor-detail]');

if (detailRoot) {
  const editor = getRmrVstEditor(detailRoot.dataset.editorDetail);

  if (!editor) {
    detailRoot.innerHTML = '<p class="destination-note">This editor could not be found.</p><a class="secondary" href="/plugins/vst-editors">Return to VST Editors</a>';
  } else {
    document.title = `${editor.name} — Remote Master Rack`;
    detailRoot.querySelector('[data-editor-hardware]').textContent = editor.hardware;
    detailRoot.querySelector('[data-editor-title]').textContent = editor.name;
    detailRoot.querySelector('[data-editor-description]').textContent = editor.description;
    detailRoot.querySelector('[data-editor-status]').textContent = editor.status;
    detailRoot.querySelector('[data-editor-presets]').href = presetUrl(editor.slug);
  }
}
