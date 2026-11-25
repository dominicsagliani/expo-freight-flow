CREATE TABLE public.inbound_shipments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 event_id uuid NOT NULL REFERENCES public.events(id), exhibitor_id uuid NOT NULL REFERENCES public.exhibitors(id),
 booth_number text NOT NULL, carrier text NOT NULL DEFAULT '', expected_arrival date, expected_pieces integer NOT NULL,
 freight_type public.freight_type NOT NULL DEFAULT 'crate', unexpected boolean NOT NULL DEFAULT false,
 note text NOT NULL DEFAULT '', storage_path text, original_filename text, intake_key uuid NOT NULL UNIQUE,
 created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT inbound_expected_count CHECK (expected_pieces BETWEEN 0 AND 1000)
);
GRANT SELECT ON public.inbound_shipments TO authenticated;
GRANT ALL ON public.inbound_shipments TO service_role;
ALTER TABLE public.inbound_shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and own exhibitors view shipments" ON public.inbound_shipments FOR SELECT TO authenticated USING (
 public.is_org_staff(organization_id) OR EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role='exhibitor' AND r.organization_id=inbound_shipments.organization_id AND r.exhibitor_id=inbound_shipments.exhibitor_id AND (r.event_id IS NULL OR r.event_id=inbound_shipments.event_id))
);
CREATE TABLE public.inbound_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 shipment_id uuid NOT NULL REFERENCES public.inbound_shipments(id), intake_key uuid NOT NULL UNIQUE,
 received_count integer NOT NULL, note text NOT NULL DEFAULT '', storage_path text, original_filename text,
 received_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inbound_receipts TO authenticated;
GRANT ALL ON public.inbound_receipts TO service_role;
ALTER TABLE public.inbound_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view arrival records" ON public.inbound_receipts FOR SELECT TO authenticated USING(public.is_org_staff(organization_id));
ALTER TABLE public.freight_items ADD COLUMN inbound_shipment_id uuid REFERENCES public.inbound_shipments(id);
ALTER TABLE public.freight_items ADD COLUMN inbound_extra boolean NOT NULL DEFAULT false;
CREATE INDEX inbound_freight_lookup ON public.freight_items(inbound_shipment_id);
CREATE INDEX inbound_event_lookup ON public.inbound_shipments(event_id,exhibitor_id);
CREATE OR REPLACE FUNCTION public.inbound_freight_validate() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND current_user IN ('authenticated','anon') AND (NEW.inbound_shipment_id IS DISTINCT FROM OLD.inbound_shipment_id OR NEW.inbound_extra IS DISTINCT FROM OLD.inbound_extra) THEN RAISE EXCEPTION 'Use shipment registration to change shipment links'; END IF;
 IF NEW.inbound_shipment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.inbound_shipments s WHERE s.id=NEW.inbound_shipment_id AND s.organization_id=NEW.organization_id AND s.event_id=NEW.event_id AND s.exhibitor_id=NEW.exhibitor_id AND s.booth_number=NEW.booth_number) THEN RAISE EXCEPTION 'Freight must match its shipment'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zz_inbound_freight_validate BEFORE INSERT OR UPDATE ON public.freight_items FOR EACH ROW EXECUTE FUNCTION public.inbound_freight_validate();
