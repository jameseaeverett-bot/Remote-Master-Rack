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

const rmrAgeProducts = [
  { slug: 'age-filter', name: 'AGE FILTER', description: 'A focused filtering tool in development for the AGE Series.', visualLabel: 'FILTER', status: 'In Development' },
  { slug: 'age-drive', name: 'AGE DRIVE', description: 'A drive and character tool in development for the AGE Series.', visualLabel: 'DRIVE', status: 'In Development' },
  { slug: 'age-space', name: 'AGE SPACE', description: 'A spatial processing tool in development for the AGE Series.', visualLabel: 'SPACE', status: 'In Development' },
  { slug: 'age-move', name: 'AGE MOVE', description: 'A movement-focused tool in development for the AGE Series.', visualLabel: 'MOVE', status: 'In Development' },
  { slug: 'age-sample', name: 'AGE SAMPLE', description: 'A sample-focused tool in development for the AGE Series.', visualLabel: 'SAMPLE', status: 'In Development' }
];
