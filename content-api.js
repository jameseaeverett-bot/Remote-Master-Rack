(() => {
  const records = {};
  const listeners = new Set();
  const notify = () => listeners.forEach((listener) => listener());
  const merge = (id, fallback) => ({ ...fallback, ...(records[id] || {}) });
  const has = (id, field) => Object.prototype.hasOwnProperty.call(records[id] || {}, field);

  window.RMRContent = {
    get: merge,
    has,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };

  fetch('/api/content', { headers: { Accept: 'application/json' }, cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .then((payload) => {
      if (!payload || payload.version !== 1 || !payload.records || typeof payload.records !== 'object') return;
      Object.entries(payload.records).forEach(([id, fields]) => {
        if (fields && typeof fields === 'object' && !Array.isArray(fields)) records[id] = fields;
      });
      // The CMS V2 extension is optional. Invalid/missing entries stay out of
      // the browser store so every existing product keeps its built-in artwork.
      window.RMRProductMedia?.setAssignments(payload.extensions?.cmsV2?.productMedia || []);
      notify();
    })
    .catch(() => {});
})();