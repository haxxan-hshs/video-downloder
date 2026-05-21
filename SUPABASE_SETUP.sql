-- ============================================================
-- Run this SQL in Supabase Dashboard > SQL Editor
-- URL: https://supabase.com/dashboard/project/yrwfdnpwwefdyujkccyn/sql
-- ============================================================

-- 1. Create admins table
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Disable RLS on admins (so anon key can read it)
ALTER TABLE admins DISABLE ROW LEVEL SECURITY;

-- 3. Insert admin credentials
-- Username: usermissing | Password: whyfail
INSERT INTO admins (username, password)
VALUES ('usermissing', 'whyfail')
ON CONFLICT (username) DO UPDATE SET password = 'whyfail';

-- 4. Make sure downloads table exists
CREATE TABLE IF NOT EXISTS downloads (
  id SERIAL PRIMARY KEY,
  username TEXT,
  url TEXT,
  title TEXT,
  status TEXT DEFAULT 'completed',
  quality TEXT,
  format TEXT,
  size TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Disable RLS on downloads (so all users can insert/read their own)
ALTER TABLE downloads DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- DONE! Admin login: usermissing / whyfail
-- ============================================================
