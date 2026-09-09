const presetEditorSelect = document.querySelector('[data-preset-editor]');
const presetContext = document.querySelector('[data-preset-context]');
const requestedEditor = new URLSearchParams(window.location.search).get('editor');
const currentPresetEditor = getRmrVstEditor(requestedEditor) || rmrVstEditors[0];

if (presetEditorSelect) {
  rmrVstEditors.forEach((editor) => {
    const option = document.createElement('option');
    option.value = editor.slug;
    option.textContent = editor.name;
    option.selected = editor.slug === currentPresetEditor.slug;
    presetEditorSelect.append(option);
  });
}

if (presetContext) {
  presetContext.textContent = `Preset library for ${currentPresetEditor.name}`;
}
