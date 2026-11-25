CREATE OR REPLACE FUNCTION public.inbound_freight_validate() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user IN ('authenticated','anon') THEN
  IF TG_OP='INSERT' AND (NEW.inbound_shipment_id IS NOT NULL OR NEW.inbound_extra) THEN RAISE EXCEPTION 'Use shipment registration to link freight'; END IF;
  IF TG_OP='UPDATE' AND (NEW.inbound_shipment_id IS DISTINCT FROM OLD.inbound_shipment_id OR NEW.inbound_extra IS DISTINCT FROM OLD.inbound_extra) THEN RAISE EXCEPTION 'Use shipment registration to change shipment links'; END IF;
 END IF;
 IF NEW.inbound_shipment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.inbound_shipments s WHERE s.id=NEW.inbound_shipment_id AND s.organization_id=NEW.organization_id AND s.event_id=NEW.event_id AND s.exhibitor_id=NEW.exhibitor_id AND s.booth_number=NEW.booth_number) THEN RAISE EXCEPTION 'Freight must match its shipment'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.inbound_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.inbound_shipments;
BEGIN
 IF TG_TABLE_NAME='inbound_shipments' THEN
 PERFORM public.log_activity(NEW.organization_id,'inbound_registered',NULL,NULL,NEW.event_id,jsonb_build_object('shipment_id',NEW.id,'expected_pieces',NEW.expected_pieces,'unexpected',NEW.unexpected),now());
 ELSE
 SELECT * INTO s FROM public.inbound_shipments WHERE id=NEW.shipment_id;
 PERFORM public.log_activity(NEW.organization_id,'inbound_received',NULL,NULL,s.event_id,jsonb_build_object('shipment_id',s.id,'received_count',NEW.received_count),now());
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER inbound_registration_audit AFTER INSERT ON public.inbound_shipments FOR EACH ROW EXECUTE FUNCTION public.inbound_audit();
CREATE TRIGGER inbound_receiving_audit AFTER INSERT ON public.inbound_receipts FOR EACH ROW EXECUTE FUNCTION public.inbound_audit();