CREATE OR REPLACE FUNCTION public.op_scan_freight(_token text, _ticket uuid, _action text, _equipment uuid DEFAULT NULL, _booth_ok boolean DEFAULT NULL, _flag text DEFAULT NULL, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.freight_items; tf public.ticket_freight; t public.tickets; s public.work_sessions; sid uuid; op uuid; ex text; stopped boolean:=false; finished boolean:=false;
BEGIN
 op:=public.my_operator_on_ticket(_ticket);
 IF auth.uid() IS NULL OR op IS NULL THEN RETURN jsonb_build_object('ok',false,'error','This job is not assigned to you'); END IF;
 SELECT * INTO t FROM public.tickets WHERE id=_ticket;
 PERFORM pg_advisory_xact_lock(hashtextextended(t.event_id::text,0));
 SELECT * INTO t FROM public.tickets WHERE id=_ticket FOR UPDATE;
 IF t.status IN ('completed','cancelled') THEN RETURN jsonb_build_object('ok',false,'error','This job is already closed'); END IF;
 SELECT * INTO f FROM public.freight_items WHERE qr_token=trim(_token) AND organization_id=t.organization_id;
 IF f.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Unknown freight label'); END IF;
 SELECT company_name INTO ex FROM public.exhibitors WHERE id=f.exhibitor_id;
 SELECT * INTO tf FROM public.ticket_freight WHERE ticket_id=_ticket AND freight_id=f.id FOR UPDATE;
 IF tf.ticket_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Wrong freight — not on this job'); END IF;
 IF _action='pickup' THEN
  IF tf.picked_up_at IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'error','Already picked up'); END IF;
  IF public.session_hourly_rate(_ticket) IS NULL THEN RAISE EXCEPTION 'Ask dispatch to configure an hourly rate before scanning in'; END IF;
  sid:=public.op_start_session(_ticket,_equipment);
  IF EXISTS(SELECT 1 FROM public.work_sessions WHERE id=sid AND status='paused') THEN RAISE EXCEPTION 'Resume the timer before scanning in'; END IF;
  UPDATE public.ticket_freight SET picked_up_at=now(),picked_up_by=auth.uid(),picked_up_session_id=sid,scanned_at=coalesce(scanned_at,now()),scanned_by=coalesce(scanned_by,auth.uid()) WHERE ticket_id=_ticket AND freight_id=f.id;
  INSERT INTO public.delivery_updates(ticket_id,freight_id,kind) VALUES(_ticket,f.id,'picked_up');
 ELSIF _action='deliver' THEN
  IF tf.delivered_at IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'error','Already delivered'); END IF;
  IF tf.picked_up_at IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Scan in first'); END IF;
  SELECT * INTO s FROM public.work_sessions WHERE id=tf.picked_up_session_id FOR UPDATE;
  IF s.id IS NULL OR s.operator_id<>op OR s.equipment_id IS DISTINCT FROM _equipment OR s.status='completed' THEN RAISE EXCEPTION 'Scan out with the driver and forklift that scanned this freight in'; END IF;
  IF _booth_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Confirm the destination booth before scanning out'; END IF;
  IF _flag IS NOT NULL AND _flag NOT IN ('damaged','missing') THEN RAISE EXCEPTION 'Bad flag'; END IF;
  sid:=s.id;
  UPDATE public.ticket_freight SET delivered_at=now(),delivered_by=auth.uid(),delivered_session_id=sid,booth_verified=true,flag=_flag WHERE ticket_id=_ticket AND freight_id=f.id;
  UPDATE public.freight_items SET arrival_status='delivered_to_booth' WHERE id=f.id;
  INSERT INTO public.delivery_updates(ticket_id,freight_id,kind,note,location) VALUES(_ticket,f.id,'delivered',nullif(trim(coalesce(_note,'')),''),f.booth_number);
  IF _flag IS NOT NULL THEN INSERT INTO public.delivery_updates(ticket_id,freight_id,kind,issue_type,note) VALUES(_ticket,f.id,'issue',_flag,nullif(trim(coalesce(_note,'')),'')); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.ticket_freight WHERE ticket_id=_ticket AND picked_up_session_id=sid AND delivered_at IS NULL) THEN
   PERFORM public.op_complete_session(sid); stopped:=true;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.ticket_freight WHERE ticket_id=_ticket AND delivered_at IS NULL) AND NOT EXISTS(SELECT 1 FROM public.work_sessions WHERE ticket_id=_ticket AND status<>'completed') THEN
   UPDATE public.tickets SET status='completed',completed_at=now() WHERE id=_ticket;
   finished:=true;
   PERFORM public.queue_dispatch(t.event_id);
  END IF;
 ELSE RAISE EXCEPTION 'Unknown action'; END IF;
 RETURN jsonb_build_object('ok',true,'action',_action,'freight_id',f.id,'freight_code',f.freight_code,'description',f.description,'exhibitor',ex,'booth',f.booth_number,'ticket_number',t.ticket_number,'session_id',sid,'timer_stopped',stopped,'job_completed',finished);
