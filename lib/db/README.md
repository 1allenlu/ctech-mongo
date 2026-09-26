# lib/db — Person 1 (MongoDB + data)

MongoDB helpers for policies, cases, user profiles, and harness versions.
Server-side only (official `mongodb` driver, `MONGODB_URI` from env).

`lib/backend.ts` is the only file that imports from here. It needs:

- `loadCases()`, `loadPolicies()`
- `loadProfile(userId)`, `saveProfile(profile)`
- `loadHarnessHistory(userId)`, `saveHarnessVersion(userId, record)`

Exact types are the `Store` type in `lib/backend.ts` and `shared/types.ts`.
