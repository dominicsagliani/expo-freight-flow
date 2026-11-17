# ExpoHaul

PROJECT: DRAYFLOW

PRODUCT: B2B MATERIAL HANDLING SAAS

Build a production-oriented MVP web application named DrayFlow.

TAGLINE:

The operating system for material handling.

BUSINESS PURPOSE:

DrayFlow digitizes forklift ticketing, freight identification, dispatch, service completion, and billing for trade shows, convention centers, and exhibition contractors.

DESIGN:

- Premium enterprise SaaS appearance.

- Navy, white, and teal color palette.

- Clean typography and modern interface.

- Responsive desktop, tablet, and mobile layouts.

- Persistent left sidebar on desktop.

- Professional logistics software aesthetic.

- Avoid generic templates and unnecessary animations.

MAIN NAVIGATION:

1. Overview

2. Events

3. Exhibitors

4. Freight Management

5. Material Handling Tickets

6. Dispatch

7. Operators

8. Billing & Reports

9. Settings

USER ROLES:

SUPER ADMIN:

Manage the software platform and customer organizations.

COMPANY ADMIN:

Manage their company's events, users, rates, and operations.

DISPATCHER:

Create tickets, assign forklift operators, monitor jobs, and update requests.

FORKLIFT OPERATOR:

View assignments, scan freight QR codes, start jobs, and complete jobs.

EXHIBITOR:

Create service requests, register freight, track tickets, and view charges.

CORE FUNCTIONALITY:

A. EVENT MANAGEMENT

Create events with event name, location, dates, venue, and participating exhibitors.

B. EXHIBITOR MANAGEMENT

Create exhibitors with company name, contact details, booth number, and event association.

C. FREIGHT MANAGEMENT

Register individual crates and pallets.

Store:

- Unique freight ID.

- Exhibitor.

- Event.

- Booth number.

- Freight description.

- Weight.

- Dimensions.

- Arrival status.

- Storage location.

- QR code identifier.

Allow staff to generate and print QR labels for each freight item.

D. TICKET MANAGEMENT

Both exhibitors and dispatchers must be able to create tickets.

Ticket fields:

- Unique ticket number.

- Event.

- Exhibitor.

- Booth number.

- Requested service.

- Freight items attached.

- Priority.

- Destination.

- Special instructions.

- Request timestamp.

- Ticket status.

Allow multiple freight items to be attached to one ticket.

E. DISPATCH

Create a dispatch board displaying:

- Pending jobs.

- Assigned jobs.

- In-progress jobs.

- Completed jobs.

Allow dispatchers to assign available operators and equipment.

F. OPERATOR PORTAL

Create a mobile-first operator interface.

Operators can:

- View assigned jobs.

- View exhibitor and booth information.

- Scan freight QR codes.

- Confirm freight identification.

- Start a job.

- Complete a job.

- Add notes.

- Upload completion photos.

G. BILLING

Create configurable service rates.

Calculate charges based on the applicable event rate card and completed services.

Allow management to review and export billing records.

H. ACTIVITY HISTORY

Record every ticket status change, freight scan, assignment, completion timestamp, and user responsible.

TECHNOLOGY:

Use Supabase for authentication, database, and file storage.

Implement secure role-based access and database row-level security.

Ensure exhibitors can only access their own organization's information.

Ensure operators only access their assigned jobs.

Ensure company data is isolated between SaaS customers.

Use unique, non-guessable freight identifiers for QR codes.

Never expose private exhibitor information in a publicly accessible QR URL.

DEMO ENVIRONMENT:

Create fictional sample data for one trade show, five exhibitors, ten freight items, four forklift operators, and ten sample tickets.

IMPORTANT BUILD ORDER:

First build the dashboard, event management, exhibitor management, and ticket creation.

Then build freight identification and dispatch.

Then build the operator portal and billing.

Build functional database-connected features rather than static screens.

Do not implement payment processing or external enterprise integrations yet.

Do not claim a feature is operational until it has been implemented and tested.

Start with the complete application shell and dashboard.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://expo-freight-flow.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2961bf95-3d8e-5402-8d41-ae32c280c02a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
