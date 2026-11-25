CREATE TABLE IF NOT EXISTS command_inbox (
  event_id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  thread_ts TEXT NOT NULL,
  command TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  receipt_state TEXT NOT NULL CHECK(receipt_state IN ('pending','sending','sent','uncertain')),
  reply_ts TEXT,
  UNIQUE(channel, thread_ts)
);
CREATE INDEX IF NOT EXISTS inbox_received ON command_inbox(received_at);
CREATE INDEX IF NOT EXISTS inbox_receipt ON command_inbox(receipt_state, received_at);
