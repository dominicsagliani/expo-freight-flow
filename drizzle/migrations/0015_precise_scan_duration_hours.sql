CREATE OR REPLACE FUNCTION public.session_hours(s public.work_sessions) RETURNS numeric LANGUAGE sql STABLE AS $$
 SELECT round(greatest(0,extract(epoch FROM (coalesce(s.ended_at,now())-s.started_at))-s.paused_seconds-CASE WHEN s.ended_at IS NULL AND s.paused_at IS NOT NULL THEN extract(epoch FROM (now()-s.paused_at)) ELSE 0 END)/3600.0,6)
$$;