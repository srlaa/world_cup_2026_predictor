/* Friend leagues and lightweight operational visibility. */

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
UPDATE public.profiles SET is_admin = true
WHERE id = (SELECT id FROM public.profiles ORDER BY created_at LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE is_admin);

CREATE TABLE IF NOT EXISTS public.leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 50),
  invite_code text NOT NULL UNIQUE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.league_members (
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.sync_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  success boolean NOT NULL DEFAULT false,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text
);

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "league_members_read" ON public.league_members;
CREATE POLICY "league_members_read" ON public.league_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "leagues_read_members" ON public.leagues;
CREATE POLICY "leagues_read_members" ON public.leagues FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.league_members lm WHERE lm.league_id = leagues.id AND lm.user_id = auth.uid()));
DROP POLICY IF EXISTS "sync_runs_admin_read" ON public.sync_runs;
CREATE POLICY "sync_runs_admin_read" ON public.sync_runs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin));

CREATE OR REPLACE FUNCTION public.create_league(league_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid; new_code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF char_length(trim(league_name)) NOT BETWEEN 2 AND 50 THEN RAISE EXCEPTION 'League name must contain 2 to 50 characters'; END IF;
  LOOP
    new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.leagues WHERE invite_code = new_code);
  END LOOP;
  INSERT INTO public.leagues (name, invite_code, owner_id) VALUES (trim(league_name), new_code, auth.uid()) RETURNING id INTO new_id;
  INSERT INTO public.league_members (league_id, user_id) VALUES (new_id, auth.uid());
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_league(code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT id INTO target_id FROM public.leagues WHERE invite_code = upper(trim(code));
  IF target_id IS NULL THEN RAISE EXCEPTION 'League code was not found'; END IF;
  INSERT INTO public.league_members (league_id, user_id) VALUES (target_id, auth.uid()) ON CONFLICT DO NOTHING;
  RETURN target_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_league(target_league_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.leagues WHERE id = target_league_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'The league owner cannot leave the league';
  END IF;
  DELETE FROM public.league_members WHERE league_id = target_league_id AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_leagues()
RETURNS TABLE (id uuid, name text, invite_code text, owner_id uuid, member_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, l.name, l.invite_code, l.owner_id, count(all_members.user_id)
  FROM public.leagues l
  JOIN public.league_members mine ON mine.league_id = l.id AND mine.user_id = auth.uid()
  JOIN public.league_members all_members ON all_members.league_id = l.id
  GROUP BY l.id ORDER BY l.created_at;
$$;

CREATE OR REPLACE FUNCTION public.get_league_standings(target_league_id uuid)
RETURNS TABLE (user_id uuid, display_name text, total_match_points numeric, total_round_goal_points integer, exact_score_bonuses integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, us.total_match_points, us.total_round_goal_points, us.exact_score_bonuses
  FROM public.league_members lm
  JOIN public.profiles p ON p.id = lm.user_id
  JOIN public.user_scores us ON us.user_id = lm.user_id
  WHERE lm.league_id = target_league_id
    AND EXISTS (SELECT 1 FROM public.league_members mine WHERE mine.league_id = target_league_id AND mine.user_id = auth.uid())
  ORDER BY (us.total_match_points + us.total_round_goal_points) DESC, p.display_name;
$$;

REVOKE ALL ON FUNCTION public.create_league(text), public.join_league(text), public.leave_league(uuid), public.get_my_leagues(), public.get_league_standings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_league(text), public.join_league(text), public.leave_league(uuid), public.get_my_leagues(), public.get_league_standings(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_league_members_user ON public.league_members(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_job_started ON public.sync_runs(job_name, started_at DESC);
