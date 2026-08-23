const config = window.RMRPortalConfig;
const modules = [['Website Content', 'Live', 'owner-portal.html'], ['News', 'Planned'], ['FAQ', 'Planned'], ['Hardware', 'Planned'], ['Pricing', 'Planned'], ['Waiting List', 'Planned'], ['DAW Detectives', 'Planned'], ['Images', 'Planned']];
const fields = ['heroHeading', 'heroBody', 'primaryButton', 'secondaryButton', 'statusText', 'footerText'];
const draftKey = 'rmr-owner-portal:website-content-draft';
const deploymentInterval = 5000;
const deploymentTimeout = 120000;
let savedDraft = {}, latestVersionUrl = config.latestVersionUrl, publishingReady = false, publishing = false, publishTimer, publishStartedAt = 0, activePublish = null;

const byId = id => document.querySelector(`#${id}`);
const values = () => Object.fromEntries(fields.map(field => [field, byId(field).value.trim()]));
const sameContent = (first, second) => fields.every(field => first[field] === second[field]);
const api = (path, options = {}) => fetch(`${config.apiBaseUrl}${path}`, options).then(async response => { const data = await response.json(); if (!response.ok) throw data; return data; });
const formatTime = date => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
const durationLabel = milliseconds => `${Math.max(1, Math.round(milliseconds / 1000))} seconds`;

byId('module-navigation').innerHTML = modules.map(([name, status, href], index) => `<a class="module ${index === 0 ? 'active' : 'planned'}" ${href ? `href="${href}"` : 'href="#" aria-disabled="true"'}><span>${name}</span><small>${status}</small></a>`).join('');

const state = (name, note = '') => { const pill = byId('publish-state'); pill.textContent = name; pill.dataset.state = name.toLowerCase().replaceAll(' ', '-').replace('…', ''); if (note) byId('publish-note').textContent = note; };
const render = () => { const data = values(); fields.forEach(field => { const target = byId(`preview-${field}`); if (target) target.textContent = data[field]; }); byId('preview-footerText').textContent = data.footerText; };
const counts = () => ['heroHeading', 'heroBody'].forEach(field => byId(`${field}-count`).textContent = byId(field).value.length);
const populate = data => { fields.forEach(field => byId(field).value = data[field] || ''); counts(); render(); };
const setPublishButton = isPublishing => { const button = byId('publish-button'); button.disabled = isPublishing; button.innerHTML = isPublishing ? '<span class="button-spinner" aria-hidden="true"></span>Publishing…' : 'Publish to Website'; button.setAttribute('aria-busy', String(isPublishing)); };

const updateStatusPanel = ({ live = true, sync = '✓ Synced', published = '—', commit = '—', deployment = '—' } = {}) => {
  byId('website-live-state').innerHTML = `<i class="${live ? 'live' : 'checking'}"></i> ${live ? 'Live' : 'Checking'}`;
  byId('website-sync-state').textContent = sync;
  byId('status-last-published').textContent = published;
  byId('status-commit').textContent = commit;
  byId('status-deployment').textContent = deployment;
};

const refreshPublishingStatus = async () => { try { const result = await api('/api/publishing-status'); publishingReady = true; byId('setup-card').hidden = true; byId('connection-label').textContent = 'GitHub publishing connected'; return result; } catch (result) { publishingReady = false; byId('setup-card').hidden = false; byId('setup-message').textContent = result.message || 'GitHub publishing needs configuration.'; byId('connection-label').textContent = 'Publishing setup required'; return result; } };
const checkLive = async expected => { try { const result = await api('/api/live-content'); const matched = result.ok && sameContent(expected, result.content); console.info('[RMR Owner Portal] deployed/live state', { matched, expected, live: result.content }); return matched; } catch (error) { console.warn('[RMR Owner Portal] deployed/live state unavailable', error); return false; } };

