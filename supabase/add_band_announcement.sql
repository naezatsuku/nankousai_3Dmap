-- bands テーブルに特殊演出フラグと演出色を追加
ALTER TABLE public.bands
  ADD COLUMN IF NOT EXISTS enable_announcement boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS announcement_color  text;
