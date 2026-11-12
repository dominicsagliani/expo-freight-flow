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
- Signup trigger adds every new account to the demo company as company admin. Why: demo environment; replace with invites before real customers.
- Plan access is enforced in the database: `org_entitlement(org)` derives plan/event limit from `subscriptions` + `pilot_grants`, and `zz_plan_gate` BEFORE INSERT triggers block new records without access (super admins bypass). Plan changes go through `changePlan` (upgrades immediate, downgrades via subscription schedule with pending fields in subscription metadata). Why: UI checks can be bypassed; one subscription per company.
