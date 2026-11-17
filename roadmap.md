# ExpoHaul (formerly DrayFlow) — Roadmap

## Phase 1 — Shell, dashboard, events, exhibitors, tickets
- [x] Backend: companies, roles, events, exhibitors, freight, tickets, rates, activity history + access rules
- [x] Demo data: 1 show, 5 exhibitors, 10 freight, 4 operators, 10 tickets
- [x] Sign in (email, Google, Lovable) + password reset
- [x] App shell with left sidebar, Overview dashboard
- [x] Events (list, create/edit, booth assignments)
- [x] Exhibitors (list, create/edit, event + booth)
- [x] Tickets (list, create with freight, detail + history)
- [x] Rename app to ExpoHaul with a new logo (user request)
- [x] Verify end-to-end signed in (ticket creation tested; event/exhibitor forms not yet clicked through)

## Phase 2 — Freight identification + dispatch
- [x] Freight registration, QR label generation and printing, sign-in-protected scan page
- [x] Dispatch board (pending / assigned / in progress / completed), assign operator + equipment

## Phase 3 — Operator portal + billing
- [x] Operator portal: assigned jobs list + camera QR scan
- [x] Operator portal: start/complete, notes, photos
- [x] Rate cards, charge calculation, billing review + export

## Requested
- [x] Names-only worker management, individual-device driver selection, exclusive forklift reservations and personal Forklift Mode dashboard
- [x] Add confirmed admin event deletion and reset all drivers by cancelling unfinished jobs while preserving completed billing
- [x] Scan-in starts driver timing; final scan-out stops timing, completes freight jobs and totals customer charges
- [x] Mission Control: rapid call-in tickets, event-scoped live fleet, safe next-available assignment and operator service completion
- [x] Fleet inventory with exclusive driver selection and capacity-aware automatic live queue
- [ ] Short brand launch video for LinkedIn / X / Product Hunt
- [x] Collect customer payments: plans & billing page, test-mode checkout, subscription records
      (live payments need the go-live steps in the Payments tab)

- [x] Plan entitlements, upgrades/downgrades, failed-payment grace, pilot approvals

- [x] Backend foundation: own workspace per contractor on sign-up, team invitations, assignment history, delivery updates with notes, per-item photo links

- [x] Hourly labor rates per event, dispatcher labor hours, auto charge, exhibitor billing report, admin charge adjustments
- [x] Interactive event floor plans: PDF/PNG/JPG upload per event, zoom/pan viewer, admin booth marker placement, status-colored markers, filters, booth detail panel with jobs/freight/delivery history, live refresh
- [x] Pay at time of service: contractor payment link in Settings, auto-emailed pay-now receipt on job completion, resend + mark paid on job page
- [x] Scan-to-queue: scanning freight creates/reuses its delivery job, force-dispatches the next compatible available forklift, and shows the job in that driver's personal queue
- [x] BOL receiving: private PDF/photo upload, manually verified shipment details, one BOL linked to multiple unique crates, automatic batch label printing, saved-document dashboard and reprinting
- [x] AI BOL extraction: securely read private PDFs/photos, prefill shipment and crate details for staff review, and test the real upload-to-extraction flow without auto-saving freight
