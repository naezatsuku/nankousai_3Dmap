-- =====================================================
-- お知らせへの「いいね」機能 マイグレーション
-- Supabase ダッシュボード > SQL Editor で実行してください
-- =====================================================

CREATE TABLE IF NOT EXISTS public.notice_likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id  uuid NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  user_id    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notice_id, user_id)
);

CREATE INDEX IF NOT EXISTS notice_likes_notice_id_idx ON public.notice_likes(notice_id);

ALTER TABLE public.notice_likes ENABLE ROW LEVEL SECURITY;

-- 件数・自分のいいね状態の表示に使うため読み取りは公開
-- （挿入・削除は service-role 経由の /api/notice-like ルートのみが行う）
CREATE POLICY "notice_likes: public read" ON public.notice_likes FOR SELECT USING (true);
