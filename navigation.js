const destinations = [
  ['/login-book', 'Login & Book', 'login-book'],
  ['/create-account', 'Create Account', 'create-account'],
  ['/tools', 'Tools', 'tools'],
  ['/plugins', 'Plugins', 'plugins'],
  ['/store', 'Store', 'store'],
  ['/the-rmr-studio', 'The RMR Studio', 'the-rmr-studio'],
  ['/about', 'About', 'about']
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
