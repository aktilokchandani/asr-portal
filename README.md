# Active Staffing Resources — Demo Platform

A working demo built around ASR's actual business model: a **staffing** division (Temporary, Temporary-to-Hire, Direct Hire/Search, and RPO/Unbundled Services) that places candidates with client companies across Pennsylvania, New Jersey, and Delaware, plus a separate **Outsourced Bookkeeping Advisory Services** division that runs the client's books directly as an ongoing monthly service. Candidates and client companies never interact directly or see each other's contact details — every match runs through ASR.

## What's included

**Public marketing site** (no login required):
- `/` — Home
- `/about.html` — About ASR, leadership, ~24 years in business, and the PA/NJ/DE service area
- `/services.html` — Five services: Temporary, Temporary-to-Hire, Direct Hire/Search, Outsourced Bookkeeping Advisory Services, and RPO (Recruitment Process Outsourcing) / Unbundled Services
- `/employers.html` — For employers, with a "Request Talent" lead form and testimonials from client companies
- `/job-seekers.html` — For job seekers: an "Apply instant" quick-apply form, dynamic Open Roles pulled from the job board, and candidate testimonials
- `/blogs.html` — Hiring and career insight articles
- `/jobs.html` — Public job board (client identity stays anonymized — "Confidential client — [industry]" — until a candidate is actually placed)
- `/contact.html` — General contact form
- `/register.html` — **Candidate self-registration** (creates a private profile, held as `pending_review` until an ASR recruiter approves it)
- `/login.html` — Shared login for all three portals

**Internal portals** (after login):
- `/agency.html` — ASR admin: overview dashboard, candidate directory (approve self-registered profiles), applications review (shortlist/reject/place), client job requests, **placements** (staffing division), **advisory engagements** (bookkeeping division), billing/invoicing across both divisions, employer leads (tagged staffing vs. advisory)
- `/client.html` — Client company: post job requests, view placements (candidate name/skills only — **no** internal candidate pay rate or ASR's markup, only the final billed rate), view advisory engagements ASR is running for them, view and pay invoices
- `/candidate.html` — Candidate: private profile, application history, active placements

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Agency Admin — Joseph Vernachio, Managing Partner | joseph@activestaffingresources.com | admin123 |
| Client — Dianne Torres, Office Manager, Rivermark Consulting (Yardley, PA) | dianne.torres@rivermarkconsulting.com | client123 |
| Client — James Kowalski, Director of Operations, Westbridge Builders (New Britain, PA) | james.kowalski@westbridgebuilders.com | client123 |
| Candidate — Laura Petrocelli, Bookkeeper (Doylestown, PA) | laura.petrocelli@gmail.com | cand123 |
| Candidate — Robert Hannigan, Controller (Doylestown, PA) | robert.hannigan@gmail.com | cand123 |

Or register a brand-new candidate at `/register.html` — it sits as "pending review" until the agency admin approves it from the Candidates tab.

## How the business model maps to the app

**Division 1 — Staffing (Temporary / Temporary-to-Hire / Direct Hire / RPO)**
```
Candidate registers publicly  →  profile is PRIVATE, status "pending_review"
        ↓
Agency reviews & approves     →  status becomes "available"
        ↓
Client company posts a job request (agency-only visibility of full detail)
        ↓
Candidate applies via the public, anonymized job board — or ASR sources directly
        ↓
Agency creates a "placement": candidate's pay rate + agency markup % = rate billed to client
        ↓
Agency issues an invoice to the client for the period worked → client pays
```

**Division 2 — Outsourced Bookkeeping Advisory Services**
```
Client signs up for ongoing service instead of a new hire (bookkeeping, payroll, fractional
controller, or fractional CFO advisory) — via the "Request Talent" form, the job seekers page's
quick-apply flow, or directly by phone
        ↓
Agency sets up an "engagement": service type, scope, optional candidate from the pool who
delivers the work, and a flat monthly fee
        ↓
Agency issues a monthly invoice against the engagement → client pays
```

Both divisions share the same candidate pool, invoicing system, and client accounts — a client can have staffing placements *and* an advisory engagement at once.

Privacy rules enforced by the server (not just hidden in the UI):
- `GET /api/candidates` returns the full directory to agency staff only; a candidate sees only their own record; a client gets a 403.
- A client's view of a placement includes the candidate's name/title/skills but **never** email, phone, or the raw rate paid to the candidate — only the final billed rate.
- The public job board never reveals which company posted a role until the candidate is actually placed there.

## Running it

No external npm packages are used — this build environment didn't have npm registry access, so the whole backend runs on Node's built-in `http` module. That means it runs anywhere with just:

```bash
node server.js
```

Then open **http://localhost:3000**.

Data is stored in a local `data.json` file (created from seed data on first run). Delete it and restart the server to reset the demo.

## Tech stack

- Backend: Node.js core `http` module (no framework)
- "Database": a JSON file (`data.json`) — swap for Postgres/MySQL for production
- Frontend: plain HTML/CSS/JS, no build step, no frameworks
- Auth: cookie-based session (demo-level — plaintext passwords, in-memory sessions; production needs hashed passwords via bcrypt and a persistent session store)
- Brand: navy/blue/slate palette matching the ASR logo concepts, with the "Bridge Mark" (the two-figures-meeting mark) used as the header/sidebar icon throughout
- Footer: P.O. Box 5049, New Britain, PA 18901 · 267-429-6599 · office@activestaffingresources.com

## Pushing to GitHub

This folder is already a git repository with one commit. To publish it:

```bash
cd active-staffing-resources-portal
git remote add origin <your-empty-repo-url>
git push -u origin main
```

## Production checklist

- Hash passwords (bcrypt) and use a real session store
- Move to Postgres/MySQL with proper migrations
- Resume upload + parsing, document/ID verification for candidates
- Email/SMS notifications (application received, shortlisted, invoice issued)
- Background checks integration
- Recurring/auto-billing for advisory engagements (currently invoiced manually each period)
- Role-based permissions, audit logs, and rate limiting on public endpoints (register, contact, applications)
