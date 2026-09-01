# R3U WAA — Worker's Attendance App

> **This file predates the Payroll module, multi-tenant retrofit, and
> Platform Owner role and is out of date in several places (the auth
> table, the screen map, and the "deliberately out of scope" list below
> all still describe an earlier version of the app).** The `CLAUDE.md`
> file one level up is the maintained, current source of truth — read
> that first for anything that matters. This file has been patched for
> the specific inaccuracies known as of 2026-09-01, not fully rewritten.

Expo (React Native, TypeScript, managed workflow) mobile app for tracking
attendance of project-based construction workers. Four roles in one codebase
now — **Worker**, **Supervisor**, **HR/Admin**, and **Platform Owner** —
resolved at login from which table the authenticated user matches.

Backend is the live Supabase project `r3u-module`
(`ilrkesemyyzgnrstofhq`). All of this app's tables are `waa_`-prefixed — the
same database also hosts an unrelated, already-live regular-employee HRIS, and
nothing here reads or writes those tables.

## Running it

```bash
cd app
npm install
npx expo start
```

Then press `a` for Android, `i` for iOS, or scan the QR code with Expo Go.

> **Use a physical device or a dev build for the full flow.** Time punches
> require a camera, GPS, and enrolled device biometrics/passcode. Simulators
> without an enrolled fingerprint will block the punch at the confirmation step
> — that's the intended fraud-prevention behavior, not a bug.

Other commands:

```bash
npm run typecheck      # tsc --noEmit
npx expo start -c      # start with a cleared Metro cache (after .env changes)
```

## Environment

Copy `.env.example` to `.env` and fill in the two values:

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon publishable key>
```

`.env` is gitignored; `.env.example` is committed. The `EXPO_PUBLIC_` prefix is
what makes Expo inline the values into the client bundle. Shipping the anon key
in the client is by design — **Row Level Security is the real authorization
gate**, and every query in this app runs as the signed-in user.

Metro reads `.env` at startup, so restart with `npx expo start -c` after editing it.

`.npmrc` pins `legacy-peer-deps=true`. The Expo SDK 57 scaffold pins
`react@19.2.3` while a transitive `react-dom@19.2.8` asks for `^19.2.8`; without
that flag `npm install` fails on the peer conflict.

## Auth

One login form, no role switcher. The person types one identifier and a
password; `login.tsx` posts both to the **`waa-resolve-login`** edge function,
which works out server-side which identity it belongs to and returns either a
session (applied with `supabase.auth.setSession`) or one generic error. The root
guard then routes by role. Nothing about the role is inferred client-side, and a
failed attempt never reveals which role's table it almost matched.

| Role | Identifier | Resolved server-side as |
|---|---|---|
| Worker | phone + password | `digitsOnly(phone) + '@workers.waa.r3u.local'` |
| Supervisor | phone + password | `digitsOnly(phone) + '@supervisors.waa.r3u.local'` |
| HR/Admin | generated login code (e.g. `HR-521031`) + password | `loginCode.toLowerCase() + '@hradmins.waa.r3u.local'` — **no longer email**, superseded by `COMPANY-CREATION-HR-PROVISIONING-ADDENDUM.md` |
| Platform Owner | real email + password | the address as typed — the one role still email-based |

Newly-created accounts (any of the four roles) carry
`must_change_password = true` and are routed to `/change-password`
before anything else; a newly-provisioned HR/Admin additionally routes
to `/complete-profile` (name/email/phone) before reaching `/(hr)`.

Phone numbers are unique across Worker and Supervisor: both registration edge
functions claim a `waa_phone_identities` reservation, so the same digits cannot
be registered twice under different roles.

Worker accounts are created **only** by a supervisor through the
`waa-register-worker` edge function, which runs server-side with the service
role: it creates the Auth account, generates the temp password, and inserts the
worker + primary assignment rows. The returned password is shown to the
supervisor once, in a modal they must dismiss deliberately — it is not
retrievable afterward.

There is no supervisor *self*-registration screen, by design — but Supervisor
accounts are now created in-app by HR/Admin (`waa-register-supervisor`), not
"provisioned outside the app" as this used to say before HR/Admin's mobile
scope existed.

## Layout

```
app/                      expo-router routes (file = screen)
  _layout.tsx             fonts + SessionProvider + auth/role guard
  login.tsx               one identifier + password form -> waa-resolve-login
  change-password.tsx     forced reset for any account with must_change_password
  complete-profile.tsx    HR/Admin-only, after password reset, before /(hr)
  notifications.tsx       realtime tray, shared by Worker and Supervisor
  (platform-owner)/
    index.tsx             3 sections: create company, reset HR/Admin password,
                           suspend/reactivate — all via waa-platform-owner-*
                           edge functions, zero direct table access
  (worker)/
    (tabs)/               Home · Activity · Pay · Profile
    punch.tsx             selfie -> GPS -> biometric -> insert
    onboarding.tsx        profile completion
    cash-advance.tsx      request + history + receipt attach
    leave.tsx             type/date-range/reason + history
    contract.tsx          read-only PDF viewer
  (supervisor)/
    (tabs)/               Home · Approvals · Roster · Profile
    register-worker.tsx   edge function + one-time credentials modal
    worker/[id].tsx       worker detail + contract upload
  (hr)/
    (tabs)/               Advances · Separations · Proofs · Alerts · Profile
                          — the three emergency-approval actions only, each
                          backed by a waa-hr-mobile-* edge function
    payroll-grid.tsx      ORPHANED — full grid, web-dashboard surface
    roster.tsx            ORPHANED
    separations-full.tsx  ORPHANED
    settings.tsx          ORPHANED — payroll settings are web-only
    register-supervisor.tsx  ORPHANED
    cash-advances.tsx     ORPHANED — full ledger
    worker/[id].tsx       ORPHANED — full worker detail/editing
