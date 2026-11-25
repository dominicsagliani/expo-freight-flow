ALTER TABLE public.freight_items ADD COLUMN import_piece_number integer;
CREATE UNIQUE INDEX freight_import_piece_unique ON public.freight_items(event_id, exhibitor_id, booth_number, import_piece_number) WHERE import_piece_number IS NOT NULL;
CREATE OR REPLACE FUNCTION public.import_exhibitor_shipment(_event uuid, _row jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE org uuid; ex uuid; company text; booth text; n integer; weight numeric; made integer := 0; created boolean := false; b uuid;
BEGIN
  SELECT organization_id INTO org FROM public.events WHERE id = _event;
  IF auth.uid() IS NULL OR org IS NULL OR NOT public.is_org_staff(org) THEN RAISE EXCEPTION 'Not authorized to import this event'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_event::text, 0));
  company := trim(_row->>'company_name'); booth := trim(_row->>'booth_number');
  n := coalesce(nullif(_row->>'piece_count','')::integer,1); weight := coalesce(nullif(_row->>'weight_lbs','')::numeric,0);
  IF company IS NULL OR length(company)<2 OR booth IS NULL OR booth='' THEN RAISE EXCEPTION 'Company and booth are required'; END IF;
  IF n<1 OR n>1000 OR weight<0 OR weight::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid piece count or weight'; END IF;
  IF nullif(_row->>'contact_email','') IS NOT NULL AND (_row->>'contact_email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Invalid email'; END IF;
  SELECT id INTO ex FROM public.exhibitors WHERE organization_id=org AND lower(trim(company_name))=lower(company) ORDER BY created_at LIMIT 1;
  IF ex IS NULL THEN
    INSERT INTO public.exhibitors(organization_id,company_name,first_name,last_name,contact_name,contact_email,contact_phone,billing_address)
    VALUES(org,company,nullif(_row->>'first_name',''),nullif(_row->>'last_name',''),nullif(trim(concat_ws(' ',_row->>'first_name',_row->>'last_name')),''),nullif(_row->>'contact_email',''),nullif(_row->>'contact_phone',''),nullif(_row->>'billing_address','')) RETURNING id INTO ex;
    created:=true;
  END IF;
  SELECT id INTO b FROM public.event_exhibitors WHERE event_id=_event AND exhibitor_id=ex LIMIT 1;
  IF b IS NULL THEN
    INSERT INTO public.event_exhibitors(event_id,exhibitor_id,booth_number) VALUES(_event,ex,booth);
  ELSIF NOT EXISTS(SELECT 1 FROM public.event_exhibitors WHERE id=b AND booth_number=booth) THEN
    RAISE EXCEPTION 'This exhibitor already has a different booth; edit its booth before importing';
  END IF;
  INSERT INTO public.freight_items(event_id,exhibitor_id,booth_number,freight_type,description,pieces,weight_lbs,arrival_status,import_piece_number)
  SELECT _event,ex,booth,'crate',company||' — Piece '||i||' of '||n,1,weight,'expected',i FROM generate_series(1,n) i
  ON CONFLICT (event_id,exhibitor_id,booth_number,import_piece_number) WHERE import_piece_number IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS made=ROW_COUNT;
  RETURN jsonb_build_object('exhibitor_id',ex,'created',created,'labels_created',made,'labels_reused',n-made);
END;
$$;
REVOKE ALL ON FUNCTION public.import_exhibitor_shipment(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_exhibitor_shipment(uuid,jsonb) TO authenticated;