END $$;
REVOKE ALL ON FUNCTION public.op_scan_freight(text,uuid,text,uuid,boolean,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.op_scan_freight(text,uuid,text,uuid,boolean,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.calc_ticket_charge(_org uuid,_event uuid,_service public.service_type,_ticket uuid,_started timestamptz,_completed timestamptz,_labor numeric)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.service_rates; w numeric; p integer; hrs numeric; amt numeric; sess numeric;
BEGIN
 SELECT sr.* INTO r FROM public.service_rates sr JOIN public.rate_cards rc ON rc.id=sr.rate_card_id WHERE rc.organization_id=_org AND sr.service_type=_service AND (rc.event_id=_event OR (rc.event_id IS NULL AND rc.is_default)) ORDER BY (rc.event_id IS NOT NULL) DESC,rc.created_at DESC LIMIT 1;
 IF EXISTS(SELECT 1 FROM public.ticket_freight WHERE ticket_id=_ticket AND picked_up_session_id IS NOT NULL) THEN
  IF EXISTS(SELECT 1 FROM public.work_sessions WHERE ticket_id=_ticket AND hourly_rate IS NULL) THEN RETURN NULL; END IF;
  SELECT sum(coalesce(s.billable_amount,round(public.session_hours(s)*s.hourly_rate,2))) INTO sess FROM public.work_sessions s WHERE s.ticket_id=_ticket;
  RETURN round(greatest(sess,coalesce(r.minimum_charge,0)),2);
 END IF;
 IF r.id IS NULL THEN RETURN NULL; END IF;
 SELECT coalesce(sum(f.weight_lbs),0),coalesce(sum(f.pieces),0) INTO w,p FROM public.ticket_freight tf JOIN public.freight_items f ON f.id=tf.freight_id WHERE tf.ticket_id=_ticket;
 IF r.unit='per_cwt' THEN amt:=ceil(w/100.0)*r.rate;
 ELSIF r.unit='per_piece' THEN amt:=p*r.rate;
 ELSIF r.unit='per_hour' THEN
  IF _labor IS NULL AND EXISTS(SELECT 1 FROM public.work_sessions WHERE ticket_id=_ticket) THEN
   SELECT sum(coalesce(s.billable_hours,public.session_hours(s))*coalesce(s.hourly_rate,r.rate)) INTO sess FROM public.work_sessions s WHERE s.ticket_id=_ticket; amt:=sess;
  ELSE hrs:=CASE WHEN _labor IS NOT NULL THEN _labor WHEN _started IS NULL OR _completed IS NULL THEN 1 ELSE greatest(0.5,ceil(extract(epoch FROM (_completed-_started))/1800.0)/2.0) END; amt:=hrs*r.rate; END IF;
 ELSE amt:=r.rate; END IF;
 RETURN round(greatest(amt,r.minimum_charge),2);
END $$;

CREATE OR REPLACE FUNCTION public.prevent_loaded_timer_stop() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.status<>'completed' AND NEW.status='completed' AND EXISTS(SELECT 1 FROM public.ticket_freight WHERE picked_up_session_id=OLD.id AND delivered_at IS NULL) THEN RAISE EXCEPTION 'Scan out all freight on this forklift before stopping its timer'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER prevent_loaded_timer_stop BEFORE UPDATE ON public.work_sessions FOR EACH ROW EXECUTE FUNCTION public.prevent_loaded_timer_stop();
CREATE OR REPLACE FUNCTION public.prevent_unscanned_job_completion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status='completed' AND OLD.status<>'completed' AND EXISTS(SELECT 1 FROM public.ticket_freight WHERE ticket_id=NEW.id) AND (EXISTS(SELECT 1 FROM public.ticket_freight WHERE ticket_id=NEW.id AND delivered_at IS NULL) OR EXISTS(SELECT 1 FROM public.work_sessions WHERE ticket_id=NEW.id AND status<>'completed')) THEN RAISE EXCEPTION 'Scan out all freight and finish all timers before completing this job'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER prevent_unscanned_job_completion BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.prevent_unscanned_job_completion();