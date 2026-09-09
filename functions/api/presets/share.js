import { readSession } from '../../_lib/auth.js';
import {
  MAX_PRESET_FILE_BYTES,
  allowedPresetExtensions,
  safeDownloadFilename,
  validatePresetDocument,
  validEditor,
} from '../../_lib/presets.js';

const MAX_REQUEST_BYTES = MAX_PRESET_FILE_BYTES + 32 * 1024;
const MAX_SUBMISSIONS_PER_HOUR = 10;
const GENRES = new Set(['Acoustic', 'Classical', 'Electronic', 'Hip-Hop', 'Jazz', 'Pop', 'Rock', 'Other']);
const SOURCES = new Set(['Bass', 'Drums', 'Guitar', 'Keys', 'Master Bus', 'Mix Bus', 'Vocals', 'Other']);
const respond = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

const clean = (value, maximum, required = false) => {
  const result = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if ((required && !result) || result.length > maximum) return null;
  return result;
};

const authenticatedAccount = async (request, env) => {
  if (!env.ACCOUNTS_DB) return null;
  const session = await readSession(request, env);
  if (!session || session.provider !== 'auth0' || !session.accountId || !session.subject) return null;
  return env.ACCOUNTS_DB.prepare(`
    SELECT id, email, display_name, account_status FROM customer_accounts
    WHERE id = ? AND auth_provider = 'auth0' AND auth_subject = ? LIMIT 1
  `).bind(session.accountId, session.subject).first();
};

export async function onRequestGet({ request, env }) {
  try {
    if (!env.PRESETS_DB) return respond({ error: 'Preset submissions are unavailable.' }, 503);
    const account = await authenticatedAccount(request, env);
    if (!account || account.account_status !== 'active') return respond({ authenticated: false }, 401);
    const result = await env.PRESETS_DB.prepare(`
      SELECT id, editor_slug, title, status, created_at, updated_at
      FROM preset_entries WHERE creator_account_id = ? ORDER BY created_at DESC LIMIT 50
    `).bind(account.id).all();
    return respond({ authenticated: true, account: { displayName: account.display_name || 'RMR Customer' }, submissions: result.results || [] });
  } catch (error) {
    console.error('RMR preset submissions lookup failed.', { type: error?.name || 'Error' });
    return respond({ error: 'Preset submissions are temporarily unavailable.' }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.PRESETS_DB || !env.PRESET_FILES || !env.ACCOUNTS_DB) return respond({ error: 'Preset submission is unavailable.' }, 503);
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_REQUEST_BYTES) return respond({ error: 'The preset submission is too large.' }, 413);
  if (!/^multipart\/form-data\s*;/i.test(request.headers.get('Content-Type') || '')) {
    return respond({ error: 'A multipart preset submission is required.' }, 400);
  }

  try {
    const account = await authenticatedAccount(request, env);
    if (!account || account.account_status !== 'active') return respond({ authenticated: false, error: 'Sign in is required.' }, 401);
    const form = await request.formData();
    const editorSlug = clean(form.get('editor'), 80, true);
    const title = clean(form.get('title'), 160, true);
    const genre = clean(form.get('genre'), 80, true);
    const sourceBus = clean(form.get('sourceBus'), 80, true);
    const description = clean(form.get('description'), 4000) ?? null;
    const rightsConfirmed = form.get('rightsConfirmed') === 'true';
    const file = form.get('file');

    if (!editorSlug || !validEditor(editorSlug)) return respond({ error: 'Unknown editor.' }, 400);
    if (!allowedPresetExtensions[editorSlug].length) return respond({ error: 'Preset sharing is not enabled for this editor yet.' }, 400);
    if (!title || !GENRES.has(genre) || !SOURCES.has(sourceBus) || description === null || !rightsConfirmed || !(file instanceof File)) {
      return respond({ error: 'Please complete every required field and confirm you may share the preset.' }, 400);
    }
    if (!file.size) return respond({ error: 'The preset file is empty.' }, 400);
    if (file.size > MAX_PRESET_FILE_BYTES) return respond({ error: 'The preset file is too large.' }, 413);

    const bytes = await file.arrayBuffer();
    const validationError = await validatePresetDocument(editorSlug, file.name, bytes);
    if (validationError) return respond({ error: validationError }, 400);
    const checksum = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((byte) => byte.toString(16).padStart(2, '0')).join('');

    const recent = await env.PRESETS_DB.prepare(`
      SELECT COUNT(*) AS count FROM preset_entries WHERE creator_account_id = ? AND created_at >= datetime('now', '-1 hour')
    `).bind(account.id).first();
    if (Number(recent?.count || 0) >= MAX_SUBMISSIONS_PER_HOUR) return respond({ error: 'Submission limit reached. Please try again later.' }, 429);

    const duplicate = await env.PRESETS_DB.prepare(`
      SELECT id FROM preset_entries WHERE creator_account_id = ? AND checksum_sha256 = ? AND status != 'archived' LIMIT 1
    `).bind(account.id, checksum).first();
    if (duplicate) return respond({ error: 'You have already submitted this exact preset file.', duplicatePresetId: duplicate.id }, 409);

    const id = crypto.randomUUID();
    const originalFilename = safeDownloadFilename(file.name);
    const extension = originalFilename.slice(originalFilename.lastIndexOf('.')).toLowerCase();
    const fileKey = `presets/${editorSlug}/${id}/${originalFilename}`;
    await env.PRESET_FILES.put(fileKey, bytes, { httpMetadata: { contentType: 'application/json' }, customMetadata: { sha256: checksum } });
    try {
      const creatorName = clean(account.display_name, 120) || 'RMR Customer';
      await env.PRESETS_DB.prepare(`
        INSERT INTO preset_entries (
          id, editor_slug, title, creator_account_id, creator_display_name, genre, source_bus, description,
          file_key, original_filename, file_extension, file_size_bytes, checksum_sha256, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review')
      `).bind(id, editorSlug, title, account.id, creatorName, genre, sourceBus, description || '', fileKey, originalFilename, extension, bytes.byteLength, checksum).run();
    } catch (error) {
      await env.PRESET_FILES.delete(fileKey);
      throw error;
    }
    return respond({ status: 'pending_review', submission: { id, editorSlug, title, submittedAt: new Date().toISOString() } }, 201);
  } catch (error) {
    console.error('RMR preset submission failed.', { type: error?.name || 'Error' });
    return respond({ error: 'Preset submission is temporarily unavailable.' }, 503);
  }
}
