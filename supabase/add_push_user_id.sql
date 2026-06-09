-- =================================================================
-- push_subscriptions テーブルの確認・修正
-- Supabase ダッシュボード > SQL Editor で実行してください
-- IF NOT EXISTS / IF EXISTS を使っているので何度実行しても安全です
-- =================================================================

-- 1. push_subscriptions テーブルが存在しない場合は作成
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         BIGSERIAL PRIMARY KEY,
  fcm_token  TEXT NOT NULL UNIQUE,
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. user_id カラムが存在しない場合は追加（すでにある場合は何もしない）
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. user_id のインデックス（先生への通知検索で使用）
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);
