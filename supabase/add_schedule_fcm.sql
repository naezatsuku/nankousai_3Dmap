-- =================================================================
-- schedule_items に fcm_token カラムを追加
-- PatternA（exhibit_push_subs）と PatternB（schedule_items）を
-- fcm_token で突き合わせて重複通知を防ぐための変更
-- =================================================================

ALTER TABLE public.schedule_items
  ADD COLUMN IF NOT EXISTS fcm_token TEXT;

CREATE INDEX IF NOT EXISTS schedule_items_fcm_token_exhibit_idx
  ON public.schedule_items (fcm_token, exhibit_id)
  WHERE fcm_token IS NOT NULL AND notify_minutes IS NOT NULL;