src/
  theme.ts                design tokens from the HTML mockup
  lib/                    supabase client, queries, storage, capture, session
  components/             UI kit, icons, tab bar, approval cards
```

## How the pieces work

**Storage.** All four buckets (`waa-selfies`, `waa-ids`, `waa-contracts`,
`waa-receipts`) are private and use the `{worker_id}/{filename}` path
convention. The database columns store the *object path*, not a URL; images are
displayed by minting a 1-hour signed URL at render time (`SignedImage`).
Uploads read the local file as an `ArrayBuffer` via `expo-file-system`'s `File`
class — `fetch('file://…')` is unreliable on Android.

**Notifications.** `waa_notifications` rows are written exclusively by database
triggers (new pending punch/request → notify supervisor; approve/decline →
notify worker). The client only ever SELECTs and flips `is_read`; it never
inserts. The tray subscribes over Realtime, so a supervisor's approval reaches
the worker's device without a refresh.

**Time punches.** The selfie and GPS fix are gathered first, but nothing is
written until `expo-local-authentication` succeeds. This is device-level
confirmation (fingerprint / Face ID / passcode) that the handset owner is
present — deliberately *not* a face match against the stored `face_scan_url`.

**GPS is informational only.** Coordinates are captured and shown to the
supervisor as text during approval. There is no geofence check and no distance
rule that can block a punch — that's the intended behavior per the brief. A
denied location permission degrades to "no coordinates" rather than failing.

**Profile status.** `waa_workers.status` is derived, never set by hand: it flips
to `complete` only once both `face_scan_url` and `valid_id_url` are present.

**Contracts are read-only for workers.** Upload lives on the supervisor's worker
detail screen. The worker side renders the PDF through a signed URL and offers
no reupload control. Android's WebView has no PDF renderer, so it goes through
Google's viewer there; iOS renders natively.

## Deliberately out of scope

> **Payroll computation is no longer out of scope** — the Payroll module
> (see `CLAUDE.md`) added real gross/deduction/net calculation via
> `waa-generate-payroll-run`. This section is otherwise still accurate.

Regular-employee/HRIS functionality, an HR-level approval layer above the
supervisor, and geofence enforcement that blocks a punch. Supervisor
self-registration stays out of scope for the *app UI*, but Supervisor
accounts are now created in-app by HR/Admin via `waa-register-supervisor` —
"provisioned outside the app" below refers to the original design, not the
current one.

## Test data

The live database was seeded with one test supervisor and one test worker while
verifying this build end-to-end. See the handover notes for the credentials and
the SQL to remove them.
