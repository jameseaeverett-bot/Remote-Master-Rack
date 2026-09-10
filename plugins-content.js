const pluginsContent = () => window.RMRContent?.get('plugins', {}) || {};
const applyPluginsContent = () => {
  const content = pluginsContent();
  if (content.heading) document.querySelector('[data-plugins-heading]')?.replaceChildren(document.createTextNode(content.heading));
  if (content.intro) document.querySelector('[data-plugins-intro]')?.replaceChildren(document.createTextNode(content.intro));
  const vst = window.RMRContent?.get('vst-editors', {}) || {};
  const age = window.RMRContent?.get('age-series', {}) || {};
  if (vst.title) document.querySelector('[data-vst-title]')?.replaceChildren(document.createTextNode(vst.title));
  if (vst.cardDescription) document.querySelector('[data-vst-card-description]')?.replaceChildren(document.createTextNode(vst.cardDescription));
  if (vst.ctaLabel) document.querySelector('[data-vst-cta]')?.replaceChildren(document.createTextNode(vst.ctaLabel));
  if (age.title) document.querySelector('[data-age-title]')?.replaceChildren(document.createTextNode(age.title));
  if (age.cardDescription) document.querySelector('[data-age-card-description]')?.replaceChildren(document.createTextNode(age.cardDescription));
  if (age.ctaLabel) document.querySelector('[data-age-cta]')?.replaceChildren(document.createTextNode(age.ctaLabel));
};
applyPluginsContent();
window.RMRContent?.subscribe(applyPluginsContent);
