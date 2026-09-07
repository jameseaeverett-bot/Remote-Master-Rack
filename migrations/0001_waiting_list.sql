-- Remote Master Rack public waiting list. Do not store email-delivery or authentication credentials here.
CREATE TABLE IF NOT EXISTS waiting_list_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  first_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consent_marketing INTEGER NOT NULL CHECK (consent_marketing IN (0, 1)),
  consent_version TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'suppressed'))
);

-- One active record per normalised email address. A future unsubscribe flow may change status,
-- preserving the consent/audit history while allowing a deliberate later re-subscription policy.
CREATE UNIQUE INDEX IF NOT EXISTS waiting_list_active_email_unique
  ON waiting_list_signups (email)
  WHERE status = 'active';
