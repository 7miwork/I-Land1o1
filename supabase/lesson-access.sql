-- ============================================================
-- I-Land1o1 – Lektions-Zugangskontrolle (Freischaltung)
-- ============================================================
-- Ausführen im Supabase SQL Editor (Dashboard).
-- Idempotent: IF NOT EXISTS / IF EXISTS verwendet.
--
-- Regeln:
-- 1. Einmal-Kauf (level1-once): Alle Lektionen frei, keine Reihenfolge-Zwang
-- 2. Monatliches Abo (level1-monthly): Begrenzte Lektionen pro Monat, Reihe einzuhalten
-- 3. Reihenfolge: Lektion n+1 erst nach Lektion n (außer Einmal-Kauf)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lesson_quota (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  month_start DATE NOT NULL DEFAULT (date_trunc('month', now())::date),
  lessons_done INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month_start)
);

ALTER TABLE public.lesson_quota ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lesson_quota_select_own ON public.lesson_quota;
CREATE POLICY lesson_quota_select_own ON public.lesson_quota
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS lesson_quota_all_service ON public.lesson_quota;
CREATE POLICY lesson_quota_all_service ON public.lesson_quota
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.lesson_unlocks (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

ALTER TABLE public.lesson_unlocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lesson_unlocks_select_own ON public.lesson_unlocks;
CREATE POLICY lesson_unlocks_select_own ON public.lesson_unlocks
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS lesson_unlocks_all_service ON public.lesson_unlocks;
CREATE POLICY lesson_unlocks_all_service ON public.lesson_unlocks
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.get_lesson_quota(target_lesson_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
  v_has_subscription BOOLEAN;
  v_month_start DATE := date_trunc('month', now())::date;
  v_lessons_done INTEGER := 0;
  v_limit INTEGER := 4;
  v_remaining INTEGER;
  v_prev_done BOOLEAN := true;
  v_prev_lesson TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'reason', NULL, 'remaining', NULL);
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;

  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = v_user_id
      AND s.status = 'active'
      AND s.price_id IN ('price_1UMSNrGrOz3Fo9oHXqEvSOAb', 'price_1UMSNrGrOz3Fo9oHKlsuSCNK')
  ) INTO v_has_subscription;

  IF NOT v_has_subscription THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Du brauchst ein aktives Abo oder einen einmaligen Kauf für diese Lektion.',
      'remaining', NULL
    );
  END IF;

  SELECT lessons_done INTO v_lessons_done
  FROM public.lesson_quota
  WHERE user_id = v_user_id AND month_start = v_month_start;

  IF v_lessons_done IS NULL THEN
    v_lessons_done := 0;
  END IF;

  v_remaining := GREATEST(0, v_limit - v_lessons_done);

  IF v_lessons_done >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Dein monatliches Lektionskontingent (' || v_limit || ' Lektionen) ist aufgebraucht.',
      'remaining', 0
    );
  END IF;

  SELECT lesson_id INTO v_prev_lesson
  FROM public.lesson_unlocks
  WHERE user_id = v_user_id
    AND lesson_id < target_lesson_id
  ORDER BY lesson_id DESC
  LIMIT 1;

  IF v_prev_lesson IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.lesson_progress
      WHERE user_id = v_user_id AND lesson_id = v_prev_lesson AND done = true
    ) INTO v_prev_done;

    IF NOT v_prev_done THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Bitte mache erst die vorherige Lektion (' || v_prev_lesson || ').',
        'remaining', v_remaining
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', NULL,
    'remaining', v_remaining
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_lesson_quota(finished_lesson_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_month_start DATE := date_trunc('month', now())::date;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.lesson_quota (user_id, month_start, lessons_done, updated_at)
  VALUES (v_user_id, v_month_start, 1, now())
  ON CONFLICT (user_id, month_start)
  DO UPDATE SET lessons_done = lesson_quota.lessons_done + 1, updated_at = now();

  INSERT INTO public.lesson_unlocks (user_id, lesson_id, unlocked_at)
  VALUES (v_user_id, finished_lesson_id, now())
  ON CONFLICT (user_id, lesson_id) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.get_lesson_quota IS 'Prüft Lektions-Zugang (Abo-Kontingent + Reihenfolge). Limit ist aktuell 4/Monat.';
COMMENT ON FUNCTION public.increment_lesson_quota IS 'Erhöht monatliches Lektions-Kontingent nach Abschluss.';
