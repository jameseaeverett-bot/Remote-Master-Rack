PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS dd_daws (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO dd_daws (id, name) VALUES
  ('cubase', 'Cubase'), ('logic-pro', 'Logic Pro'), ('ableton-live', 'Ableton Live'),
  ('studio-one', 'Studio One'), ('reaper', 'REAPER'), ('pro-tools', 'Pro Tools');

CREATE TABLE IF NOT EXISTS dd_sources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  organisation TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('primary-official', 'vendor-support', 'verified-technical', 'community-evidence', 'internal-dd-research')),
  platforms_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  last_checked_at TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS dd_source_daws (
  source_id TEXT NOT NULL REFERENCES dd_sources(id) ON DELETE CASCADE,
  daw_id TEXT NOT NULL REFERENCES dd_daws(id),
  PRIMARY KEY (source_id, daw_id)
);

CREATE TABLE IF NOT EXISTS dd_knowledge_records (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  platforms_json TEXT NOT NULL,
  os_version_min TEXT NOT NULL DEFAULT '',
  os_version_max TEXT NOT NULL DEFAULT '',
  exception_code TEXT NOT NULL DEFAULT '',
  canonical_name TEXT NOT NULL DEFAULT '',
  plain_english_meaning TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL DEFAULT '',
  fault_modules_json TEXT NOT NULL DEFAULT '[]',
  plugin_vendor_evidence_json TEXT NOT NULL DEFAULT '[]',
  cause_categories_json TEXT NOT NULL DEFAULT '[]',
  safe_guidance TEXT NOT NULL DEFAULT '',
  daw_specific_notes TEXT NOT NULL DEFAULT '',
  limitations TEXT NOT NULL DEFAULT '',
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  evidence_status TEXT NOT NULL CHECK (evidence_status IN ('verified', 'supported', 'provisional', 'research', 'retired')),
  publication_state TEXT NOT NULL CHECK (publication_state IN ('draft', 'approved', 'retired')) DEFAULT 'draft',
  internal_research_notes TEXT NOT NULL DEFAULT '',
  future_rule_json TEXT NOT NULL DEFAULT '{}',
  retired INTEGER NOT NULL DEFAULT 0 CHECK (retired IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_reviewed_at TEXT,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS dd_knowledge_daws (
  knowledge_id TEXT NOT NULL REFERENCES dd_knowledge_records(id) ON DELETE CASCADE,
  daw_id TEXT NOT NULL REFERENCES dd_daws(id),
  daw_version_min TEXT NOT NULL DEFAULT '',
  daw_version_max TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (knowledge_id, daw_id)
);

CREATE TABLE IF NOT EXISTS dd_knowledge_sources (
  knowledge_id TEXT NOT NULL REFERENCES dd_knowledge_records(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES dd_sources(id),
  PRIMARY KEY (knowledge_id, source_id)
);

CREATE TABLE IF NOT EXISTS dd_research_records (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  candidate_findings TEXT NOT NULL DEFAULT '',
  links_json TEXT NOT NULL DEFAULT '[]',
  internal_notes TEXT NOT NULL DEFAULT '',
  ai_suggestions TEXT NOT NULL DEFAULT '',
  review_status TEXT NOT NULL CHECK (review_status IN ('new', 'in-review', 'accepted', 'rejected')) DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS dd_database_versions (
  version INTEGER PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  dataset_json TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  content_size_bytes INTEGER NOT NULL,
  published_at_utc TEXT NOT NULL,
  published_by TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  source_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dd_current_manifest (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  current_version INTEGER NOT NULL REFERENCES dd_database_versions(version),
  updated_at_utc TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dd_knowledge_publish ON dd_knowledge_records (publication_state, retired, evidence_status, updated_at);
CREATE INDEX IF NOT EXISTS idx_dd_knowledge_exception ON dd_knowledge_records (exception_code, canonical_name);
CREATE INDEX IF NOT EXISTS idx_dd_knowledge_daws_daw ON dd_knowledge_daws (daw_id, knowledge_id);
CREATE INDEX IF NOT EXISTS idx_dd_source_daws_daw ON dd_source_daws (daw_id, source_id);
CREATE INDEX IF NOT EXISTS idx_dd_sources_active ON dd_sources (active, updated_at);
CREATE INDEX IF NOT EXISTS idx_dd_research_review ON dd_research_records (review_status, updated_at);
