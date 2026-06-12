-- =================================================================
-- 南高祭 — band ロール + バンド単位の編集権限 + バンド名義お知らせ
-- Supabase ダッシュボード > SQL Editor で実行してください
-- =================================================================

-- ─── 1. profiles: band ロール追加 ─────────────────────────────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'editor', 'student', 'teacher', 'band'));

-- ─── 2. band_editors: バンド単位の編集権限 ────────────────────────
-- ロールとは独立。editor / student 等との兼任を想定し、
-- band_editors に行があれば「マイバンド」(/admin/band) にアクセスできる。
CREATE TABLE IF NOT EXISTS public.band_editors (
  band_id  UUID NOT NULL REFERENCES public.bands(id)    ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (band_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_band_editors_user_id
  ON public.band_editors(user_id);

-- RLS（既存テーブルと同方針: 読み取り公開・書き込みは authenticated）
ALTER TABLE public.band_editors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "band_editors: public read" ON public.band_editors
  FOR SELECT USING (true);
CREATE POLICY "band_editors: auth write" ON public.band_editors
  FOR ALL USING (auth.role() = 'authenticated');

-- ─── 3. notices: バンド名義のお知らせ ─────────────────────────────
-- exhibit_id は軽音団体のまま（通知購読・フィード表示を引き継ぐ）。
-- band_id があるお知らせはバンド名・バンド写真で表示される。
ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS band_id UUID REFERENCES public.bands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notices_band_id
  ON public.notices(band_id);
