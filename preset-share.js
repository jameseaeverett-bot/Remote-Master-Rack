const shareQuery = new URLSearchParams(window.location.search);
const shareSlug = shareQuery.get('editor');
const shareEditor = getRmrVstEditor(shareSlug);
const shareRoute = shareEditor ? `/plugins/vst-editors/presets/share?editor=${encodeURIComponent(shareEditor.slug)}` : '';
const communityRoute = shareEditor ? `/plugins/vst-editors/presets?editor=${encodeURIComponent(shareEditor.slug)}` : '/plugins/vst-editors/presets';
const show = (selector) => { document.querySelector(selector).hidden = false; };
const hide = (selector) => { document.querySelector(selector).hidden = true; };

const editorTitle = (editor) => editor.name.replace(/ Editor$/, '');
const editorArticle = (editor) => editor.slug === 'ssl-fusion' ? 'an' : 'a';
if (!shareEditor) {
  hide('[data-share-loading]'); show('[data-share-invalid]');
} else {
  document.title = `Share ${editorArticle(shareEditor)} ${editorTitle(shareEditor)} Preset — Remote Master Rack`;
  document.querySelector('[data-share-heading]').innerHTML = `Share ${editorArticle(shareEditor)} <em>${editorTitle(shareEditor)} preset.</em>`;
  document.querySelector('[data-community-link]').href = communityRoute;
  document.querySelector('[data-success-community]').href = communityRoute;
  const returnTo = encodeURIComponent(shareRoute);
  document.querySelector('[data-share-login]').href = `/auth/login?returnTo=${returnTo}`;
  document.querySelector('[data-share-signup]').href = `/auth/signup?returnTo=${returnTo}`;
  document.querySelector('[data-gate-heading]').textContent = `Share ${editorArticle(shareEditor)} ${editorTitle(shareEditor)} preset`;

  const submissionsRoot = document.querySelector('[data-my-submissions]');
  const renderSubmissions = (submissions) => {
    submissionsRoot.innerHTML = '';
    if (!submissions.length) { submissionsRoot.innerHTML = '<p>No preset submissions yet.</p>'; return; }
    submissions.forEach((submission) => {
      const item = document.createElement('article'); item.className = 'submission-row';
      const title = document.createElement('strong'); title.textContent = submission.title;
      const meta = document.createElement('span'); meta.textContent = `${submission.editor_slug} · ${submission.status.replace('_', ' ')} · ${new Date(`${submission.created_at}Z`).toLocaleDateString()}`;
      item.append(title, meta); submissionsRoot.append(item);
    });
  };

  fetch('/api/presets/share', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
    .then(async (response) => {
      if (response.status === 401) throw new Error('signed-out');
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'unavailable'); return data;
    })
    .then((data) => {
      hide('[data-share-loading]'); show('[data-share-signed-in]');
      document.querySelector('[data-share-editor]').value = shareEditor.name;
      document.querySelector('[data-share-editor-value]').value = shareEditor.slug;
      document.querySelector('[data-share-creator]').value = data.account.displayName || data.account.email || 'RMR Customer';
      renderSubmissions(data.submissions || []);
      if (shareEditor.slug !== 'ssl-fusion') {
        document.querySelector('[data-share-file]').disabled = true;
        document.querySelector('[data-share-submit]').disabled = true;
        document.querySelector('[data-share-format]').textContent = 'Preset sharing for this editor will open after its file format is verified.';
      }
    })
    .catch((error) => { hide('[data-share-loading]'); if (error.message === 'signed-out') show('[data-share-signed-out]'); else { show('[data-share-signed-out]'); document.querySelector('[data-gate-heading]').textContent = 'Preset sharing is temporarily unavailable'; } });

  const form = document.querySelector('[data-share-form]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); const feedback = document.querySelector('[data-share-feedback]'); const submit = document.querySelector('[data-share-submit]');
    if (!form.reportValidity()) return;
    submit.disabled = true; feedback.textContent = 'Uploading preset securely…';
    try {
      const response = await fetch('/api/presets/share', { method: 'POST', body: new FormData(form), credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Preset submission failed.');
      form.hidden = true; show('[data-share-success]');
      document.querySelector('[data-share-success-detail]').textContent = `${data.submission.title} was submitted for ${shareEditor.name} on ${new Date(data.submission.submittedAt).toLocaleString()}.`;
      const submissionsResponse = await fetch('/api/presets/share', { credentials: 'same-origin', cache: 'no-store' });
      if (submissionsResponse.ok) renderSubmissions((await submissionsResponse.json()).submissions || []);
    } catch (error) { feedback.textContent = error.message; submit.disabled = false; }
  });
}
