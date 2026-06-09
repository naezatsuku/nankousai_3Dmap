-- =================================================================
-- 先生候補フロー: school_type に 'teacher' を追加
-- Supabase ダッシュボード > SQL Editor で実行してください
-- add_teacher_role.sql の実行後に実行すること
-- =================================================================

-- ─── profiles.school_type に 'teacher' を追加 ─────────────────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_school_type_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_school_type_check
  CHECK (school_type IN ('middle', 'high', 'teacher'));

-- ─── handle_new_user: 常に role = 'student' で作成 ────────────────
-- signup 時点では student。管理者が先生管理ページで teacher に昇格させる。
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    'student'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
