-- ============================================================================
-- AetherFlow Marketplace — Supabase Database Migration
-- Run this ONCE in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- ── 1. User Profiles ────────────────────────────────────────────────────────
-- Stores display name, avatar, and stats for marketplace participants
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  wallpapers_submitted INT DEFAULT 0,
  total_downloads INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read profiles" ON public.user_profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'user_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. Wallpaper Submissions ────────────────────────────────────────────────
-- Community-submitted wallpapers awaiting review
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('youtube', 'stream', 'image')),
  source TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read approved" ON public.submissions FOR SELECT USING (status = 'approved' OR auth.uid() = author_id);
CREATE POLICY "Auth users insert" ON public.submissions FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors update own" ON public.submissions FOR UPDATE USING (auth.uid() = author_id AND status = 'pending');

-- ── 3. Install Tracking ────────────────────────────────────────────────────
-- Tracks which user installed which wallpaper (deduped by user)
CREATE TABLE IF NOT EXISTS public.installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  wallpaper_id TEXT NOT NULL,
  installed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, wallpaper_id)
);

ALTER TABLE public.installs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert installs" ON public.installs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read installs" ON public.installs FOR SELECT USING (true);

-- ── 4. Likes / Favorites ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  wallpaper_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, wallpaper_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read likes" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Auth users toggle likes" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Auth users remove likes" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- ── 5. RPC Functions ────────────────────────────────────────────────────────

-- Track an install (upsert, returns new total)
CREATE OR REPLACE FUNCTION public.track_install(p_wallpaper_id TEXT, p_user_id UUID DEFAULT NULL)
RETURNS INT AS $$
DECLARE
  total INT;
BEGIN
  INSERT INTO public.installs (user_id, wallpaper_id)
  VALUES (COALESCE(p_user_id, auth.uid()), p_wallpaper_id)
  ON CONFLICT (user_id, wallpaper_id) DO NOTHING;
  
  SELECT COUNT(*) INTO total FROM public.installs WHERE wallpaper_id = p_wallpaper_id;
  RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Toggle a like (insert if not exists, delete if exists)
CREATE OR REPLACE FUNCTION public.toggle_like(p_wallpaper_id TEXT)
RETURNS JSON AS $$
DECLARE
  existing UUID;
  total INT;
  is_liked BOOLEAN;
BEGIN
  SELECT id INTO existing FROM public.likes
    WHERE user_id = auth.uid() AND wallpaper_id = p_wallpaper_id;
  
  IF existing IS NOT NULL THEN
    DELETE FROM public.likes WHERE id = existing;
    is_liked := false;
  ELSE
    INSERT INTO public.likes (user_id, wallpaper_id) VALUES (auth.uid(), p_wallpaper_id);
    is_liked := true;
  END IF;
  
  SELECT COUNT(*) INTO total FROM public.likes WHERE wallpaper_id = p_wallpaper_id;
  RETURN json_build_object('liked', is_liked, 'totalLikes', total);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get marketplace stats
CREATE OR REPLACE FUNCTION public.marketplace_stats()
RETURNS JSON AS $$
DECLARE
  user_count INT;
  submission_count INT;
  install_count INT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.user_profiles;
  SELECT COUNT(*) INTO submission_count FROM public.submissions WHERE status = 'approved';
  SELECT COUNT(*) INTO install_count FROM public.installs;
  RETURN json_build_object(
    'activeUsers', user_count,
    'approvedWallpapers', submission_count,
    'totalInstalls', install_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's liked wallpaper IDs
CREATE OR REPLACE FUNCTION public.get_user_likes()
RETURNS TEXT[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT wallpaper_id FROM public.likes WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
