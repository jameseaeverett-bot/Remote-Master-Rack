const rmrVstEditors = [
  {
    slug: 'folktek-resonant-garden',
    name: 'Folktek Resonant Garden Editor',
    hardware: 'Folktek Resonant Garden',
    description: 'A focused RMR editor product for Resonant Garden workflows.',
    status: 'Coming Soon'
  },
  {
    slug: 'pultec-eqp-1a',
    name: 'Pultec EQP-1A Editor',
    hardware: 'Pultec EQP-1A',
    description: 'A focused RMR editor product for EQP-1A workflows.',
    status: 'Coming Soon'
  },
  {
    slug: 'ssl-fusion',
    name: 'SSL Fusion Editor',
    hardware: 'SSL Fusion',
    description: 'A focused RMR editor product for SSL Fusion workflows.',
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
