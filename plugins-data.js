const rmrVstEditors = [
  {
    slug: 'folktek-resonant-garden',
    name: 'RMR Resonant Garden Recall',
    hardware: 'Editor for Folktek Resonant Garden hardware',
    compatibility: 'Folktek Resonant Garden hardware',
    description: 'A focused recall surface for Resonant Garden hardware workflows.',
    visualLabel: 'RESONANT',
    status: 'Coming Soon'
  },
  {
    slug: 'pultec-eqp-1a',
    name: 'RMR Pultec Recall',
    hardware: 'Editor for Pultec EQP-1A hardware',
    compatibility: 'Pultec EQP-1A hardware',
    description: 'A focused recall surface for EQP-1A hardware workflows.',
    visualLabel: 'PULTEC',
    status: 'Coming Soon'
  },
  {
    slug: 'ssl-fusion',
    name: 'RMR Fusion Recall',
    hardware: 'Editor for Solid State Logic Fusion™ hardware',
    compatibility: 'Solid State Logic Fusion™ hardware',
    description: 'A focused recall surface for Fusion hardware workflows.',
    visualLabel: 'FUSION',
    status: 'Coming Soon'
  }
];

function getRmrVstEditor(slug) {
  return rmrVstEditors.find((editor) => editor.slug === slug);
}

function editorUrl(slug) {
  return `/plugins/vst-editors/${slug}`;
}

function presetUrl(slug) {
  return `/plugins/vst-editors/presets?editor=${encodeURIComponent(slug)}`;
}

function sharePresetUrl(slug) {
  return `/plugins/vst-editors/presets/share?editor=${encodeURIComponent(slug)}`;
}
