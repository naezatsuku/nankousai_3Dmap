-- =================================================================
-- 南高祭 — teacher ロール + 変更ログ + 通知設定
-- Supabase ダッシュボード > SQL Editor で実行してください
-- =================================================================

-- ─── 1. profiles: teacher ロール追加 ──────────────────────────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'editor', 'student', 'teacher'));

-- ─── 2. activity_logs: 展示への変更履歴 ───────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibit_id  UUID NOT NULL REFERENCES public.exhibits(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'notice_posted',
    'notice_edited',
    'content_edited',
    'basic_edited',
    'wait_updated',
    'status_changed',
    'sales_updated'
  )),
  summary     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_exhibit_id
  ON public.activity_logs(exhibit_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON public.activity_logs(created_at DESC);

-- ─── 3. teacher_notify_settings: 先生の通知設定 ───────────────────
-- action_type ごとに通知するかを exhibit 単位で設定
CREATE TABLE IF NOT EXISTS public.teacher_notify_settings (
  user_id               UUID NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  exhibit_id            UUID NOT NULL REFERENCES public.exhibits(id)   ON DELETE CASCADE,
  notify_notice_posted  BOOLEAN NOT NULL DEFAULT true,
  notify_notice_edited  BOOLEAN NOT NULL DEFAULT false,
  notify_content_edited BOOLEAN NOT NULL DEFAULT true,
  notify_basic_edited   BOOLEAN NOT NULL DEFAULT false,
  notify_wait_updated   BOOLEAN NOT NULL DEFAULT false,
  notify_status_changed BOOLEAN NOT NULL DEFAULT true,
  notify_sales_updated  BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, exhibit_id)
);

-- ─── RLS (必要に応じて有効化) ─────────────────────────────────────
-- activity_logs: 誰でも insert 可、読み取りは認証済みのみ
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_logs_insert" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "activity_logs_select" ON public.activity_logs
  FOR SELECT TO authenticated USING (true);

-- teacher_notify_settings: 自分のレコードのみ読み書き可
ALTER TABLE public.teacher_notify_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher_notify_settings_own" ON public.teacher_notify_settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- admin は全レコード閲覧可
CREATE POLICY "teacher_notify_settings_admin_read" ON public.teacher_notify_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
