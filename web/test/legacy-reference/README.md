# Frozen copy of the original dashboard (test reference only)

The design-parity tests in `web/test` compare the new UI with the original Lead to Doctor dashboard
(tokens, CSS, fonts, navigation and icons). The original lives in a separate repository
(`leadtodoctor/lead-to-doctor`), which CI does not have, so the files those tests read are copied here.

- Copied from `lead-to-doctor` at commit `6a8b1dd` on 2026-11-03: `backend/public/index.html`,
  `backend/public/app.js`, `backend/public/fonts/*.woff2` and `DESIGN.md`.
- Used only by the tests (`test/legacy.ts`): never served, never shipped (excluded in `.dockerignore`).
- Do not edit. When the original folder sits beside `saas-crm/`, the tests read it instead and
  `legacy-reference.test.ts` fails if this copy differs, so a stale copy is caught. Refresh by copying the
  same four paths again.
