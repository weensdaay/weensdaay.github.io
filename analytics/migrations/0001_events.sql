CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  first_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL,
  source TEXT NOT NULL,
  account TEXT,
  device TEXT NOT NULL,
  country TEXT NOT NULL,
  landing_page TEXT NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS sessions_first_at ON sessions(first_at);
CREATE INDEX IF NOT EXISTS sessions_last_at ON sessions(last_at);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  received_at INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('pageview', 'click', 'action')),
  page TEXT NOT NULL CHECK(page IN ('/', '/en/')),
  target TEXT
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS events_received_at ON events(received_at);
CREATE INDEX IF NOT EXISTS events_session_id ON events(session_id);
