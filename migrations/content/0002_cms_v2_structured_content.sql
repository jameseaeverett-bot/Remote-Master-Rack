-- CMS V2 is deliberately separate from CMS V1 customer_content.
-- It introduces only typed, customer-facing structured content; it is not a page builder.

CREATE TABLE IF NOT EXISTS cms_media_assets (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 96),
  object_key TEXT NOT NULL UNIQUE CHECK (length(object_key) BETWEEN 1 AND 512),
  original_filename TEXT NOT NULL CHECK (length(original_filename) BETWEEN 1 AND 255),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760),
  width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 6000),
  height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 6000),
  pixel_count INTEGER NOT NULL CHECK (pixel_count BETWEEN 1 AND 20000000),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  default_alt_text TEXT NOT NULL DEFAULT '' CHECK (length(default_alt_text) <= 500),
  default_caption TEXT NOT NULL DEFAULT '' CHECK (length(default_caption) <= 1000),
  lifecycle_state TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle_state IN ('active', 'orphaned', 'deleted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL CHECK (length(created_by) BETWEEN 1 AND 255),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL CHECK (length(updated_by) BETWEEN 1 AND 255),
  orphaned_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_cms_media_assets_lifecycle
ON cms_media_assets (lifecycle_state, orphaned_at);

CREATE TABLE IF NOT EXISTS cms_product_media_slots (
  content_id TEXT NOT NULL CHECK (length(content_id) BETWEEN 1 AND 160),
  slot_key TEXT NOT NULL CHECK (slot_key IN ('card-artwork', 'detail-hero', 'studio-hardware')),
  media_id TEXT NOT NULL REFERENCES cms_media_assets(id) ON DELETE RESTRICT,
  alt_text TEXT NOT NULL CHECK (length(alt_text) BETWEEN 1 AND 500),
  caption TEXT NOT NULL DEFAULT '' CHECK (length(caption) <= 1000),
  publication_state TEXT NOT NULL DEFAULT 'published' CHECK (publication_state IN ('published')),
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_by TEXT NOT NULL CHECK (length(published_by) BETWEEN 1 AND 255),
  PRIMARY KEY (content_id, slot_key, publication_state)
);

CREATE INDEX IF NOT EXISTS idx_cms_product_media_slots_public
ON cms_product_media_slots (publication_state, content_id, slot_key);

CREATE TABLE IF NOT EXISTS cms_studio_pages (
  page_id TEXT PRIMARY KEY CHECK (page_id = 'the-rmr-studio'),
  title TEXT NOT NULL DEFAULT '' CHECK (length(title) <= 160),
  intro TEXT NOT NULL DEFAULT '' CHECK (length(intro) <= 1600),
  hardware_heading TEXT NOT NULL DEFAULT '' CHECK (length(hardware_heading) <= 160),
  hardware_intro TEXT NOT NULL DEFAULT '' CHECK (length(hardware_intro) <= 1600),
  software_heading TEXT NOT NULL DEFAULT '' CHECK (length(software_heading) <= 160),
  software_summary TEXT NOT NULL DEFAULT '' CHECK (length(software_summary) <= 1600),
  visibility TEXT NOT NULL DEFAULT 'visible' CHECK (visibility IN ('visible', 'hidden')),
  publication_state TEXT NOT NULL DEFAULT 'published' CHECK (publication_state IN ('published')),
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_by TEXT NOT NULL CHECK (length(published_by) BETWEEN 1 AND 255),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL CHECK (length(updated_by) BETWEEN 1 AND 255)
);

CREATE TABLE IF NOT EXISTS cms_studio_hardware_items (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
  page_id TEXT NOT NULL DEFAULT 'the-rmr-studio' REFERENCES cms_studio_pages(page_id) ON DELETE RESTRICT,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 160),
  display_order INTEGER NOT NULL CHECK (display_order >= 0),
  session_type TEXT NOT NULL CHECK (session_type IN ('remote', 'assisted')),
  media_id TEXT REFERENCES cms_media_assets(id) ON DELETE RESTRICT,
  image_alt_text TEXT NOT NULL DEFAULT '' CHECK (length(image_alt_text) <= 500),
  image_caption TEXT NOT NULL DEFAULT '' CHECK (length(image_caption) <= 1000),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  chain_rationale TEXT NOT NULL DEFAULT '' CHECK (length(chain_rationale) <= 4000),
  visibility TEXT NOT NULL DEFAULT 'visible' CHECK (visibility IN ('visible', 'hidden')),
  publication_state TEXT NOT NULL DEFAULT 'published' CHECK (publication_state IN ('published')),
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_by TEXT NOT NULL CHECK (length(published_by) BETWEEN 1 AND 255),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL CHECK (length(updated_by) BETWEEN 1 AND 255),
  UNIQUE (page_id, display_order, publication_state),
  CHECK (media_id IS NULL OR length(image_alt_text) BETWEEN 1 AND 500)
);

CREATE INDEX IF NOT EXISTS idx_cms_studio_hardware_public
ON cms_studio_hardware_items (page_id, publication_state, visibility, session_type, display_order);

CREATE TABLE IF NOT EXISTS cms_studio_hardware_videos (
  hardware_item_id TEXT NOT NULL REFERENCES cms_studio_hardware_items(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL CHECK (display_order BETWEEN 0 AND 2),
  youtube_video_id TEXT NOT NULL CHECK (length(youtube_video_id) = 11),
  title TEXT NOT NULL DEFAULT '' CHECK (length(title) <= 160),
  caption TEXT NOT NULL DEFAULT '' CHECK (length(caption) <= 1000),
  PRIMARY KEY (hardware_item_id, display_order),
  UNIQUE (hardware_item_id, youtube_video_id)
);

CREATE INDEX IF NOT EXISTS idx_cms_studio_hardware_videos_order
ON cms_studio_hardware_videos (hardware_item_id, display_order);

CREATE TRIGGER IF NOT EXISTS cms_studio_hardware_videos_limit_insert
BEFORE INSERT ON cms_studio_hardware_videos
WHEN (SELECT COUNT(*) FROM cms_studio_hardware_videos WHERE hardware_item_id = NEW.hardware_item_id) >= 3
BEGIN
  SELECT RAISE(ABORT, 'A studio hardware item may have no more than three YouTube videos.');
END;

CREATE TRIGGER IF NOT EXISTS cms_studio_hardware_videos_limit_move
BEFORE UPDATE OF hardware_item_id ON cms_studio_hardware_videos
WHEN NEW.hardware_item_id <> OLD.hardware_item_id
  AND (SELECT COUNT(*) FROM cms_studio_hardware_videos WHERE hardware_item_id = NEW.hardware_item_id) >= 3
BEGIN
  SELECT RAISE(ABORT, 'A studio hardware item may have no more than three YouTube videos.');
END;
