const rmrVstEditors = [
  {
    slug: 'folktek-resonant-garden',
    name: 'RMR Resonant Garden Recall',
    hardware: 'Editor for Folktek Resonant Garden hardware',
    compatibility: 'Folktek Resonant Garden hardware',
    cardDescription: 'A focused recall surface for Resonant Garden hardware workflows.',
    detailIntro: 'A focused recall surface for Resonant Garden hardware workflows.',
    description: 'RMR Resonant Garden Recall is a future RMR editor product for supported Resonant Garden hardware workflows. Features and release notes will be published only when verified.',
    visualLabel: 'RESONANT',
    status: 'Coming Soon'
  },
  {
    slug: 'pultec-eqp-1a',
    name: 'RMR Pultec Recall',
    hardware: 'Editor for Pultec EQP-1A hardware',
    compatibility: 'Pultec EQP-1A hardware',
    cardDescription: 'A focused recall surface for EQP-1A hardware workflows.',
    detailIntro: 'A focused recall surface for EQP-1A hardware workflows.',
    description: 'RMR Pultec Recall is a future RMR editor product for supported EQP-1A hardware workflows. Features and release notes will be published only when verified.',
    visualLabel: 'PULTEC',
    status: 'Coming Soon'
  },
  {
    slug: 'ssl-fusion',
    name: 'RMR Fusion Recall',
    hardware: 'Editor for Solid State Logic Fusion™ hardware',
    compatibility: 'Solid State Logic Fusion™ hardware',
    cardDescription: 'A focused recall surface for Fusion hardware workflows.',
    detailIntro: 'A focused recall surface for Fusion hardware workflows.',
    description: 'RMR Fusion Recall is a future RMR editor product for supported Fusion hardware workflows. Features and release notes will be published only when verified.',
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
  { slug: 'age-filter', name: 'AGE FILTER', cardDescription: 'A focused filtering tool in development for the AGE Series.', visualLabel: 'FILTER', status: 'In Development' },
  { slug: 'age-drive', name: 'AGE DRIVE', cardDescription: 'A drive and character tool in development for the AGE Series.', visualLabel: 'DRIVE', status: 'In Development' },
  { slug: 'age-space', name: 'AGE SPACE', cardDescription: 'A spatial processing tool in development for the AGE Series.', visualLabel: 'SPACE', status: 'In Development' },
  { slug: 'age-move', name: 'AGE MOVE', cardDescription: 'A movement-focused tool in development for the AGE Series.', visualLabel: 'MOVE', status: 'In Development' },
  { slug: 'age-sample', name: 'AGE SAMPLE', cardDescription: 'A sample-focused tool in development for the AGE Series.', visualLabel: 'SAMPLE', status: 'In Development' }
];