CREATE OR REPLACE FUNCTION public.register_inbound_shipment(_event uuid,_exhibitor uuid,_carrier text,_arrival date,_count integer,_type public.freight_type,_note text,_unexpected boolean,_existing uuid[],_key uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid; booth text; sid uuid; linked integer;
BEGIN
 SELECT organization_id INTO org FROM public.events WHERE id=_event AND status<>'closed';
 IF auth.uid() IS NULL OR org IS NULL OR NOT (public.is_org_staff(org) OR EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.organization_id=org AND r.role='exhibitor' AND r.exhibitor_id=_exhibitor AND (r.event_id IS NULL OR r.event_id=_event))) THEN RAISE EXCEPTION 'Not authorized to register this shipment'; END IF;
 IF _unexpected AND NOT public.is_org_staff(org) THEN RAISE EXCEPTION 'Only receiving staff register unexpected arrivals'; END IF;
 SELECT booth_number INTO booth FROM public.event_exhibitors WHERE event_id=_event AND exhibitor_id=_exhibitor AND organization_id=org;
 IF booth IS NULL OR _key IS NULL THEN RAISE EXCEPTION 'An assigned event booth and intake key are required'; END IF;
 IF _count IS NULL OR _count<1 OR _count>1000 OR _type NOT IN ('crate','pallet') OR length(coalesce(_carrier,''))>240 OR length(coalesce(_note,''))>4000 THEN RAISE EXCEPTION 'Invalid shipment details'; END IF;
 IF NOT _unexpected AND _arrival IS NULL THEN RAISE EXCEPTION 'Expected arrival date is required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_event::text,0));
 SELECT id INTO sid FROM public.inbound_shipments WHERE intake_key=_key AND organization_id=org AND event_id=_event AND exhibitor_id=_exhibitor;
 IF sid IS NOT NULL THEN RETURN sid; END IF;
 linked:=coalesce(cardinality(_existing),0);
 IF _unexpected AND linked>0 THEN RAISE EXCEPTION 'Unexpected arrivals must use new freight records'; END IF;
 IF linked>_count OR linked<>(SELECT count(DISTINCT id) FROM public.freight_items WHERE id=ANY(_existing) AND event_id=_event AND exhibitor_id=_exhibitor AND booth_number=booth AND organization_id=org AND inbound_shipment_id IS NULL AND arrival_status='expected' AND pieces=1 AND bol_id IS NULL) THEN RAISE EXCEPTION 'Select only unlinked expected individual crates for this booth'; END IF;
 INSERT INTO public.inbound_shipments(organization_id,event_id,exhibitor_id,booth_number,carrier,expected_arrival,expected_pieces,freight_type,unexpected,note,intake_key,created_by)
 VALUES(org,_event,_exhibitor,booth,trim(coalesce(_carrier,'')),_arrival,CASE WHEN _unexpected THEN 0 ELSE _count END,_type,_unexpected,coalesce(_note,''),_key,auth.uid()) RETURNING id INTO sid;
 UPDATE public.freight_items SET inbound_shipment_id=sid WHERE id=ANY(_existing);
 IF NOT _unexpected THEN
 INSERT INTO public.freight_items(event_id,exhibitor_id,booth_number,freight_type,description,pieces,weight_lbs,arrival_status,inbound_shipment_id)
 SELECT _event,_exhibitor,booth,_type,'Inbound '||_type::text||' '||i,1,0,'expected',sid FROM generate_series(linked+1,_count) i;
 END IF;
 RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.register_inbound_shipment(uuid,uuid,text,date,integer,public.freight_type,text,boolean,uuid[],uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_inbound_shipment(uuid,uuid,text,date,integer,public.freight_type,text,boolean,uuid[],uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.attach_inbound_document(_shipment uuid,_path text,_filename text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.inbound_shipments;
BEGIN
 SELECT * INTO s FROM public.inbound_shipments WHERE id=_shipment;
 IF auth.uid() IS NULL OR s.id IS NULL OR NOT(public.is_org_staff(s.organization_id) OR EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role='exhibitor' AND r.organization_id=s.organization_id AND r.exhibitor_id=s.exhibitor_id AND (r.event_id IS NULL OR r.event_id=s.event_id))) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF _path NOT LIKE s.organization_id::text||'/'||s.event_id::text||'/'||s.id::text||'/%' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='bol-documents' AND name=_path) THEN RAISE EXCEPTION 'Upload the shipment document first'; END IF;
 UPDATE public.inbound_shipments SET storage_path=_path,original_filename=_filename WHERE id=s.id;
END $$;
REVOKE ALL ON FUNCTION public.attach_inbound_document(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_inbound_document(uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.can_upload_inbound_bol(_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.inbound_shipments s JOIN public.user_roles r ON r.organization_id=s.organization_id AND r.exhibitor_id=s.exhibitor_id WHERE r.user_id=auth.uid() AND r.role='exhibitor' AND (r.event_id IS NULL OR r.event_id=s.event_id) AND _name LIKE s.organization_id::text||'/'||s.event_id::text||'/'||s.id::text||'/%');
$$;
REVOKE ALL ON FUNCTION public.can_upload_inbound_bol(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_upload_inbound_bol(text) TO authenticated;
CREATE POLICY "Exhibitors upload own expected BOL" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='bol-documents' AND public.can_upload_inbound_bol(name));
CREATE OR REPLACE FUNCTION public.receive_inbound_shipment(_shipment uuid,_pieces jsonb,_extra integer,_note text,_path text,_filename text,_key uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.inbound_shipments; rid uuid; c record; fid uuid; n integer;
BEGIN
 SELECT * INTO s FROM public.inbound_shipments WHERE id=_shipment;
 IF auth.uid() IS NULL OR s.id IS NULL OR NOT public.is_org_staff(s.organization_id) THEN RAISE EXCEPTION 'Not authorized to receive this shipment'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(s.event_id::text,0));
 IF _key IS NULL THEN RAISE EXCEPTION 'Intake key is required'; END IF;
 SELECT id INTO rid FROM public.inbound_receipts WHERE intake_key=_key AND shipment_id=s.id;
 IF rid IS NOT NULL THEN RETURN rid; END IF;
 IF jsonb_typeof(_pieces)<>'array' OR _extra IS NULL OR _extra<0 OR _extra>1000 OR length(coalesce(_note,''))>4000 THEN RAISE EXCEPTION 'Invalid arrival details'; END IF;
 n:=jsonb_array_length(_pieces);
 IF n+_extra<1 OR n+_extra>1000 THEN RAISE EXCEPTION 'Receive between 1 and 1000 pieces'; END IF;
 IF n<>(SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(_pieces)) THEN RAISE EXCEPTION 'Duplicate crate selections'; END IF;
 IF nullif(_path,'') IS NOT NULL AND (_path NOT LIKE s.organization_id::text||'/'||s.event_id::text||'/'||s.id::text||'/%' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='bol-documents' AND name=_path)) THEN RAISE EXCEPTION 'Upload the shipment document first'; END IF;
 INSERT INTO public.inbound_receipts(organization_id,shipment_id,intake_key,received_count,note,storage_path,original_filename,received_by) VALUES(s.organization_id,s.id,_key,n+_extra,coalesce(_note,''),nullif(_path,''),nullif(_filename,''),auth.uid()) RETURNING id INTO rid;
 FOR c IN SELECT value FROM jsonb_array_elements(_pieces) LOOP
 IF NOT EXISTS(SELECT 1 FROM public.freight_items WHERE id=(c.value->>'id')::uuid AND inbound_shipment_id=s.id AND arrival_status='expected') THEN RAISE EXCEPTION 'Crate already received or belongs to another shipment'; END IF;
 IF coalesce(nullif(c.value->>'weight','')::numeric,0)<0 OR coalesce(nullif(c.value->>'weight','')::numeric,0)::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid crate weight'; END IF;
 UPDATE public.freight_items SET arrival_status='received',weight_lbs=coalesce(nullif(c.value->>'weight','')::numeric,weight_lbs) WHERE id=(c.value->>'id')::uuid;
 IF coalesce((c.value->>'damaged')::boolean,false) THEN INSERT INTO public.freight_issues(organization_id,event_id,freight_id,kind,note,created_by) VALUES(s.organization_id,s.event_id,(c.value->>'id')::uuid,'damaged',coalesce(_note,''),auth.uid()); END IF;
 END LOOP;
 FOR i IN 1.._extra LOOP
 INSERT INTO public.freight_items(event_id,exhibitor_id,booth_number,freight_type,description,pieces,weight_lbs,arrival_status,inbound_shipment_id,inbound_extra)
 VALUES(s.event_id,s.exhibitor_id,s.booth_number,s.freight_type,CASE WHEN s.unexpected THEN 'Unexpected arrival ' ELSE 'Additional crate ' END||i,1,0,'received',s.id,true) RETURNING id INTO fid;
 END LOOP;
 RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.receive_inbound_shipment(uuid,jsonb,integer,text,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_inbound_shipment(uuid,jsonb,integer,text,text,text,uuid) TO authenticated;