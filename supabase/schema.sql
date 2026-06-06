-- =================================================================
-- 南高祭 公式サイト — Supabase Schema v1.0
-- Supabase ダッシュボード > SQL Editor で実行してください
-- =================================================================

-- ─── profiles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  school_type TEXT NOT NULL DEFAULT 'high' CHECK (school_type IN ('middle', 'high')),
  grade       SMALLINT NOT NULL DEFAULT 3 CHECK (grade BETWEEN 1 AND 6),
  class_num   SMALLINT NOT NULL DEFAULT 1 CHECK (class_num BETWEEN 1 AND 5),
  student_num SMALLINT NOT NULL DEFAULT 1,
  role        TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── exhibits ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exhibits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  class_label   TEXT,
  type          TEXT NOT NULL CHECK (type IN ('class', 'food', 'band', 'special', 'cafeteria')),
  room_object   TEXT,
  room_display  TEXT,
  floor         SMALLINT CHECK (floor BETWEEN 1 AND 6),
  catch_copy    TEXT,
  category      TEXT,   -- special type 用: 'ダンス', '演劇', etc.
  description   TEXT,
  thumbnail_url TEXT,
  cover_url     TEXT,
  has_wait_time BOOLEAN NOT NULL DEFAULT true,
  wait_minutes  SMALLINT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  day           TEXT NOT NULL DEFAULT 'both' CHECK (day IN ('sat', 'sun', 'both')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER exhibits_updated_at
  BEFORE UPDATE ON public.exhibits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── exhibit_sections ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exhibit_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibit_id  UUID NOT NULL REFERENCES public.exhibits(id) ON DELETE CASCADE,
  heading     TEXT NOT NULL DEFAULT '',
  body        JSONB NOT NULL DEFAULT '[]',  -- BodySegment[]
  order_index SMALLINT NOT NULL DEFAULT 0
);

-- ─── exhibit_images ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exhibit_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibit_id  UUID NOT NULL REFERENCES public.exhibits(id) ON DELETE CASCADE,
  section_id  UUID REFERENCES public.exhibit_sections(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('image', 'video')),
  caption     TEXT,
  order_index SMALLINT NOT NULL DEFAULT 0
);

-- ─── exhibit_editors ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exhibit_editors (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exhibit_id UUID NOT NULL REFERENCES public.exhibits(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, exhibit_id)
);

-- ─── notices ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibit_id  UUID NOT NULL REFERENCES public.exhibits(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  sender_name TEXT,          -- 空の場合は exhibit.name を使用
  is_urgent   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── notice_media ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notice_media (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id   UUID NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('image', 'video')),
  caption     TEXT,
  order_index SMALLINT NOT NULL DEFAULT 0
);

