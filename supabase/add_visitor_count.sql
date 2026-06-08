-- =====================================================
-- 来場者数記録 マイグレーション
-- Supabase ダッシュボード > SQL Editor で実行してください
-- =====================================================

ALTER TABLE public.exhibits
  ADD COLUMN IF NOT EXISTS visitor_count integer NOT NULL DEFAULT 0;
