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
- Forklift time is tracked in `work_sessions` (one open session per ticket+forklift, hourly rate copied at start); all session/scan changes go through security-definer RPCs (`op_start_session`, `op_scan_freight`, pause/resume/complete, `staff_correct_scan`) and per-item pickup/delivery lives on `ticket_freight`. Extra operators join a ticket via `ticket_crew`. Why: no duplicate sessions or double scans, historical rates preserved, auditable.
- `tickets` has multiple paths to `operators`/`equipment`; embeds must name the FK (`operators!tickets_assigned_operator_id_fkey`). Why: PostgREST rejects ambiguous embeds.
- Forklift Mode sign-in: operators registered per event (`event_operators`) unlock a shared tablet with a 6-digit PIN via `forklift_unlock` (bcrypt in `operator_pins`, no client grants, 5-try lockout); the unlock (`operator_unlocks`, one per account, 12h) feeds `user_operator_ids()` so existing operator RPCs/RLS apply. Why: shared devices without per-driver logins.
