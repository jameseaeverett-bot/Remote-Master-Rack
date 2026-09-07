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
const openModalButton = document.querySelector('[data-open-modal]');
const form = document.querySelector('[data-waitlist-form]');
const successPanel = document.querySelector('[data-waitlist-success]');
const feedback = document.querySelector('[data-waitlist-feedback]') || document.querySelector('#waitlist-feedback');
const submitButton = document.querySelector('[data-waitlist-submit]');
const emailInput = document.querySelector('#waitlist-email');
const firstNameInput = document.querySelector('#waitlist-first-name');
const consentInput = document.querySelector('#waitlist-consent');
const honeypotInput = document.querySelector('[name="website"]');

const resetWaitlist = () => {
  form.hidden = false;
  successPanel.hidden = true;
  form.reset();
  feedback.textContent = '';
  feedback.dataset.state = '';
  submitButton.disabled = false;
  submitButton.textContent = 'Join Waiting List';
};

const openWaitlist = () => {
  resetWaitlist();
  dialog.showModal();
  emailInput.focus();
};

const showFeedback = (message, state = 'error') => {
  feedback.textContent = message;
  feedback.dataset.state = state;
};

const showSuccess = (message, eyebrow) => {
  form.hidden = true;
  successPanel.hidden = false;
  successPanel.querySelector('[data-waitlist-success-message]').textContent = message;
  successPanel.querySelector('[data-waitlist-success-eyebrow]').textContent = eyebrow;
  successPanel.querySelector('[data-close-modal]').focus();
};

openModalButton?.addEventListener('click', openWaitlist);
document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => dialog.close()));
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => openModalButton?.focus());

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim();
  const firstName = firstNameInput.value.trim();

  if (!email || !emailInput.validity.valid) {
    showFeedback('Enter a valid email address.');
    emailInput.focus();
    return;
  }
  if (!consentInput.checked) {
    showFeedback('Please confirm that you would like to receive RMR updates.');
    consentInput.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Joining…';
  showFeedback('');
  try {
    const response = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, firstName, consentMarketing: true, website: honeypotInput.value }),
    });
    const result = await response.json().catch(() => ({}));

    if (response.ok && result.status === 'created') {
      showSuccess("Thanks for joining the Remote Master Rack waiting list. We'll keep you updated as RMR gets closer to launch.", "YOU'RE ON THE LIST");
      return;
    }
    if (response.ok && result.status === 'already_registered') {
      showSuccess("That email address is already on the Remote Master Rack waiting list. We'll keep you updated as RMR gets closer to launch.", "YOU'RE ALREADY ON THE LIST");
      return;
    }
    showFeedback(result.message || 'We could not join the waiting list right now. Please try again shortly.');
  } catch {
    showFeedback('We could not reach the waiting list right now. Please check your connection and try again.');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Join Waiting List';
  }
});
