CREATE OR REPLACE FUNCTION public.receive_bill_of_lading(_event uuid, _exhibitor uuid, _storage_path text, _filename text, _mime text, _file_size bigint, _carrier text, _pro text, _shipper text, _consignee text, _booth text, _declared_pieces integer, _description text, _total_weight numeric, _special text, _crates jsonb, _intake_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE v_org uuid; v_bol_id uuid; v_count integer; v_booth text; v_path_prefix text; c record; saved public.freight_items;
BEGIN
 IF _intake_key IS NULL THEN RAISE EXCEPTION 'Missing intake key'; END IF;
 SELECT e.organization_id INTO v_org FROM public.events e WHERE e.id=_event;
 IF auth.uid() IS NULL OR v_org IS NULL OR NOT public.is_org_staff(v_org) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_event::text,0));
 SELECT b.id INTO v_bol_id FROM public.bills_of_lading b WHERE b.intake_key=_intake_key AND b.organization_id=v_org AND b.event_id=_event AND b.exhibitor_id=_exhibitor;
 IF v_bol_id IS NOT NULL THEN
   RETURN (SELECT jsonb_build_object('bol_id',v_bol_id,'freight_ids',coalesce(jsonb_agg(f.id ORDER BY f.bol_crate_number),'[]'::jsonb)) FROM public.freight_items f WHERE f.bol_id=v_bol_id);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.exhibitors x WHERE x.id=_exhibitor AND x.organization_id=v_org) THEN RAISE EXCEPTION 'Exhibitor does not belong to this company'; END IF;
 SELECT ee.booth_number INTO v_booth FROM public.event_exhibitors ee WHERE ee.event_id=_event AND ee.exhibitor_id=_exhibitor;
 IF v_booth IS NULL THEN RAISE EXCEPTION 'Exhibitor is not registered for this event'; END IF;
 IF _crates IS NULL OR jsonb_typeof(_crates)<>'array' THEN RAISE EXCEPTION 'Crate list is required'; END IF;
 v_count:=jsonb_array_length(_crates);
 IF v_count<1 OR v_count>50 THEN RAISE EXCEPTION 'Enter between 1 and 50 crates'; END IF;
 IF _declared_pieces IS DISTINCT FROM v_count THEN RAISE EXCEPTION 'Piece count must match the individual crate records'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(_crates) c(value) WHERE jsonb_typeof(c.value)<>'object' OR coalesce(nullif(c.value->>'weight_lbs','')::numeric,0)<0 OR coalesce(c.value->>'weight_lbs','') IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Invalid crate weight'; END IF;
 IF _total_weight IS NOT NULL AND (_total_weight<0 OR _total_weight::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Invalid total weight'; END IF;
 IF _mime NOT IN ('application/pdf','image/jpeg','image/png') THEN RAISE EXCEPTION 'Only PDF, JPG and PNG files are allowed'; END IF;
 IF _file_size<=0 OR _file_size>15728640 THEN RAISE EXCEPTION 'Document must be 15 MB or smaller'; END IF;
 IF nullif(trim(_filename),'') IS NULL THEN RAISE EXCEPTION 'Original filename is required'; END IF;
 v_path_prefix:=v_org::text||'/'||_event::text||'/'||_intake_key::text||'/';
 IF left(_storage_path,length(v_path_prefix))<>v_path_prefix THEN RAISE EXCEPTION 'Document path does not match this shipment'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='bol-documents' AND o.name=_storage_path) THEN RAISE EXCEPTION 'Upload the BOL document before check-in'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(_crates) a WHERE nullif(a->>'freight_id','') IS NOT NULL GROUP BY a->>'freight_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'A piece cannot be received twice in one shipment'; END IF;
 INSERT INTO public.bills_of_lading(organization_id,event_id,exhibitor_id,intake_key,storage_path,original_filename,mime_type,file_size_bytes,carrier_name,pro_number,shipper_name,consignee_name,booth_number,declared_pieces,description,total_weight_lbs,special_instructions,received_by)
 VALUES(v_org,_event,_exhibitor,_intake_key,_storage_path,trim(_filename),_mime,_file_size,nullif(trim(_carrier),''),nullif(trim(_pro),''),nullif(trim(_shipper),''),nullif(trim(_consignee),''),coalesce(nullif(trim(_booth),''),v_booth),_declared_pieces,nullif(trim(_description),''),_total_weight,nullif(trim(_special),''),auth.uid()) RETURNING id INTO v_bol_id;
 FOR c IN SELECT value,ordinality FROM jsonb_array_elements(_crates) WITH ORDINALITY LOOP
  IF nullif(c.value->>'freight_id','') IS NOT NULL THEN
    SELECT * INTO saved FROM public.freight_items WHERE id=(c.value->>'freight_id')::uuid AND event_id=_event AND exhibitor_id=_exhibitor AND organization_id=v_org AND booth_number=v_booth AND arrival_status='expected' AND bol_id IS NULL FOR UPDATE;
    IF saved.id IS NULL THEN RAISE EXCEPTION 'Selected piece is not available for receiving'; END IF;
    UPDATE public.freight_items SET bol_id=v_bol_id,bol_crate_number=c.ordinality,arrival_status='received',weight_lbs=coalesce(nullif(c.value->>'weight_lbs','')::numeric,0),description=coalesce(nullif(trim(c.value->>'description'),''),description) WHERE id=saved.id;
  ELSE
    INSERT INTO public.freight_items(organization_id,event_id,exhibitor_id,bol_id,bol_crate_number,freight_code,freight_type,description,pieces,weight_lbs,booth_number,arrival_status,created_by)
    VALUES(v_org,_event,_exhibitor,v_bol_id,c.ordinality,'','crate',left(coalesce(nullif(trim(c.value->>'description'),''),nullif(trim(_description),''),'Received freight')||' — Crate '||c.ordinality::text,500),1,coalesce(nullif(c.value->>'weight_lbs','')::numeric,0),coalesce(nullif(trim(_booth),''),v_booth),'received',auth.uid());
  END IF;
 END LOOP;
 PERFORM public.log_activity(v_org,'bol_received',NULL,NULL,_event,jsonb_build_object('bol_id',v_bol_id,'crate_count',v_count,'pro_number',nullif(trim(_pro),'')),now());
 RETURN (SELECT jsonb_build_object('bol_id',v_bol_id,'freight_ids',coalesce(jsonb_agg(f.id ORDER BY f.bol_crate_number),'[]'::jsonb)) FROM public.freight_items f WHERE f.bol_id=v_bol_id);
END $$;