-- ─── bands ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bands (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibit_id    UUID NOT NULL REFERENCES public.exhibits(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  members       TEXT[] NOT NULL DEFAULT '{}',
  instagram     TEXT,
  thumbnail_url TEXT
);

-- ─── band_schedules ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.band_schedules (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id  UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  day      TEXT NOT NULL CHECK (day IN ('sat', 'sun')),
  start_at TIME NOT NULL,
  end_at   TIME NOT NULL,
  stage    TEXT
);

-- ─── food_menus ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.food_menus (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibit_id  UUID NOT NULL REFERENCES public.exhibits(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  price       INTEGER NOT NULL,
  image_url   TEXT,
  description TEXT,
  stock       INTEGER NOT NULL DEFAULT 0,
  is_selling  BOOLEAN NOT NULL DEFAULT true,
  sold_count  INTEGER NOT NULL DEFAULT 0
);

-- ─── special_schedules ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.special_schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibit_id  UUID NOT NULL REFERENCES public.exhibits(id) ON DELETE CASCADE,
  day         TEXT NOT NULL CHECK (day IN ('sat', 'sun')),
  start_at    TIME NOT NULL,
  end_at      TIME NOT NULL,
  location    TEXT,
  description TEXT
);

-- ─── shift_notification_prefs ────────────────────────────────
-- ユーザーのシフト通知設定。schedule-remind Edge Function が参照して FCM を送信する。
CREATE TABLE IF NOT EXISTS public.shift_notification_prefs (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notify_minutes INTEGER NOT NULL DEFAULT 15,
  updated_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.shift_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shift_notification_prefs: self rw"
  ON public.shift_notification_prefs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- push_subscriptions の user_id カラム（ログイン済みユーザーとトークンを紐付ける）
-- ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
-- CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON public.push_subscriptions(user_id);

-- ─── sent_shift_notifications ─────────────────────────────────
-- シフト通知の重複送信防止テーブル
CREATE TABLE IF NOT EXISTS public.sent_shift_notifications (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES public.shift_slots(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, slot_id)
);

-- ─── sent_notifications ───────────────────────────────────────
-- special_schedules / band_schedules 通知の重複送信防止テーブル
CREATE TABLE IF NOT EXISTS public.sent_notifications (
  key        TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── schedule_items ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.schedule_items (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key       TEXT    NOT NULL,
  title          TEXT    NOT NULL,
  date           TEXT    NOT NULL CHECK (date IN ('sat', 'sun')),
  start_time     TEXT    NOT NULL,
  end_time       TEXT,
  location       TEXT,
  exhibit_id     UUID    REFERENCES public.exhibits(id) ON DELETE SET NULL,
  notify_minutes INTEGER,
  color          TEXT,
  type           TEXT    NOT NULL DEFAULT 'visit' CHECK (type IN ('visit', 'custom')),
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schedule_items_user_key_idx
  ON public.schedule_items (user_key);

-- ─── announcements ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body       TEXT NOT NULL,
  is_urgent  BOOLEAN NOT NULL DEFAULT false,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =================================================================
-- Row Level Security
-- =================================================================

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibits          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibit_sections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibit_images    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibit_editors   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_media      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bands             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_schedules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_menus        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements     ENABLE ROW LEVEL SECURITY;

-- 全員が読める
CREATE POLICY "exhibits: public read"           ON public.exhibits          FOR SELECT USING (true);
CREATE POLICY "exhibit_sections: public read"   ON public.exhibit_sections  FOR SELECT USING (true);
CREATE POLICY "exhibit_images: public read"     ON public.exhibit_images    FOR SELECT USING (true);
CREATE POLICY "notices: public read"            ON public.notices           FOR SELECT USING (true);
CREATE POLICY "notice_media: public read"       ON public.notice_media      FOR SELECT USING (true);
CREATE POLICY "bands: public read"              ON public.bands             FOR SELECT USING (true);
CREATE POLICY "band_schedules: public read"     ON public.band_schedules    FOR SELECT USING (true);
CREATE POLICY "food_menus: public read"         ON public.food_menus        FOR SELECT USING (true);
CREATE POLICY "special_schedules: public read"  ON public.special_schedules FOR SELECT USING (true);
CREATE POLICY "announcements: public read"      ON public.announcements     FOR SELECT USING (true);

-- 認証ユーザーが書ける
CREATE POLICY "exhibits: auth write"            ON public.exhibits          FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "exhibit_sections: auth write"    ON public.exhibit_sections  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "exhibit_images: auth write"      ON public.exhibit_images    FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "exhibit_editors: auth all"       ON public.exhibit_editors   FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "notices: auth write"             ON public.notices           FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "notice_media: auth write"        ON public.notice_media      FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "bands: auth write"               ON public.bands             FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "band_schedules: auth write"      ON public.band_schedules    FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "food_menus: auth write"          ON public.food_menus        FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "special_schedules: auth write"   ON public.special_schedules FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "announcements: auth write"       ON public.announcements     FOR ALL USING (auth.role() = 'authenticated');

-- profiles: 認証ユーザーが全員を読める、自分のみ更新
CREATE POLICY "profiles: auth read"    ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles: update own"   ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles: insert own"   ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- =================================================================
-- Trigger: サインアップ時に profiles を自動作成
-- =================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =================================================================
-- 管理者を手動で設定する場合（初回セットアップ後に実行）
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
-- =================================================================
