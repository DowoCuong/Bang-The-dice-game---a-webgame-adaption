CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('waiting', 'playing')),
  host_player_id TEXT NOT NULL,
  players_json TEXT NOT NULL,
  game_json TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON rooms(updated_at);
--> statement-breakpoint
PRAGMA optimize;
