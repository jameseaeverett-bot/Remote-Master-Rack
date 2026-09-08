CREATE TABLE IF NOT EXISTS customer_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  auth_provider TEXT NOT NULL CHECK (auth_provider = 'auth0'),
  auth_subject TEXT NOT NULL CHECK (length(auth_subject) BETWEEN 1 AND 255),
  email TEXT CHECK (email IS NULL OR length(email) <= 254),
  display_name TEXT CHECK (display_name IS NULL OR length(display_name) <= 120),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'closed')),
  UNIQUE (auth_provider, auth_subject)
);

CREATE INDEX IF NOT EXISTS customer_accounts_email_index ON customer_accounts (email);
