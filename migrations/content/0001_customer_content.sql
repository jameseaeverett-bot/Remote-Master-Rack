CREATE TABLE IF NOT EXISTS customer_content (
  content_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  publication_state TEXT NOT NULL CHECK (publication_state IN ('published')),
  published_at TEXT NOT NULL,
  published_by TEXT NOT NULL,
  PRIMARY KEY (content_id, schema_version, publication_state)
);

CREATE INDEX IF NOT EXISTS idx_customer_content_public_projection
ON customer_content (schema_version, publication_state, content_id);
