const controls = {
  editor: document.querySelector('[data-preset-editor]'), creator: document.querySelector('[data-preset-creator]'),
  genre: document.querySelector('[data-preset-genre]'), sourceBus: document.querySelector('[data-preset-source]'),
  preset: document.querySelector('[data-preset-select]'), sort: document.querySelector('[data-preset-sort]'),
};
const context = document.querySelector('[data-preset-context]');
const feedback = document.querySelector('[data-preset-feedback]');
const list = document.querySelector('[data-preset-list]');
const detail = document.querySelector('[data-preset-detail]');
let presets = [];

const requestedEditor = new URLSearchParams(window.location.search).get('editor');
if (controls.editor) {
  rmrVstEditors.forEach((editor) => {
    const option = new Option(editor.name, editor.slug, false, editor.slug === requestedEditor);
    controls.editor.add(option);
  });
}

const filterOptions = (control, values) => {
  const selected = control.value;
  while (control.options.length > 1) control.remove(1);
  [...new Set(values.filter(Boolean))].sort().forEach((value) => control.add(new Option(value, value)));
  control.value = [...control.options].some((option) => option.value === selected) ? selected : '';
};

const showDetail = (preset) => {
  if (!preset) return;
  detail.innerHTML = '';
  const label = document.createElement('p'); label.className = 'eyebrow'; label.textContent = preset.editorSlug;
  const title = document.createElement('h2'); title.textContent = preset.title;
  const meta = document.createElement('p'); meta.className = 'preset-meta'; meta.textContent = `${preset.creator} · ${preset.genre || 'Uncategorised'} · ${preset.sourceBus || 'Unspecified source / bus'}`;
  const description = document.createElement('p'); description.textContent = preset.description || 'No description provided.';
  const rating = document.createElement('p'); rating.className = 'preset-rating'; rating.textContent = `${preset.rating.average.toFixed(1)} / 5 · ${preset.rating.count} rating${preset.rating.count === 1 ? '' : 's'} · ${preset.downloadCount} download${preset.downloadCount === 1 ? '' : 's'}`;
  const download = document.createElement('a'); download.className = 'primary'; download.href = `/api/presets/${encodeURIComponent(preset.id)}/download`; download.textContent = 'Download Preset';
  detail.append(label, title, meta, description, rating, download);
};

const render = () => {
  list.innerHTML = '';
  if (!presets.length) { list.innerHTML = '<div class="preset-empty"><p class="eyebrow">NO PUBLISHED PRESETS</p><h2>The library is ready.</h2><p>Published RMR community presets will appear here.</p></div>'; return; }
  presets.forEach((preset) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'preset-row';
    button.innerHTML = '<strong></strong><span></span><small></small>';
    button.querySelector('strong').textContent = preset.title;
    button.querySelector('span').textContent = `${preset.creator} · ${preset.genre || 'Uncategorised'}`;
    button.querySelector('small').textContent = `${preset.rating.average.toFixed(1)} ★ · ${preset.downloadCount} downloads`;
    button.addEventListener('click', () => { controls.preset.value = preset.id; showDetail(preset); });
    list.append(button);
  });
};

const load = async () => {
  const params = new URLSearchParams({ sort: controls.sort.value });
  for (const [key, control] of Object.entries(controls)) if (['editor', 'creator', 'genre', 'sourceBus'].includes(key) && control.value) params.set(key === 'sourceBus' ? 'sourceBus' : key, control.value);
  feedback.textContent = 'Loading presets…';
  try {
    const response = await fetch(`/api/presets?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Preset catalogue is unavailable.');
    presets = data.presets;
    filterOptions(controls.creator, presets.map((preset) => preset.creator)); filterOptions(controls.genre, presets.map((preset) => preset.genre)); filterOptions(controls.sourceBus, presets.map((preset) => preset.sourceBus));
    while (controls.preset.options.length > 1) controls.preset.remove(1);
    presets.forEach((preset) => controls.preset.add(new Option(preset.title, preset.id)));
    feedback.textContent = presets.length ? `${presets.length} preset${presets.length === 1 ? '' : 's'} found.` : 'No published presets match these filters.';
    render();
  } catch (error) { presets = []; render(); feedback.textContent = error.message; }
};

if (controls.editor) {
  const selected = getRmrVstEditor(requestedEditor);
  if (context) context.textContent = selected ? `Community presets for ${selected.name}` : 'Browse shared RMR editor presets.';
  if (selected) {
    const shareLink = document.createElement('a');
    shareLink.className = 'secondary share-entry-link';
    shareLink.href = `/plugins/vst-editors/presets/share?editor=${encodeURIComponent(selected.slug)}`;
    shareLink.textContent = 'Share a Preset';
    context.parentElement.append(shareLink);
  }
  [controls.editor, controls.creator, controls.genre, controls.sourceBus, controls.sort].forEach((control) => control.addEventListener('change', load));
  controls.preset.addEventListener('change', () => showDetail(presets.find((preset) => preset.id === controls.preset.value)));
  load();
}
