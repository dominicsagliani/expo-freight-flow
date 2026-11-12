CREATE OR REPLACE FUNCTION public.operator_start_job(_ticket uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.tickets;
BEGIN
  SELECT * INTO t FROM public.tickets WHERE id = _ticket FOR UPDATE;
  IF t.id IS NULL OR t.assigned_operator_id IS NULL
     OR t.assigned_operator_id NOT IN (SELECT public.user_operator_ids()) THEN
    RAISE EXCEPTION 'This job is not assigned to you';
  END IF;
  IF t.status <> 'assigned' THEN
    RAISE EXCEPTION 'Only assigned jobs can be started (current status: %)', t.status;
  END IF;
  UPDATE public.tickets SET status = 'in_progress', started_at = now() WHERE id = _ticket;
  UPDATE public.operators SET status = 'on_job' WHERE id = t.assigned_operator_id;
END $$;

CREATE OR REPLACE FUNCTION public.operator_complete_job(_ticket uuid, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.tickets;
BEGIN
  SELECT * INTO t FROM public.tickets WHERE id = _ticket FOR UPDATE;
  IF t.id IS NULL OR t.assigned_operator_id IS NULL
     OR t.assigned_operator_id NOT IN (SELECT public.user_operator_ids()) THEN
    RAISE EXCEPTION 'This job is not assigned to you';
  END IF;
  IF t.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Only jobs in progress can be completed (current status: %)', t.status;
  END IF;
  UPDATE public.tickets SET status = 'completed', completed_at = now(),
    completion_notes = NULLIF(trim(coalesce(_notes, '')), '') WHERE id = _ticket;
  UPDATE public.operators SET status = 'available' WHERE id = t.assigned_operator_id
    AND NOT EXISTS (SELECT 1 FROM public.tickets x WHERE x.assigned_operator_id = t.assigned_operator_id AND x.status = 'in_progress');
END $$;

REVOKE ALL ON FUNCTION public.operator_start_job(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.operator_complete_job(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.operator_start_job(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.operator_complete_job(uuid, text) TO authenticated;