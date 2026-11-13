ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS equipment_id uuid REFERENCES public.equipment(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS operators_equipment_unit_uniq ON public.operators(equipment_id) WHERE equipment_id IS NOT NULL;
COMMENT ON COLUMN public.operators.equipment_id IS 'Set for the automatic unit record that represents a forklift in Forklift Mode (no personal driver logins).';
COMMENT ON TABLE public.operator_pins IS 'DEPRECATED: Forklift Mode no longer uses driver PINs.';

CREATE OR REPLACE FUNCTION public.forklift_go_online(_event uuid, _equipment uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE org uuid; eq public.equipment; op uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT organization_id INTO org FROM public.events WHERE id = _event;
  IF org IS NULL OR NOT public.is_org_staff(org) THEN RAISE EXCEPTION 'Event not found'; END IF;
  SELECT * INTO eq FROM public.equipment WHERE id = _equipment AND organization_id = org AND retired_at IS NULL;
  IF eq.id IS NULL THEN RAISE EXCEPTION 'Forklift not found'; END IF;
  SELECT id INTO op FROM public.operators WHERE equipment_id = _equipment;
  IF op IS NULL THEN
    INSERT INTO public.operators(organization_id, full_name, status, equipment_id)
      VALUES (org, eq.unit_number, 'available', _equipment) RETURNING id INTO op;
  ELSE
    UPDATE public.operators SET full_name = eq.unit_number,
      status = CASE WHEN status = 'off_shift' THEN 'available'::operator_status ELSE status END WHERE id = op;
  END IF;
  INSERT INTO public.event_operators(event_id, operator_id, organization_id, added_by)
    VALUES (_event, op, org, auth.uid()) ON CONFLICT DO NOTHING;
  INSERT INTO public.operator_unlocks(user_id, operator_id, event_id, expires_at)
    VALUES (auth.uid(), op, _event, now() + interval '12 hours')
    ON CONFLICT (user_id) DO UPDATE SET operator_id = EXCLUDED.operator_id, event_id = EXCLUDED.event_id,
      unlocked_at = now(), expires_at = EXCLUDED.expires_at;
  PERFORM public.fleet_select(_equipment);
  RETURN op;
END $$;
REVOKE ALL ON FUNCTION public.forklift_go_online(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forklift_go_online(uuid, uuid) TO authenticated;