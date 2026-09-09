export const EDITOR_CATALOGUE = Object.freeze([
  'folktek-resonant-garden',
  'pultec-eqp-1a',
  'ssl-fusion',
]);

const SORTS = new Set(['popular', 'highest-rated', 'most-downloaded', 'newest']);
const MAX_LIMIT = 50;

export const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=UTF-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*',
  },
});

export const validEditor = (value) => EDITOR_CATALOGUE.includes(value);

const textFilter = (value, maximum = 80) => {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const result = value.trim().replace(/\s+/g, ' ');
  return result && result.length <= maximum ? result : undefined;
};

const numberFilter = (value, fallback, maximum) => {
  if (value === null || value === '') return fallback;
  if (!/^\d+$/.test(value)) return undefined;
  return Math.min(Number(value), maximum);
};

export const parseListQuery = (url) => {
  const editor = url.searchParams.get('editor');
  if (editor && !validEditor(editor)) return { error: 'Unknown editor.' };
  const creator = textFilter(url.searchParams.get('creator'));
  const genre = textFilter(url.searchParams.get('genre'));
  const sourceBus = textFilter(url.searchParams.get('sourceBus'));
  const sort = url.searchParams.get('sort') || 'popular';
  const limit = numberFilter(url.searchParams.get('limit'), 24, MAX_LIMIT);
  const offset = numberFilter(url.searchParams.get('offset'), 0, 10_000);
  if ([creator, genre, sourceBus, limit, offset].includes(undefined) || !SORTS.has(sort)) {
    return { error: 'Invalid preset query.' };
  }
  return { editor: editor || null, creator, genre, sourceBus, sort, limit, offset };
};

export const popularityScore = (averageRating, ratingCount, downloadCount) => {
  const average = Number(averageRating) || 0;
  const ratings = Math.max(0, Number(ratingCount) || 0);
  const downloads = Math.max(0, Number(downloadCount) || 0);
  const priorMean = 3.5;
  const priorWeight = 5;
  const bayesianRating = ((ratings * average) + (priorWeight * priorMean)) / (ratings + priorWeight);
  return Number((bayesianRating + Math.min(downloads, 1_000) / 100).toFixed(4));
};

export const presetProjection = (row) => ({
  id: row.id,
  editorSlug: row.editor_slug,
  title: row.title,
  creator: row.creator_display_name,
  genre: row.genre,
  sourceBus: row.source_bus,
  description: row.description,
  file: {
    originalFilename: row.original_filename,
    extension: row.file_extension,
    sizeBytes: row.file_size_bytes,
  },
  rating: {
    average: Number(row.rating_average || 0),
    count: Number(row.rating_count || 0),
  },
  downloadCount: Number(row.download_count || 0),
  publishedAt: row.published_at,
  updatedAt: row.updated_at,
});

export const safeDownloadFilename = (value) => String(value || 'preset').replace(/[\\/:*?"<>|\r\n]+/g, '_').slice(0, 180) || 'preset';

export const allowedPresetExtensions = Object.freeze({
  'folktek-resonant-garden': [],
  'pultec-eqp-1a': [],
  'ssl-fusion': ['.rmrpreset'],
});

export const MAX_PRESET_FILE_BYTES = 256 * 1024;

const sha256Hex = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
  .map((byte) => byte.toString(16).padStart(2, '0')).join('');

export const validatePresetDocument = async (editorSlug, filename, bytes) => {
  if (!validEditor(editorSlug)) return 'Unknown editor.';
  const name = String(filename || '');
  const separator = name.lastIndexOf('.');
  const extension = separator >= 0 ? name.slice(separator).toLowerCase() : '';
  if (!allowedPresetExtensions[editorSlug].includes(extension)) return 'This preset file format is not approved for the selected editor.';
  if (!bytes || bytes.byteLength === 0) return 'The preset file is empty.';
  if (bytes.byteLength > MAX_PRESET_FILE_BYTES) return 'The preset file is too large.';
  if (['.exe', '.dll', '.bat', '.cmd', '.ps1', '.msi', '.js', '.zip'].includes(extension)) return 'This file type is not permitted.';
  try {
    const document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (editorSlug === 'ssl-fusion' && (
      document?.editorId !== 'ssl-fusion' || document?.format !== 'rmr-vst-editor-preset' || document?.formatVersion !== 1 ||
      document?.productStateVersion !== 1 || !document?.payload?.parameters || Array.isArray(document.payload.parameters) ||
      document?.integrity?.algorithm !== 'sha-256' || document?.integrity?.scope !== 'canonical-envelope-without-integrity' ||
      !/^[a-f0-9]{64}$/i.test(document?.integrity?.value || '')
    )) return 'The SSL Fusion preset structure is invalid.';
    if (editorSlug === 'ssl-fusion') {
      const { integrity, ...unsignedEnvelope } = document;
      const calculated = await sha256Hex(new TextEncoder().encode(JSON.stringify(unsignedEnvelope)));
      if (calculated !== integrity.value.toLowerCase()) return 'The SSL Fusion preset integrity check failed.';
    }
  } catch {
    return 'The preset file is not valid UTF-8 JSON.';
  }
  return null;
};
