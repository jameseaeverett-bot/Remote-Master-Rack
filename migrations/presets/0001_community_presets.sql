CREATE TABLE IF NOT EXISTS preset_entries (
  id TEXT PRIMARY KEY,
  editor_slug TEXT NOT NULL CHECK (editor_slug IN ('folktek-resonant-garden', 'pultec-eqp-1a', 'ssl-fusion')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  creator_account_id TEXT,
  creator_display_name TEXT NOT NULL CHECK (length(creator_display_name) BETWEEN 1 AND 120),
  genre TEXT,
  source_bus TEXT,
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  file_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL CHECK (length(original_filename) BETWEEN 1 AND 255),
  file_extension TEXT NOT NULL CHECK (length(file_extension) BETWEEN 1 AND 24),
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0),
  checksum_sha256 TEXT NOT NULL CHECK (length(checksum_sha256) = 64),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  download_count INTEGER NOT NULL DEFAULT 0 CHECK (download_count >= 0)
);

CREATE TABLE IF NOT EXISTS preset_ratings (
  preset_id TEXT NOT NULL REFERENCES preset_entries(id) ON DELETE CASCADE,
  customer_account_id TEXT NOT NULL,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (preset_id, customer_account_id)
);

CREATE INDEX IF NOT EXISTS preset_entries_published_editor_index ON preset_entries(status, editor_slug, published_at DESC);
CREATE INDEX IF NOT EXISTS preset_entries_published_newest_index ON preset_entries(status, published_at DESC);
CREATE INDEX IF NOT EXISTS preset_entries_published_downloads_index ON preset_entries(status, download_count DESC, published_at DESC);
CREATE INDEX IF NOT EXISTS preset_entries_creator_index ON preset_entries(creator_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS preset_ratings_preset_index ON preset_ratings(preset_id);
CREATE INDEX IF NOT EXISTS preset_ratings_customer_index ON preset_ratings(customer_account_id, updated_at DESC);
