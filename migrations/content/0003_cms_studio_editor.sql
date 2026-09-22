-- CMS V2 Stage 4A: owner-editable RMR Studio presentation data.
-- This remains separate from Studio Manager's local operational catalogue.

ALTER TABLE cms_studio_pages ADD COLUMN hero_media_id TEXT REFERENCES cms_media_assets(id) ON DELETE RESTRICT;
ALTER TABLE cms_studio_pages ADD COLUMN hero_alt_text TEXT NOT NULL DEFAULT '' CHECK (length(hero_alt_text) <= 500);

ALTER TABLE cms_studio_hardware_items ADD COLUMN manufacturer TEXT NOT NULL DEFAULT '' CHECK (length(manufacturer) <= 160);
ALTER TABLE cms_studio_hardware_items ADD COLUMN catalogue_hardware_id TEXT CHECK (length(catalogue_hardware_id) <= 160);

CREATE INDEX IF NOT EXISTS idx_cms_studio_hardware_catalogue
ON cms_studio_hardware_items (catalogue_hardware_id);

CREATE TABLE IF NOT EXISTS cms_studio_software_groups (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
  page_id TEXT NOT NULL DEFAULT 'the-rmr-studio' REFERENCES cms_studio_pages(page_id) ON DELETE RESTRICT,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 160),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 1600),
  media_id TEXT REFERENCES cms_media_assets(id) ON DELETE RESTRICT,
  image_alt_text TEXT NOT NULL DEFAULT '' CHECK (length(image_alt_text) <= 500),
  display_order INTEGER NOT NULL CHECK (display_order >= 0),
  visibility TEXT NOT NULL DEFAULT 'visible' CHECK (visibility IN ('visible', 'hidden')),
  publication_state TEXT NOT NULL DEFAULT 'published' CHECK (publication_state IN ('published')),
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_by TEXT NOT NULL CHECK (length(published_by) BETWEEN 1 AND 255),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL CHECK (length(updated_by) BETWEEN 1 AND 255),
  UNIQUE (page_id, display_order, publication_state),
  CHECK (media_id IS NULL OR length(image_alt_text) BETWEEN 1 AND 500)
);

CREATE INDEX IF NOT EXISTS idx_cms_studio_software_groups_public
ON cms_studio_software_groups (page_id, publication_state, visibility, display_order);
