const rmrTools = [
  { slug: 'daw-detectives', name: 'DAW Detectives', description: 'A practical RMR studio tool in development.', visualLabel: 'DETECTIVES', status: 'In Development', availability: 'Windows availability will be announced when verified.', requirements: 'This product is in development. Features and release information will be published only when verified.' },
  { slug: 'compare', name: 'COMPARE', description: 'A focused comparison tool in development for critical listening workflows.', visualLabel: 'COMPARE', status: 'In Development', availability: 'Platform availability will be announced when verified.', requirements: 'This product is in development. Features and release information will be published only when verified.' },
];

const toolContent = (id, fallback) => window.RMRContent?.get(id, fallback) || fallback;
const toolGallery = document.querySelector('[data-tool-gallery]');

const applyToolsPageContent = () => {
  const content = toolContent('tools', {});
  if (content.heading) document.querySelector('[data-tools-heading]')?.replaceChildren(document.createTextNode(content.heading));
  if (content.intro) document.querySelector('[data-tools-intro]')?.replaceChildren(document.createTextNode(content.intro));
};

const renderToolGallery = () => {
  if (!toolGallery) return;
  toolGallery.replaceChildren();
  rmrTools.forEach((baseTool) => {
    const tool = { ...baseTool, ...toolContent(baseTool.slug, {}) };
    const card = document.createElement('article');
    card.className = `editor-card tool-card tool-card--${tool.slug}`;
    const visual = document.createElement('div');
    visual.className = 'editor-visual tool-visual';
    visual.setAttribute('aria-hidden', 'true');
    visual.innerHTML = '<span>RMR</span><i></i><b></b>';
    visual.querySelector('b').textContent = tool.visualLabel;
    const content = document.createElement('div');
    content.className = 'editor-card__content';
    const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = 'RMR TOOLS';
    const heading = document.createElement('h2'); heading.textContent = tool.title || tool.name;
    const description = document.createElement('p'); description.className = 'editor-card__description'; description.textContent = tool.cardDescription || tool.description;
    const status = document.createElement('p'); status.className = 'status-pill'; status.textContent = tool.status;
    const link = document.createElement('a'); link.className = 'editor-card__link secondary'; link.href = `/tools/${tool.slug}`; link.textContent = tool.ctaLabel || `Explore ${tool.title || tool.name}`;
    content.append(eyebrow, heading, description, status, link);
    card.append(visual, content);
    toolGallery.append(card);
  });
};

const detail = document.querySelector('[data-tool-detail]');
const renderToolDetail = () => {
  if (!detail) return;
  const baseTool = rmrTools.find((item) => item.slug === detail.dataset.toolDetail);
  if (!baseTool) return;
  const tool = { ...baseTool, ...toolContent(baseTool.slug, {}) };
  detail.querySelector('[data-tool-title]').textContent = tool.title || tool.name;
  detail.querySelector('[data-tool-description]').textContent = tool.description || tool.cardDescription || baseTool.description;
  detail.querySelector('[data-tool-status]').textContent = tool.status;
  detail.querySelector('[data-tool-availability]').textContent = tool.availability || tool.compatibility || baseTool.availability;
  detail.querySelector('[data-tool-requirements]').textContent = tool.requirements || baseTool.requirements;
  detail.querySelector('[data-tool-visual]').classList.add(`tool-visual--${tool.slug}`);
  detail.querySelector('[data-tool-visual-label]').textContent = tool.visualLabel;
};

applyToolsPageContent();
renderToolGallery();
renderToolDetail();
window.RMRContent?.subscribe(() => { applyToolsPageContent(); renderToolGallery(); renderToolDetail(); });