const showPublishDialog = () => { byId('publish-modal').hidden = false; byId('publish-close').hidden = true; byId('publish-close-action').hidden = true; byId('continue-waiting').hidden = true; byId('publish-actions').hidden = true; byId('publish-modal-eyebrow').textContent = 'PUBLISHING'; byId('publish-modal-title').textContent = 'Publishing Website'; byId('publish-dialog-message').textContent = 'Preparing your current website content…'; byId('publish-commit').textContent = '—'; byId('publish-commit').removeAttribute('href'); byId('publish-live-url').href = config.liveSiteUrl; ['saving', 'uploading', 'committed', 'deploying'].forEach(step => setPublishStep(step, 'pending')); };
const closePublishDialog = () => { if (!publishing) byId('publish-modal').hidden = true; };
const setPublishStep = (step, status) => { const item = document.querySelector(`[data-step="${step}"]`); if (!item) return; item.dataset.status = status; item.querySelector('span').textContent = status === 'complete' ? '✓' : status === 'active' ? '◌' : '○'; };
const publishRecord = result => { byId('publish-commit').textContent = result.commit.slice(0, 8); byId('publish-commit').href = result.commitUrl; byId('publish-live-url').href = result.liveSiteUrl || config.liveSiteUrl; };
const showDeploymentSuccess = result => { const elapsed = Date.now() - publishStartedAt; clearTimeout(publishTimer); publishing = false; setPublishButton(false); setPublishStep('deploying', 'complete'); byId('publish-modal-eyebrow').textContent = 'LIVE WEBSITE'; byId('publish-modal-title').textContent = '✓ Website Published Successfully'; byId('publish-dialog-message').textContent = `Deployment completed in ${durationLabel(elapsed)}.`; byId('publish-actions').hidden = false; byId('publish-close').hidden = false; byId('publish-close-action').hidden = false; updateStatusPanel({ sync: '✓ Synced', published: formatTime(new Date()), commit: result.commit.slice(0, 8), deployment: durationLabel(elapsed) }); state('Published successfully', `✓ Published to Live Website — commit ${result.commit.slice(0, 7)} verified. Live website: ${result.liveSiteUrl || config.liveSiteUrl}. ${result.localSync?.message || ''}`); };
const showDeploymentDelay = () => { publishing = false; setPublishButton(false); setPublishStep('deploying', 'active'); byId('publish-modal-eyebrow').textContent = 'GITHUB PAGES'; byId('publish-modal-title').textContent = 'GitHub Pages is taking longer than usual.'; byId('publish-dialog-message').textContent = 'Your content has been committed successfully. The live website should update shortly.'; byId('publish-actions').hidden = false; byId('continue-waiting').hidden = false; byId('publish-close').hidden = false; state('Published successfully', '✓ Published to Live Website. GitHub Pages is still deploying; you can continue waiting or open the live website.'); };
const pollLiveWebsite = (result, continueWaiting = false) => {
  const poll = async () => {
    const matched = await checkLive(activePublish.content);
    if (matched) return showDeploymentSuccess(result);
    if (!continueWaiting && Date.now() - publishStartedAt >= deploymentTimeout) return showDeploymentDelay();
    publishTimer = window.setTimeout(poll, deploymentInterval);
  };
  poll();
};
const beginPublishProgress = async content => {
  publishing = true; activePublish = { content, result: null }; publishStartedAt = Date.now(); setPublishButton(true); showPublishDialog(); setPublishStep('saving', 'active'); state('Publishing…', 'Saving your current website content…');
  try {
    setPublishStep('saving', 'complete'); setPublishStep('uploading', 'active'); byId('publish-dialog-message').textContent = 'Uploading your verified content to GitHub…';
    const result = await api('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
    console.info('[RMR Owner Portal] committed GitHub state', { commit: result.commit, content: result.committedContent });
    if (!result.verified || !sameContent(content, result.committedContent)) throw { error: 'GitHub committed content did not match the requested publish payload.' };
    activePublish.result = result; savedDraft = structuredClone(content); localStorage.setItem(draftKey, JSON.stringify(savedDraft)); latestVersionUrl = result.commitUrl || config.latestVersionUrl;
    setPublishStep('uploading', 'complete'); setPublishStep('committed', 'complete'); setPublishStep('deploying', 'active'); publishRecord(result); byId('publish-dialog-message').textContent = 'Commit created. Waiting for GitHub Pages deployment…';
    pollLiveWebsite(result);
  } catch (result) {
    publishing = false; setPublishButton(false); byId('publish-modal-eyebrow').textContent = 'PUBLISHING'; byId('publish-modal-title').textContent = 'Publish could not be completed'; byId('publish-dialog-message').textContent = result.error || 'Publish failed.'; byId('publish-actions').hidden = false; byId('publish-close').hidden = false; byId('publish-close-action').hidden = false; state('Publish failed', result.error || 'Publish failed.'); console.error('[RMR Owner Portal] publish failed', result);
  }
};

fetch('website-content.json', { cache: 'no-store' }).then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(content => { const stored = JSON.parse(localStorage.getItem(draftKey) || 'null'); savedDraft = stored || structuredClone(content); populate(savedDraft); console.info('[RMR Owner Portal] editor state loaded', { published: content, draft: savedDraft }); state(stored ? 'Saved draft' : 'Published successfully'); }).catch(() => state('Publish failed', 'Unable to load the current website content. Start the local Owner Portal launcher and try again.'));
refreshPublishingStatus();
api('/api/live-content').then(result => updateStatusPanel({ live: result.ok, sync: result.ok ? '✓ Synced' : 'Live site is updating' })).catch(() => updateStatusPanel({ live: false, sync: 'Unable to verify' }));
byId('content-form').addEventListener('input', () => { counts(); render(); console.debug('[RMR Owner Portal] editor state', values()); state('Unsaved draft'); });
byId('reset-button').addEventListener('click', () => { populate(savedDraft); console.info('[RMR Owner Portal] draft reset', savedDraft); state('Saved draft'); });
byId('save-draft-button').addEventListener('click', () => { savedDraft = values(); localStorage.setItem(draftKey, JSON.stringify(savedDraft)); console.info('[RMR Owner Portal] draft state saved', savedDraft); state('Saved draft', 'Draft saved on this Mac. Publish when you are ready to update the live website.'); });
byId('open-live').addEventListener('click', () => window.open(config.liveSiteUrl, '_blank', 'noopener'));
byId('view-published').addEventListener('click', () => window.open(latestVersionUrl, '_blank', 'noopener'));
byId('open-token-page').addEventListener('click', () => window.open('https://github.com/settings/personal-access-tokens/new', '_blank', 'noopener'));
byId('publish-open-live').addEventListener('click', () => window.open(config.liveSiteUrl, '_blank', 'noopener'));
byId('publish-close').addEventListener('click', closePublishDialog);
byId('publish-close-action').addEventListener('click', closePublishDialog);
byId('continue-waiting').addEventListener('click', () => { if (!activePublish?.result) return; publishing = true; setPublishButton(true); byId('continue-waiting').hidden = true; byId('publish-close').hidden = true; byId('publish-dialog-message').textContent = 'Still checking the live website every five seconds…'; pollLiveWebsite(activePublish.result, true); });
byId('configure-github').addEventListener('click', async () => { const button = byId('configure-github'); button.disabled = true; byId('setup-message').textContent = 'A secure macOS dialog is opening…'; try { await api('/api/configure-github', { method: 'POST' }); await refreshPublishingStatus(); state('Saved draft', 'GitHub publishing is configured and the repository connection is verified.'); } catch (result) { byId('setup-message').textContent = result.message || 'GitHub publishing setup failed.'; } finally { button.disabled = false; } });
byId('publish-button').addEventListener('click', async () => { if (publishing) return; if (!publishingReady) { const setup = await refreshPublishingStatus(); state('Publish failed', setup.message || 'Configure GitHub Publishing before publishing.'); return; } const content = values(); console.info('[RMR Owner Portal] publish payload', content); beginPublishProgress(content); });
