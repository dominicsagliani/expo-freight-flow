# Operator Performance & Incentives

Built inside the current app, using the jobs, scans, deliveries and drivers you already track. No new driver accounts, no copied jobs, no payroll or payment connections.

## What you'll get
1. **Performance tracking (automatic)** – calculated from real records: jobs completed, crates delivered, time to accept, time to pickup, pickup-to-delivery time, gap between jobs, on-time %, scan compliance, delivery confirmation accuracy, issue reporting, shifts worked. Canceled and reassigned jobs only count for the driver who actually did the work.
2. **100-point score** – 30 productivity / 25 scan & delivery accuracy / 20 on-time / 15 documentation / 10 reliability. Company admins can change the weights.
   - Productivity is based on crate count and job difficulty, not raw speed. Time spent on holds, pauses, dispatch waits and logged delays is left out.
   - Reporting damage, missing freight or safety issues never lowers a score. It counts toward documentation credit.
3. **Bonus programs** – Daily ($20), Weekly ($75), Event completion ($100) to start, all editable. Admins set the amount, minimum score, minimum scan compliance, minimum jobs, eligible dates, and whether approval is required.
4. **Bonus management page** (company admins) – driver, event, period, score, qualifying numbers, bonus amount, and status: Ineligible, Pending review, Approved, Rejected, Paid. It records who approved or rejected each bonus and when, plus when payment was marked made. Each bonus links to the jobs it was calculated from.
5. **Forklift Mode "My Performance" tab** – today's jobs, crates, current score, progress toward daily goal, possible bonus, approved bonuses and achievements. Large and easy to read on a phone or tablet, and only on its own tab so it doesn't distract while driving.
6. **Mission Control panel** – active drivers, completed and open work, current assignments, score trends and bonus eligibility. Dispatchers keep full control of assignments.
7. **Permanent audit history** – every score snapshot, bonus calculation, approval, rejection and paid change is kept and can't be edited.

## Technical details
- New tables: `incentive_settings` (weights, per org), `incentive_programs`, `operator_bonuses`, `bonus_audit_log`, all org-scoped with RLS. Bonuses and audit rows are written only through security-definer RPCs.
- RPCs: `operator_performance(org, event, from, to)` computed from `job_assignments`, `ticket_freight`, `work_sessions`, `work_session_pauses`, `delivery_updates`, `freight_issues`; `calculate_bonuses(program, period)` (idempotent, one bonus per operator, program and period); `review_bonus`; `mark_bonus_paid`. Admin checks use `is_org_admin`. Operators read only their own data.
- New page `/incentives`, a performance tab in Forklift Mode, and a panel on the dispatch page.
- Vitest checks for scoring weights and the rule that reported exceptions never lower a score. Includes a test with several sample drivers and real recorded job events.
- Only new tables and functions are added. No existing tables are changed.
