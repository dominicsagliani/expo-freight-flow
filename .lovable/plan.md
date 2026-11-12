# Finish the remaining pieces of the brief

Most of the uploaded brief is already built (events, exhibitors, freight + QR labels, tickets, operator scan, start/complete). The app keeps the ExpoHaul name. This plan covers what is still missing.

## 1. Dispatch Board
- Four columns: Pending, Assigned, In progress, Completed (today).
- Each card: ticket number, exhibitor, booth, service, priority, operator.
- Dispatchers can assign an available operator and equipment, change priority, and cancel.
- Refreshes automatically so a big office screen stays current.

## 2. Operator photos and notes
- Operators can add notes and upload completion photos on a job.
- Photos stored privately; visible only to company staff, the assigned operator, and that exhibitor.
- Photos show on the ticket detail page.

## 3. Billing & Reports
- Rate cards: a default card plus optional per-event card, with a rate per service (per 100 lbs, per piece, per hour, or flat) and a minimum charge. Admins edit them in Billing.
- Each completed ticket gets a charge amount, worked out from its event's rate card and attached freight weight/pieces, saved at completion.
- Billing page: completed tickets with charges, totals per event and per exhibitor, filters by event and date, CSV download.
- Exhibitors see only their own charges.

## 4. Dashboard additions
- Add tiles for active events, total exhibitors, completed deliveries and revenue.
- Show charge amount and completion time on ticket lists and detail.

## 5. Freight arrival time
- Record arrival date/time automatically when freight is marked received; staff can update location and status after registration.

## Technical details
- New columns: `tickets.charge_amount`, `freight_items.arrived_at`; new `ticket_photos` table + private storage bucket, all with org-scoped RLS and grants.
- Charge computed in a database function called from the completion trigger (no client-set prices).
- Dispatch assign/priority via direct updates allowed by existing staff policies; live refresh via polling.
- Tests for charge rules (per-cwt rounding, minimum charge) and dashboard revenue.

Not included: payments, invoicing integrations.
