# Archive — spec-only code retired in Phase 1 (Nov 1, 2026)

Approved by the user ("Approve archive") after the plan in `docs/rebuild/` (decisions C-2, C-5, D-02).
**Nothing was deleted.** Files were moved with their original relative paths, so every one can be put back with a plain `mv`.
No database table was dropped and no migration was written: this is a code move only (see "What stays" below).

## Why
The generated SaaS spec invented a CRM model the original product does not have (plan sales, lead items, per-lead
call-center assignments, a generic leads/contacts/calls CRUD API, a generic Google Sheets importer) and a prototype UI
for it. The rebuild reproduces the original product (doctors, campaigns, leads, claiming, call results, bookings…).
Keeping the invented API alive would leave a second, wrong set of rules and routes next to the real ones.

## What is here

### `backend/src/modules/<module>/…` (40 files: controllers, services, DTOs, module files, unit specs)
`leads`, `lead-contacts`, `lead-items`, `lead-item-call-centers`, `plan-sales`, `calls`, `google-sheets`.
Their HTTP routes (`/api/leads`, `/api/lead-contacts`, `/api/lead-items`, `/api/lead-item-call-centers`,
`/api/plan-sales`, `/api/calls`, `/api/google-sheets`) no longer exist.

### `backend/test/e2e/` and `backend/test/jest-e2e.json`
The generated scenario suite for those modules (scenarios A–I) and its harness. It was never run in this rebuild, needed its own
`.env.test`/database, and exercised only the archived model. The `test:e2e` npm script was removed; the real suite is `npm run test:tenant`.

### `backend/test/tenant-originals/`
Full copies of the five integration specs **as they were before** they were edited to stop depending on the archived routes:
`entitlements`, `tenant-isolation`, `foundation`, `mobile-auth`, `web-auth`. Use them to see exactly which cases were removed or ported:
- entitlement matrix: same 72 cases, probed through `/services` and `/api/mobile/leads` instead of `/leads`, `/lead-contacts`, `/calls`;
- tenant isolation: cases about leads / contacts / calls / plan sales / lead items / assignments removed (lead data is covered by the mobile suites'
  cross-company tests); the remaining probes use `/services`, `/subscriptions`, `/payments`, `/users`, `/companies`, `/mobile/leads`; two cross-tenant
  foreign-key cases on memberships and users were added;
- foundation: the two API cases for `/lead-contacts` (409 on a duplicate) and the sheet import were removed (the database-level duplicate rules stay tested).

### `frontend/`
The prototype Next.js app (`saas-crm/frontend`, 18 invented pages, Tailwind). Replaced by `saas-crm/web/` (port 3001 in Docker, 3002 in dev).
It includes its own `node_modules`, `.next` build output and `.env` (placeholders only). `saas-crm/docker-compose.yml` now builds `./web` for the
`frontend` service; the running `saas-frontend` container was **not** touched and keeps serving the old image until you rebuild.

## What stays in `backend/` on purpose
The **entity files** of these modules (`src/modules/{leads,lead-contacts,lead-items,lead-item-call-centers,plan-sales,calls}/entities/`) and their tables.
They are still registered in `AppModule` because:
- `Lead` and `LeadContact` are used by the mobile facade (`/api/mobile`), the call log, call results and the seed;
- the entities reference each other (and `Call`, `PlanSales`, `LeadItem`, `LeadItemCallCenter`), so removing one changes foreign keys;
- dropping tables is a destructive migration, which is not allowed without a separate approval.
Phase 2 replaces them: the new schema (clinics, leads, phones, call results…) arrives with an import tool and a reviewed migration that retires the old tables.

## Restore (exact, per item)
```bash
cd "<repo>/saas-crm"
# a backend module, e.g. calls:
cp -R archive/2026-11-01-phase1-spec-only/backend/src/modules/calls/. backend/src/modules/calls/
# then re-add CallsModule to backend/src/app.module.ts
# the prototype frontend:
mv archive/2026-11-01-phase1-spec-only/frontend ./frontend    # and point docker-compose.yml back at ./frontend
```
