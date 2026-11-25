# Inbound shipments — build on existing ExpoHaul

## What already exists
- Exhibitor CSV import creates expected crate records with unique freight IDs and QR codes.
- Shipments & tracking shows arrivals, booth deliveries, completed charges, and invoices, currently grouped by exhibitor rather than individual shipment.
- Receiving can check in existing labeled crates or create new freight from a BOL. Both receiving forms currently require a BOL.
- Freight search, damage reports, staging, crate history, batch labels, forklift tickets, and dispatch already exist.
- The office dashboard already counts freight on site and still expected, but does not reconcile individual shipments.

## What needs to be added or modified
### 1. Register an expected shipment
Extend the existing Shipments page with **Add expected shipment** for staff and exhibitors. Capture exhibitor, event, booth, carrier, expected arrival date, crate/pallet count and an optional BOL. Exhibitors can register only for their own assigned booths.

Keep a shipment separate from its BOL: a shipment can exist and arrive without a document, and one exhibitor can have several shipments. Reuse existing expected freight records where explicitly selected; never create a second label for the same crate. Existing imported freight stays intact and can be linked when shipment details are supplied.

### 2. Reconcile at receiving
Extend the existing receiving experience to search expected shipments by company, booth, carrier or reference. Staff can confirm a full or partial arrival, select the crates actually received, record notes and damage using the existing issue tools, and attach a BOL if available.

- Missing crates remain expected; receiving fewer crates does not reduce the original expected count.
- Additional crates get new individual freight records and are marked as extras against that shipment.
- Unregistered arrivals can be created during receiving and shown as unexpected shipments.
- Later arrivals update the same shipment without duplicating crates or labels.
- Allow receiving without a BOL; preserve the existing BOL upload and AI-review workflow when a document is provided.

### 3. Reuse QR labels and forklift work
Link every crate to its shipment while keeping its existing freight ID and QR token. Use the existing label printing, staging, ticket creation, and dispatch controls. Do not change Forklift Mode, billing timers, invoice calculations, or payment collection. Unknown weights must still prevent unsafe automatic dispatch.

### 4. Add a small inbound overview
Add an inbound section to the existing office dashboard with expected shipments, shipments with arrivals, expected versus actual crate counts, outstanding shipments and unexpected arrivals. Partial arrivals remain outstanding until their expected crates arrive.

Each shipment opens its details on the existing Shipments page: carrier, expected date, booth, received/missing/extra counts, notes, document and individual crate statuses. Derive waiting-for-delivery and delivered counts from the existing freight and ticket records, not a second tracking system.

## Technical approach
- Add a minimal company-scoped shipment record and a nullable shipment link on existing freight; retain all current records and functionality.
- Use authenticated, tenant-checked database operations for registration and receiving, with retry-safe intake keys and locked reconciliation.
- Staff manage company shipments; exhibitors read and register only their own event-linked shipments. Keep BOL documents private and preserve current document access restrictions.
- Extend the existing query options, receiving components, Shipments page and dashboard rather than adding another navigation section.
- Keep original expected counts immutable through receiving; calculate actual arrivals from linked freight and distinguish expected pieces from extras.

## Verification before completion
- Test staff and exhibitor registration, including without a BOL, and reject another company's or exhibitor's shipment access.
- Receive 2 of 3 expected crates: show 1 missing and keep the expected count at 3; receive the last crate later without new QR identities.
- Receive 4 against 3 expected: show 1 extra; verify retry does not duplicate freight.
- Register an unexpected arrival at receiving and verify the dashboard and clickable details.
- Confirm a received crate is usable by the existing ticket/dispatch flow and its delivered state appears on shipment details.
- Check existing import, label, issue, receiving and invoice tests plus desktop/mobile layouts.

No application or database changes have been made yet; this plan preserves the existing design and workflows.