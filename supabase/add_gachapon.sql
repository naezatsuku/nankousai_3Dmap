-- =====================================================
-- ガラポン機能 マイグレーション
-- Supabase ダッシュボード > SQL Editor で実行してください
-- =====================================================

-- site_settings にガラポン設定カラムを追加
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS gachapon_cost   integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS gachapon_secret text;

-- ガラポン消費履歴
CREATE TABLE IF NOT EXISTS public.gachapon_redemptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  spins       INTEGER NOT NULL CHECK (spins > 0),
  stamps_used INTEGER NOT NULL CHECK (stamps_used > 0),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gachapon_redemptions_user_id_idx
  ON public.gachapon_redemptions(user_id);

ALTER TABLE public.gachapon_redemptions ENABLE ROW LEVEL SECURITY;
-- API は SUPABASE_SERVICE_ROLE_KEY 経由でのみアクセスするため、
-- 一般ロール向けのポリシーは付与しない（RLS 有効のままデフォルト拒否）。
