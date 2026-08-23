const requiredFields = ['heroHeading', 'heroBody', 'primaryButton', 'secondaryButton', 'statusText', 'footerText'];

const applyContent = (content) => {
  const missingFields = requiredFields.filter((field) => typeof content[field] !== 'string');
  if (missingFields.length) throw new Error(`website-content.json is missing: ${missingFields.join(', ')}`);

  document.title = `Remote Master Rack — ${content.statusText}`;
  document.querySelectorAll('[data-content]').forEach((element) => {
    element.textContent = content[element.dataset.content];
  });
  console.info('[RMR Website] Homepage content loaded successfully.', { source: './website-content.json', fields: requiredFields });
};

const contentUrl = new URL('./website-content.json', window.location.href);
contentUrl.searchParams.set('v', Date.now().toString());

fetch(contentUrl.toString(), { cache: 'no-store' })
  .then((response) => {
    if (!response.ok) throw new Error(`Content request failed: HTTP ${response.status}`);
    return response.json();
  })
  .then(applyContent)
  .catch((error) => {
    console.error('[RMR Website] Unable to load homepage content.', { url: contentUrl.toString(), error });
    document.body.classList.add('content-unavailable');
  });

const dialog = document.querySelector('.waitlist');
document.querySelector('[data-open-modal]').addEventListener('click', () => dialog.showModal());
document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => dialog.close()));
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
