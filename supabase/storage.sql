-- =================================================================
-- Supabase Storage — バケット作成
-- Supabase ダッシュボード > SQL Editor で実行してください
-- =================================================================

-- ── images バケット（展示サムネイル・カバー画像 / WebP / 5MB） ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images', 'images', true,
  5242880,
  ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "images: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'images');

CREATE POLICY "images: auth upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images');

CREATE POLICY "images: auth update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'images');

CREATE POLICY "images: auth delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'images');

-- ── media バケット（お知らせ用 画像＋動画 / 50MB） ──────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media', 'media', true,
  52428800,
  ARRAY['image/webp', 'image/jpeg', 'image/png',
        'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "media: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

CREATE POLICY "media: auth upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media');

CREATE POLICY "media: auth update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media');

CREATE POLICY "media: auth delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media');
