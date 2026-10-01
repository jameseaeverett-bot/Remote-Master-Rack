-- Additive replacement for the original fixed About document. The legacy
-- cms_about_pages row remains untouched as a public fallback until an owner
-- publishes an article below.
CREATE TABLE IF NOT EXISTS cms_about_articles (
  page_id TEXT PRIMARY KEY CHECK (page_id = 'about'),
  media_id TEXT REFERENCES cms_media_assets(id) ON DELETE RESTRICT,
  image_alt_text TEXT NOT NULL DEFAULT '' CHECK (length(image_alt_text) <= 500),
  heading TEXT NOT NULL CHECK (length(heading) BETWEEN 1 AND 240),
  intro TEXT NOT NULL DEFAULT '' CHECK (length(intro) <= 20000),
  profile_label TEXT NOT NULL DEFAULT '' CHECK (length(profile_label) <= 120),
  profile_url TEXT NOT NULL DEFAULT '' CHECK (length(profile_url) <= 2048),
  visibility TEXT NOT NULL DEFAULT 'visible' CHECK (visibility IN ('visible', 'hidden')),
  publication_state TEXT NOT NULL DEFAULT 'published' CHECK (publication_state IN ('published')),
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_by TEXT NOT NULL CHECK (length(published_by) BETWEEN 1 AND 255),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL CHECK (length(updated_by) BETWEEN 1 AND 255),
  CHECK (media_id IS NULL OR length(image_alt_text) BETWEEN 1 AND 500),
  CHECK ((profile_label = '' AND profile_url = '') OR (length(profile_label) >= 1 AND profile_url GLOB 'https://*'))
);

CREATE TABLE IF NOT EXISTS cms_about_article_paragraphs (
  page_id TEXT NOT NULL REFERENCES cms_about_articles(page_id) ON DELETE CASCADE,
  paragraph_id TEXT NOT NULL CHECK (length(paragraph_id) BETWEEN 1 AND 96),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
  PRIMARY KEY (page_id, paragraph_id),
  UNIQUE (page_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_cms_about_articles_public
ON cms_about_articles (page_id, publication_state, visibility);
CREATE INDEX IF NOT EXISTS idx_cms_about_article_paragraphs_order
ON cms_about_article_paragraphs (page_id, sort_order, paragraph_id);
