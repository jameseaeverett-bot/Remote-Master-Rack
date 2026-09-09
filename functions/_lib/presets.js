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
  'ssl-fusion': [],
});
