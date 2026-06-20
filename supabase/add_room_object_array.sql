-- =====================================================
-- room_object を複数指定可能にする（TEXT → TEXT[]）マイグレーション
-- Supabase ダッシュボード > SQL Editor で実行してください
-- =====================================================

ALTER TABLE public.exhibits
  ALTER COLUMN room_object TYPE TEXT[] USING (
    CASE WHEN room_object IS NULL OR room_object = '' THEN NULL
         ELSE ARRAY[room_object]
    END
  );
