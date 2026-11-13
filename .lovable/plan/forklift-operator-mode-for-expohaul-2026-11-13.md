# Forklift Operator Mode for ExpoHaul

Extends the existing app. Nothing is removed; the office dashboard, dispatch board, current "My Jobs & Scan" page, and sample data stay.

## What already exists (reused)
- Operators, forklifts (equipment), tickets with multiple freight items, QR codes holding only a random code
- Camera QR scanner, start/complete job actions, delivery updates and notes, private photos, assignment history, activity history
- Dispatch board where dispatchers assign and reassign jobs

## What needs to change in the database (add-only, nothing deleted)
1. **Forklift work sessions** (new): one per forklift per ticket. Records ticket, forklift, operator, start, end, pause time, hourly rate copied at start (so old rates are kept), billable amount, status. A rule blocks a second open session for the same forklift on the same ticket, so scanning pallets never creates duplicates. One forklift finishing never stops another.
2. **Pauses** (new): each pause/resume with a reason, kept as history.
3. **Freight pickup/delivery per item**: add "picked up" and "delivered" stamps plus which session did it on the existing ticket-freight link. Backend refuses a second pickup or delivery of the same item, and refuses freight that is not on the operator's job.
4. **Issues**: reuse delivery updates, adding issue types (damaged, missing, wrong booth, blocked access, equipment problem, waiting for assistance, other) and an "open/resolved" flag. Photos attach as today.
5. **Scan corrections**: only dispatchers/admins can undo a pickup or delivery; a reason is required and it is written to activity history.
6. **Ticket hours**: billable forklift hours = sum of all sessions; this feeds the existing charge calculation. Admin adjustments keep using the existing audited override.
7. **Live updates**: turn on real-time notifications for tickets, sessions, freight links and issues so the dispatch board refreshes automatically.

All rules enforced in the backend; operators only see their own company and assigned jobs.

## Screens (built in your 5 stages)
1. **Operator home (full-screen mode)**: operator name, forklift number, event, current ticket, exhibitor, booth/destination, freight assigned/picked up/delivered, live timer, next job. Big buttons: Accept Job, Scan Freight, View Freight, Complete Delivery, Pause Job, Report Issue. Tabs: Current / Next / Completed.
2. **Scan screen**: camera scanner plus a keyboard-input field ready for an external industrial scanner (these act like a keyboard). Large green success or red "wrong freight" screen.
3. **Timers**: first pickup starts this forklift's session; pause/resume with reason buttons; completing stops only this forklift.
4. **Delivery confirmation**: scan, confirm booth, photo, note, flag damaged/missing, mark delivered. **Report issue** screen with the 7 large buttons, optional photo and note.
5. **Dispatch board**: new "Active forklifts" strip (operator, ticket, exhibitor, booth, session status, elapsed time, pickup/delivery progress), open issues list, completed jobs, auto-refreshing.

Design: navy/charcoal/white/teal, large touch targets, high contrast, no animations, tablet-first.

## Not included / to note
- No payroll clock-in/out.
- No real industrial scanner hookup yet, only the keyboard-input field it would use.
- Dispatcher notifications appear on the office dashboard; no text/email alerts.
- Sample sessions and issues added for testing.
