const destinations = [
  ['login-book.html', 'Login & Book', 'login-book'],
  ['create-account.html', 'Create Account', 'create-account'],
  ['tools.html', 'Tools', 'tools'],
  ['plugins.html', 'Plugins', 'plugins'],
  ['store.html', 'Store', 'store'],
  ['the-rmr-studio.html', 'The RMR Studio', 'the-rmr-studio'],
  ['about.html', 'About', 'about']
];

const currentPage = document.body.dataset.page;

document.querySelectorAll('[data-navigation]').forEach((navigation) => {
  destinations.forEach(([href, label, page]) => {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    if (page === currentPage) link.setAttribute('aria-current', 'page');
    navigation.append(link);
  });
});
