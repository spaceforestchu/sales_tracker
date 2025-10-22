-- Migration: Create linkedin_sessions table for per-user LinkedIn authentication
-- This allows each admin to have their own LinkedIn session for scraping

CREATE TABLE IF NOT EXISTS linkedin_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cookies JSONB NOT NULL,
  user_agent TEXT,
  platform TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  UNIQUE(user_id)
);

-- Add comments for documentation
COMMENT ON TABLE linkedin_sessions IS 'Stores LinkedIn authentication sessions per user';
COMMENT ON COLUMN linkedin_sessions.user_id IS 'User who owns this LinkedIn session';
COMMENT ON COLUMN linkedin_sessions.cookies IS 'LinkedIn cookies as JSON array';
COMMENT ON COLUMN linkedin_sessions.user_agent IS 'Browser User-Agent used when cookies were created';
COMMENT ON COLUMN linkedin_sessions.platform IS 'Browser platform (e.g., MacIntel, Win32)';
COMMENT ON COLUMN linkedin_sessions.expires_at IS 'When the LinkedIn session expires (typically ~1 year)';

-- Create index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_linkedin_sessions_user ON linkedin_sessions(user_id);
