const loading = document.querySelector('[data-account-loading]');
const signedIn = document.querySelector('[data-account-signed-in]');
const signedOut = document.querySelector('[data-account-signed-out]');
const displayName = document.querySelector('[data-account-name]');
const email = document.querySelector('[data-account-email]');

fetch('/api/account', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
  .then(async (response) => {
    if (!response.ok) throw new Error('not-authenticated');
    const result = await response.json();
    if (!result.authenticated || !result.account) throw new Error('not-authenticated');
    displayName.textContent = result.account.displayName || 'RMR Customer';
    email.textContent = result.account.email || 'Signed in with Auth0';
    loading.hidden = true;
    signedIn.hidden = false;
  })
  .catch(() => {
    loading.hidden = true;
    signedOut.hidden = false;
  });
