const dialog = document.querySelector('.waitlist');
document.querySelectorAll('[data-open-modal]').forEach((button) => button.addEventListener('click', () => dialog.showModal()));
document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => dialog.close()));
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
