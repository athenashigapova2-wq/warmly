CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  last_sent INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX chat_sessions_presence ON chat_sessions(last_seen);
--> statement-breakpoint
CREATE INDEX chat_sessions_joins ON chat_sessions(ip_hash, created_at);
--> statement-breakpoint
CREATE TABLE chat_messages (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  client_message_id TEXT NOT NULL,
  UNIQUE(sender_id, client_message_id)
);
