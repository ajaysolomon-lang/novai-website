-- Workbench V6.3 Schema

DROP TABLE IF EXISTS v6_users;
CREATE TABLE v6_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'pending',
  email_verified INTEGER DEFAULT 0,
  phone TEXT,
  phone_verified INTEGER DEFAULT 0,
  verification_tier INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

DROP TABLE IF EXISTS v6_verification_codes;
CREATE TABLE v6_verification_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES v6_users(id)
);

DROP TABLE IF EXISTS v6_providers;
CREATE TABLE v6_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  business_name TEXT NOT NULL,
  category TEXT NOT NULL,
  services TEXT NOT NULL,
  zip_codes TEXT NOT NULL,
  rating REAL DEFAULT 0,
  jobs_completed INTEGER DEFAULT 0,
  verification_tier INTEGER DEFAULT 0,
  available INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES v6_users(id)
);

DROP TABLE IF EXISTS v6_jobs;
CREATE TABLE v6_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  budget_min REAL,
  budget_max REAL,
  urgency TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'open',
  matched_provider_id INTEGER,
  scheduled_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES v6_users(id),
  FOREIGN KEY (matched_provider_id) REFERENCES v6_providers(id)
);

DROP TABLE IF EXISTS v6_matches;
CREATE TABLE v6_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  provider_id INTEGER NOT NULL,
  score REAL NOT NULL,
  breakdown TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (job_id) REFERENCES v6_jobs(id),
  FOREIGN KEY (provider_id) REFERENCES v6_providers(id)
);

DROP TABLE IF EXISTS v6_schedules;
CREATE TABLE v6_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  provider_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  scheduled_date TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  status TEXT DEFAULT 'confirmed',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (job_id) REFERENCES v6_jobs(id),
  FOREIGN KEY (provider_id) REFERENCES v6_providers(id),
  FOREIGN KEY (user_id) REFERENCES v6_users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON v6_users(email);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON v6_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON v6_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_zip ON v6_jobs(zip_code);
CREATE INDEX IF NOT EXISTS idx_providers_category ON v6_providers(category);
CREATE INDEX IF NOT EXISTS idx_providers_zip ON v6_providers(zip_codes);
CREATE INDEX IF NOT EXISTS idx_matches_job ON v6_matches(job_id);
CREATE INDEX IF NOT EXISTS idx_schedules_job ON v6_schedules(job_id);
