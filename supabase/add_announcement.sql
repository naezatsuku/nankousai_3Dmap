-- =====================================================
-- 特殊演出機能 (CINEMATIC STAGE CALL) マイグレーション
-- Supabase ダッシュボード > SQL Editor で実行してください
-- =====================================================

-- exhibits テーブルに演出設定カラムを追加
ALTER TABLE public.exhibits
  ADD COLUMN IF NOT EXISTS enable_announcement  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS announcement_color   text;

-- site_settings テーブルにトリガー時間カラムを追加
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS announcement_trigger_minutes integer NOT NULL DEFAULT 5;
