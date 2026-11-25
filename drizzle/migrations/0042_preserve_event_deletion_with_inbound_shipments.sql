ALTER TABLE public.inbound_shipments DROP CONSTRAINT inbound_shipments_event_id_fkey;
ALTER TABLE public.inbound_shipments ADD CONSTRAINT inbound_shipments_event_id_fkey FOREIGN KEY(event_id) REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE public.inbound_shipments DROP CONSTRAINT inbound_shipments_exhibitor_id_fkey;
ALTER TABLE public.inbound_shipments ADD CONSTRAINT inbound_shipments_exhibitor_id_fkey FOREIGN KEY(exhibitor_id) REFERENCES public.exhibitors(id) ON DELETE CASCADE;
ALTER TABLE public.inbound_receipts DROP CONSTRAINT inbound_receipts_shipment_id_fkey;
ALTER TABLE public.inbound_receipts ADD CONSTRAINT inbound_receipts_shipment_id_fkey FOREIGN KEY(shipment_id) REFERENCES public.inbound_shipments(id) ON DELETE CASCADE;
ALTER TABLE public.freight_items DROP CONSTRAINT freight_items_inbound_shipment_id_fkey;
ALTER TABLE public.freight_items ADD CONSTRAINT freight_items_inbound_shipment_id_fkey FOREIGN KEY(inbound_shipment_id) REFERENCES public.inbound_shipments(id) ON DELETE SET NULL;