const accountStatus = document.querySelector('[data-auth-status]');

const showSafeAuthError = () => {
  const query = new URLSearchParams(window.location.search);
  if (query.get('auth') === 'failed') {
    accountStatus.hidden = false;
    accountStatus.textContent = 'We could not complete sign-in. Please try again.';
    history.replaceState({}, '', window.location.pathname);
  }
};

showSafeAuthError();

fetch('/api/account', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
  .then((response) => {
    if (response.ok) window.location.replace('/account.html');
  })
  .catch(() => {
    // The entry page remains usable when account status cannot be checked.
  });
