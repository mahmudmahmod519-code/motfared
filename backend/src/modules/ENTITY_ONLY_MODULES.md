# Entity-only module folders

`leads`, `lead-contacts`, `lead-items`, `lead-item-call-centers`, `plan-sales` and `calls` contain **only `entities/`** since Phase 1.
Their controllers, services and DTOs were archived (see `saas-crm/archive/2026-11-01-phase1-spec-only/README.md`).
The entities stay because the mobile facade, call log, call results and seed use `Lead` / `LeadContact`, the entities reference one another,
and dropping tables needs a destructive migration with its own approval. Phase 2 replaces this model.
Do not add new code here.
