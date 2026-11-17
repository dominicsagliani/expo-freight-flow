<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules (ExpoHaul)
- Event deletion and company driver reset use admin-verified locked RPCs: reset cancels unfinished work and releases reservations but keeps completed billing. Why: no silent charges or orphaned work.
- Call-in intake is an idempotent staff RPC that creates and dispatches atomically; load requests need known safe weight. Why: no duplicate or unsafe jobs.

- Fleet reservations and auto-dispatch use authenticated database RPCs with event locks, exclusive operator/machine reservations and short heartbeats; only registered online drivers receive compatible known-weight tickets. Why: prevents duplicate assignments and unsafe or cross-event routing; assignment never starts billable time.

- Multi-tenant: every business table carries `organization_id`; access is enforced by RLS through security-definer helpers (`is_org_staff`, `is_org_admin`, `user_exhibitor_ids`, `user_operator_ids`, `can_view_ticket`). Why: company, exhibitor, and operator isolation must hold even if the UI is bypassed.
- Roles live only in `public.user_roles` (role + optional exhibitor_id / operator_id link), never on profiles. Why: prevents privilege escalation.
- `organization_id`, ticket numbers, freight codes, and QR tokens are set by BEFORE triggers from the parent event; clients never choose them. Why: tenant and identifier integrity.
- Activity history is written only by database triggers via `log_activity` (no client insert grant). Why: an audit trail users cannot forge.
- QR codes encode only the random `qr_token`; resolving it requires sign-in and RLS. Why: no private exhibitor data in public URLs.
- App pages live under `src/routes/_authenticated/` (client-only gate, `ssr: false`) and read data with the browser client + RLS via `src/lib/queries.ts` queryOptions and route loaders. Why: session lives in browser storage.
- Subscription state lives only in `public.subscriptions`, written by the payments webhook with the service role; the app reads it through RLS and keys plan access off the human-readable `price_id`, never the provider's product id. Why: provider product ids differ between test and live, so gating on them breaks after publish.
- New accounts get only a profile; company membership comes from `create_my_organization` (new isolated workspace, caller becomes company admin) or `accept_my_invitations` (matches confirmed email). Why: each contractor's workspace must stay isolated.
- Plan access is enforced in the database: `org_entitlement(org)` derives plan/event limit from `subscriptions` + `pilot_grants`, and `zz_plan_gate` BEFORE INSERT triggers block new records without access (super admins bypass). Plan changes go through `changePlan` (upgrades immediate, downgrades via subscription schedule with pending fields in subscription metadata). Why: UI checks can be bypassed; one subscription per company.
- Assignment history (`job_assignments`) is written only by a tickets trigger; delivery updates/notes (`delivery_updates`) are inserted by ticket workers and logged to activity by trigger. Why: auditable, unforgeable job trail.
- Ticket charges are computed in the DB (`calc_ticket_charge`, tickets charge trigger): staff-entered `labor_hours` drive hourly rates; only company admins may override `charge_amount`, a reason is required, `calculated_charge` keeps the system value, and overrides stay locked until reset. Why: billing can't be forged from the client.
- Forklift time is tracked in `work_sessions` (one open session per ticket+forklift, hourly rate copied at start); freight scan-in starts timing and the final outstanding scan-out for that session stops it atomically, with job completion and charges after all freight and sessions finish. Scan charges use captured session rates, not manual labor hours; no-freight call-ins retain explicit start/complete. Extra operators join via `ticket_crew`; changes use authenticated RPCs. Why: scans bound billable work, concurrent drivers remain independent, and retries cannot duplicate billing.
- `tickets` has multiple paths to `operators`/`equipment`; embeds must name the FK (`operators!tickets_assigned_operator_id_fkey`). Why: PostgREST rejects ambiguous embeds.
- Forklift Mode selects a named worker and machine through authenticated `driver_go_online`; company staff/operator membership is required, queue reservations enforce one worker per machine, and names are identification rather than authentication. Worker removal uses admin-verified `manage_worker` and soft retirement to preserve job/billing history. Why: individual devices need tenant-safe access and exclusive reservations without PINs.
- Interactive floor plans live in `floor_plans` + `booth_markers` (org id set by BEFORE triggers from the parent event/plan, files in the private `floor-plans` storage bucket with org-prefixed paths); markers store percentage coordinates and booth status is derived in the UI from the exhibitor's tickets plus unresolved issue reports. Why: plans stay tenant-isolated, markers keep position at any zoom, and the map never stores a status that can go stale.
- Pay-at-service: on job completion the client calls the authenticated `sendServiceInvoice` server fn, which emails the exhibitor a receipt linking to the contractor's own payment link (`organizations.payment_link_url`); paid state is staff-set via `mark_ticket_paid`. Why: exhibitor money never passes through ExpoHaul and receipts dedupe per ticket.
- AI BOL extraction renders documents to JPEGs in the browser and uses a staff-checked server function; AI only prefills fields. Why: extraction never auto-creates freight.
- Venue/organizer roles are event-scoped and read only via security-definer RPCs, never tables. Why: no charges/contacts exposed.
- Holds change only via `set_ticket_hold`; dispatch skips held jobs; crews are driver+forklift pairs, max 3 forklifts. Why: safe, unforgeable holds.
