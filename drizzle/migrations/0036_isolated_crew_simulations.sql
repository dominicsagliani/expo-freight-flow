CREATE TABLE public.crew_simulations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 event_id uuid NOT NULL REFERENCES public.events(id),
 owner_id uuid NOT NULL,
 state jsonb NOT NULL DEFAULT '{"crews":[],"jobs":[],"next":1}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(event_id, owner_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_simulations TO authenticated;
GRANT ALL ON public.crew_simulations TO service_role;
ALTER TABLE public.crew_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY crew_simulations_owner_admin ON public.crew_simulations FOR ALL TO authenticated
USING (owner_id = auth.uid() AND public.is_org_admin(organization_id))
WITH CHECK (owner_id = auth.uid() AND public.is_org_admin(organization_id) AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organization_id = crew_simulations.organization_id));