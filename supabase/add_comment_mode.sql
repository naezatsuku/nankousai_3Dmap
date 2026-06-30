-- =====================================================
-- コメント機能 公開レベル設定 マイグレーション
-- Supabase ダッシュボード > SQL Editor で実行してください
-- =====================================================

-- site_settings テーブルにコメント機能設定カラムを追加
-- 'all_on'     : 全てON（スタンプラリー後のコメント機能・タイムライン「みんなの声」とも表示）
-- 'public_off' : コメント公開OFF（スタンプラリー後のコメント機能はそのまま・タイムライン「みんなの声」は非表示）
-- 'all_off'    : 全てOFF（スタンプラリー後のコメント機能・タイムライン「みんなの声」とも非表示）
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS comment_mode text NOT NULL DEFAULT 'all_on';

ALTER TABLE public.site_settings
  DROP CONSTRAINT IF EXISTS site_settings_comment_mode_check;

ALTER TABLE public.site_settings
  ADD CONSTRAINT site_settings_comment_mode_check
  CHECK (comment_mode IN ('all_on', 'public_off', 'all_off'));
