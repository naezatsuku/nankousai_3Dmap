-- notices テーブルに審査用カラムを追加
-- status: 'pending'(審査待ち) | 'approved'(承認済み) | 'rejected'(却下)
-- admin が作成した場合はデフォルト 'approved'、editor/teacher は 'pending'
ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS status         TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS review_comment TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 既存レコードはすべて承認済みとして扱う
UPDATE public.notices SET status = 'approved' WHERE status = 'approved';

-- teacher_notify_settings に却下通知設定を追加
ALTER TABLE public.teacher_notify_settings
  ADD COLUMN IF NOT EXISTS notify_notice_rejected BOOLEAN NOT NULL DEFAULT true;
