# Northwind Internal Tools

**What this is:** an internal operations platform for a fintech company — one Next.js app that hosts
several back-office tools behind a shared shell, authorization layer and audit log. Three tools ship
today, with a dashboard over them and one audit log beneath them:

- **Operations dashboard** (`/`) — the state of the platform at a glance: open queue and its aging
  against the review SLA, throughput, risk mix, production rollout posture and recent activity, all
  derived from the live stores.
- **KYC Review Queue** (`/kyc`) — work through customer identity-verification cases and approve,
  reject or escalate them, under compliance rules (reasons required, high-risk cases must be
  escalated first, the escalator cannot make the final decision).
- **Refund Operations** (`/refunds`) — decide customer refund requests, under a financial control
  that sends anything at or above $500 to an Admin.
- **Feature Flag Admin** (`/flags`) — enable/disable flags and change rollout percentages per
  environment, with confirmation before every production change.
- **Audit Log** (`/audit`) — every sensitive action from all three tools in one chronological,
  append-only table: who, what, which resource, what changed, when, and why.

The point of the codebase is the shared platform underneath the tools — the app shell, the
permission registry, the audit primitive and the mutation pattern. Refund Operations, the third
tool, is a `lib/refunds/` module, two routes and three components: no shared primitive changed for
it beyond three permissions and two audit action codes.

**How to run it:**

```bash
npm install
npm run dev      # http://localhost:3000
```

Requires Node 18.17+. No database, no environment variables, no external services — every tool seeds
themselves deterministically in memory on first access, so the app is fully usable straight after
`npm run dev`. State resets when the process restarts.

Once it is running, use the two selectors in the top header to explore: **Demo user** (who is
acting) and **View as** (which role's permissions to simulate). They are independent — e.g. Maya
Chen viewing as Reviewer. There is no login; this is a prototype.

Press `⌘K` anywhere for the command palette, which searches pages, KYC cases, refunds and flags; `/` focuses
the search field on pages that have one (and opens the palette elsewhere); `g` then `d`/`k`/`r`/`f`/`a`
jumps straight to a section. The interface is dark by default; the header toggle switches to the
light theme and the choice is remembered.

Other commands:

```bash
npm test         # vitest: domain, service and component tests
npm run lint
npm run typecheck
npm run build
```

All four run on every pull request via `.github/workflows/ci.yml`.

## Roles and permissions

Authorization is a single shared layer (`lib/auth/rbac.ts`): tools declare permissions, roles are
granted sets of them, and services call `assertPermission` before any state change.

| Permission | Reviewer | Engineer | Admin |
| --- | --- | --- | --- |
| `kyc:view` | ✓ | ✓ | ✓ |
| `kyc:decide` (approve / reject / escalate) | ✓ | | ✓ |
| `flags:view` | ✓ | ✓ | ✓ |
| `flags:manage` (enable / disable / rollout) | | ✓ | ✓ |
| `refunds:view` | ✓ | ✓ | ✓ |
| `refunds:decide` (approve / deny) | ✓ | | ✓ |
| `refunds:decide_high_value` ($500+) | | | ✓ |
| `audit:view` | ✓ | ✓ | ✓ |

Enforcement happens in the service layer — `decideApplication()`, `decideRefund()` and
`changeFlag()` — which the server actions call, so a request that bypasses the UI is still rejected with an
`AuthorizationError`. Pages additionally use `can()` to hide or explain unavailable actions, and each
audit event records the acting user's name, email **and** role.

The top header has two independent prototype selectors, each stored in its own cookie:

- **Demo user** — who is acting (Sam Rivera, Maya Chen, Jordan Patel, Alex Thompson, all
  `@fintech-demo.com`). This identity is what every decision and audit event records.
- **View as** — which role's permissions to simulate (Reviewer / Engineer / Admin).

Changing one never changes the other, so e.g. *Maya Chen* viewing as *Reviewer* is a valid
combination. `getCurrentUser()` in `lib/auth/session.ts` combines the two and is the only place to
swap for a real SSO session, since everything downstream depends solely on the `AuthUser` shape.

## Tools

### KYC Review Queue (`/kyc`)

- 28 seeded mock applications with risk level, risk score, screening flags and documents
- Search across name, email, application ID and country; filter by review status (pending,
  escalated, approved, rejected) and risk level
- Applicant detail view (`/kyc/[id]`) with profile, flags, documents, decision and audit history
- Approve / reject / escalate actions, each behind a confirmation step; **rejection and escalation
  require a non-empty reason**, stored on the action and in the shared audit log
- **High-risk cases cannot be approved directly**: they must be escalated first, and the approval
  must carry a reviewer note (the Approve button is hidden until the case is escalated)
- **Separation of duties**: the user who escalated a case (matched on email, trimmed and
  case-insensitively) can neither approve nor reject it — a different authorized user must make the
  final decision. Both buttons disappear for them and the UI explains why; the service layer rejects
  the action even if the request bypasses the UI
- Every state change appends an immutable audit event, shown on the detail page and (most recent
  five) on the queue page

### Feature Flags (`/flags`)

- 8 seeded flags × 3 environments (development / staging / production), each with its own enabled
  state and rollout percentage
- Search across key, name, description and owner; filter by environment and enabled/disabled
- Flag detail view (`/flags/[id]`) with configuration, the same flag in other environments, controls
  and audit history
- Enable/disable and rollout changes; **every change shows a confirmation step** listing flag,
  environment, current value and proposed value before it is applied, in every environment
- **Every production change requires a reason and the flag key typed back**, whether it enables,
  disables or moves the rollout — so a production change cannot be cleared by muscle memory. The
  key is matched case-insensitively after trimming, and both rules are enforced in the service
  layer, not just the dialog
- Changes write the same `AuditEvent` records as the KYC tool, into the same append-only log

### Refund Operations (`/refunds`)

- 18 seeded fictional refund requests with customer, merchant, original and requested amount,
  payment method, refund reason, customer note, risk level and screening signals
- Search across customer, merchant, refund ID, account and transaction ID; filter by status, risk
  level, request date and value band (high value / below threshold)
- Refund detail view (`/refunds/[id]`) with the request, the transaction, the customer and their
  tenure, risk signals, the decision panel and the shared audit history
- Approve / deny, both behind a confirmation dialog showing customer, transaction, amount and the
  resulting status; **denial requires a non-empty reason**
- **High-value control**: refunds of $500 or more can only be approved *or denied* with
  `refunds:decide_high_value` (Admin). Everyone with `refunds:view` can still open and read them;
  the UI explains why the decision is unavailable and the service layer refuses the call
  regardless. The threshold is one constant in `lib/refunds/policy.ts`
- Money is held in minor units end to end and formatted once, so amounts read identically in the
  table, the detail view, the dialog and the audit log

### Audit Log (`/audit`)

- One chronological table of every sensitive action across all three tools: when, action, resource,
  what changed (previous → new value), actor and role, and any reason/note
- Filter by application (KYC / refunds / feature flags), action, actor, or free-text search over
  resource, actor and reason
- Resource names link back to the applicant, refund or flag detail page
- Read-only by design: events are append-only, and there is no UI to edit or delete them
- The per-tool history panels read from this same log, filtered by resource

Recorded actions: `KYC_APPROVED`, `KYC_REJECTED`, `KYC_ESCALATED`, `REFUND_APPROVED`,
`REFUND_DENIED`, `FLAG_ENABLED`, `FLAG_DISABLED`, `ROLLOUT_CHANGED`.

## Architecture

```
src/
  app/
    layout.tsx            App shell (sidebar + content) applied to every tool
    page.tsx              Operations dashboard: queue health, SLA, throughput, rollout posture
    kyc/page.tsx          Queue: summary tiles, filters, data table, recent audit activity
    kyc/[id]/page.tsx     Applicant detail: profile, actions, audit history
    refunds/page.tsx      Refund queue: summary tiles, filters, data table, recent decisions
    refunds/[id]/page.tsx Refund detail: request, transaction, customer, decision, audit history
    flags/page.tsx        Flag list: summary tiles, filters, data table, recent audit activity
    flags/[id]/page.tsx   Flag detail: config, controls with confirmation, audit history
    audit/page.tsx        Platform audit log: filters + chronological table across all tools
  components/
    shell/                AppShell + SidebarNav (nav registry lives in AppShell), IdentityMenu
                          (demo user + "View as"), CommandPalette, ThemeToggle, AccessDenied
    ui/                   Reusable primitives: DataTable, Card, DescriptionList, PageHeader, Badge,
                          Button, Field, Stat, Charts, Dialog (focus-trapped confirmations),
                          Toast (aria-live success feedback), icons
    audit/                AuditTimeline + AuditFilters, rendering the shared audit event shape
    kyc/                  Tool-specific: QueueFilters, ReviewActions, status badges
    refunds/              Tool-specific: RefundFilters, RefundDecisionActions, status badges
    flags/                Tool-specific: FlagFilters, FlagControls (confirmation flow)
  lib/
    auth/
      rbac.ts             Roles, permissions, can()/assertPermission() — shared by every tool
      session.ts          Stand-in for the SSO session (the acting user)
      actions.ts          Demo user and "View as" role switches (prototype only)
    format.ts             Shared date, money and account-tenure formatting
    theme.ts              Pure theme resolution (stored choice > system preference)
    metrics.ts            Pure dashboard rollups: aging/SLA, series, rates, flag/refund/actor summaries
    charts.ts             Pure chart geometry: projection, line/area paths, donut segments
    search.ts             Pure fuzzy matcher and grouping behind the command palette
    audit/
      types.ts            AuditEvent shape, action/resource registries, createAuditEvent()
      log.ts              Append-only store for events, with id sequencing and querying
      service.ts          Shared logging service: buildAuditEvent/recordAuditEvent/queryAuditEvents
    kyc/
      types.ts            Domain types and label/tone maps
      seed.ts             Deterministic seed data (fixed PRNG, identical on every boot)
      review.ts           Pure state machine: applyReviewAction() -> { application, event }
      store.ts            In-memory repository: queries + mutations, writes to the audit log
      service.ts          Authorized entry point: permission check + store write
      actions.ts          Next.js server actions used by the UI
    flags/
      types.ts            Flag/environment types and labels
      seed.ts             Deterministic seed flags across three environments
      mutations.ts        Pure state machine: applyFlagChange() -> { flag, event }
      store.ts            In-memory repository, same shape as the KYC store
      service.ts          Authorized entry point, mirroring the KYC service
      actions.ts          Next.js server actions used by the UI
    refunds/
      types.ts            Refund domain types and label maps
      policy.ts           The $500 control: threshold, permissions per decision, blocked messages
      seed.ts             Deterministic seed requests either side of the threshold
      mutations.ts        Pure state machine: applyRefundDecision() -> { refund, event }
      store.ts            In-memory repository, same shape as the KYC and flag stores
      service.ts          Authorized entry point: policy permissions + store write
      actions.ts          Next.js server actions used by the UI
    seed/
      history.ts          Deterministic decided cases, refunds and flag changes with audit events
      platform.ts         Memoises one seed so the KYC, refund, flag and audit stores agree
  test/
    render.tsx            jsdom render helper used by the component tests
```

Each tool is a `lib/<tool>/` domain module (types + seed + pure mutations + store + server actions)
plus a route folder and a handful of tool-specific components. Refund Operations was built exactly
that way: one entry in `NAV_SECTIONS`, one `AuditResourceType` and two action codes in
`lib/audit/types.ts`, three permissions in `rbac.ts`, and money formatting in `format.ts` — every
table, filter, dialog, toast, badge and empty state came from the existing primitives unchanged.

### Patterns to reuse for the next tool

- **Data tables** — declare `Column<T>[]` and render with `<DataTable>`; filters live in a client
  component that writes to the URL query string, so the server component stays the source of truth
  and every filtered view is linkable.
- **Detail views** — `PageHeader` + `Card`/`DescriptionList`, with tool-specific panels in a
  two-thirds/one-third grid.
- **Mutations** — a pure transition function (`review.ts`) validates and produces the next entity
  plus its audit event; the store persists both atomically; a server action adapts `FormData`,
  returns `{ ok, error }` to the client via `useFormState`, and revalidates affected paths.
- **Mutations with confirmation** — sensitive actions open `ConfirmDialog`: a real `role="dialog"`
  modal summarising the exact before → after change (plus the reason field where one is required),
  with focus moved to the first control, a focus trap, Escape to cancel and focus restored to the
  trigger. Validation is still re-checked server-side in the pure layer, so the dialog is UX, not
  the control. On success `useActionToast` announces the result through a polite live region.
- **Audit events** — no tool implements its own logging. Pure mutation layers call
  `buildAuditEvent()` and the stores call `recordAuditEvent()` from `lib/audit/service.ts`, always
  from the server after the state change succeeds. Every event is frozen and carries id, timestamp,
  actor (email), actorName, actorRole, action code, resourceType/resourceId/resourceLabel,
  changedField/previousValue/newValue and an optional reason. Events are never updated or deleted;
  reads go through `queryAuditEvents()`.

### Design system

The interface is a high-density operations surface. Colour, elevation and radius are semantic CSS
variables declared once in `app/globals.css` (`--bg`, `--panel`, `--border`, `--text`, `--accent`,
plus success/warning/danger/info pairs) and exposed to Tailwind as named utilities (`bg-panel`,
`border-line`, `text-muted`, `text-accent`) in `tailwind.config.ts`. Components never hard-code a
hex value, which is what makes the second theme possible: light mode is a `[data-theme="light"]`
block overriding the same variables, with no component changes.

The server renders `<html data-theme="dark">`; a small inline script in `app/layout.tsx` swaps in a
stored choice before first paint, so a light-mode user never sees a frame of the dark palette.
`ThemeToggle` flips the attribute and writes the choice to `localStorage`. The rule — stored choice,
otherwise the dark default — is pure and tested in `lib/theme.ts`; the OS preference is deliberately
not consulted, since the product is dark-first and light is opt-in.

On top of the tokens sit the primitives in `components/ui/`: `Button` (five variants, two sizes),
`Field` (input/textarea/select/label with one focus treatment), `Badge`, `Stat`, `Card`,
`DataTable`, `PageHeader` with breadcrumbs, an inline SVG icon set, and dependency-free
`Charts` (sparkline, bars, donut, meter) driven by the pure geometry in `lib/charts.ts`. Motion is
limited to short entrance and state transitions and is disabled under
`prefers-reduced-motion: reduce`.

### Business rules

| Rule | Where enforced |
| --- | --- |
| Approved and rejected applications are terminal and immutable | `applyReviewAction` |
| Rejection requires a non-empty reason (trimmed) | `applyReviewAction` |
| Escalation requires a non-empty reason (trimmed) | `applyReviewAction` |
| An escalated application cannot be escalated again | `applyReviewAction` |
| High-risk applications must be escalated before approval | `applyReviewAction` / `canApply` |
| Approving a high-risk application requires a reviewer note | `applyReviewAction` |
| The user who escalated a case cannot approve or reject it | `applyReviewAction` / `violatesSeparationOfDuties` |
| Rollout must be a whole number between 0 and 100 | `applyFlagChange` |
| No-op flag changes (already enabled, same rollout) are rejected | `applyFlagChange` |
| Every production change requires a reason | `applyFlagChange` / `requiresReasonForChange` |
| Every production change requires the flag key typed back | `applyFlagChange` / `requiresTypedConfirmation` |
| Flag changes are confirmed before submission, in every environment | `requiresConfirmation` / `FlagControls` |
| Sensitive actions confirm in a focus-trapped dialog, dismissible with Escape | `ConfirmDialog` |
| A flag change only affects the targeted environment | `applyFlagChange` / flag store |
| Every accepted action appends exactly one audit event | `recordReviewAction`, `recordFlagChange` |
| Invalid actions leave entity state and audit history untouched | `recordReviewAction`, `recordFlagChange` |
| Only roles with `kyc:decide` may decide a case | `decideApplication` |
| Only roles with `flags:manage` may change a flag | `changeFlag` |
| Approved and denied refunds are terminal and immutable | `applyRefundDecision` |
| Denying a refund requires a non-empty reason (trimmed) | `applyRefundDecision` |
| Only roles with `refunds:decide` may approve or deny a refund | `decideRefund` / `permissionsForDecision` |
| Deciding a refund of $500 or more needs `refunds:decide_high_value` | `decideRefund` / `permissionsForDecision` |

Validation lives in the pure layer, so the UI, tests and any future API route enforce identical
rules; the client-side form is only a convenience.

## Testing

- `src/lib/kyc/review.test.ts` — each review transition, the rejection-reason requirement, the
  high-risk escalate-then-approve policy and its reviewer note, separation of duties,
  immutability of inputs and of emitted audit events, terminal-state protection, append-only audit
  history, failed mutations leaving no trace, and queue filtering.
- `src/lib/flags/flags.test.ts` — enable/disable and rollout transitions, rollout validation,
  no-op rejection, per-environment isolation, immutability, failed changes leaving no trace,
  filtering, and every tool sharing one append-only audit log.
- `src/lib/auth/rbac.test.ts` — the permission matrix, and service-layer enforcement: a Reviewer can
  decide KYC cases but not change flags, an Engineer the reverse, an Admin both, unauthorized
  mutations throw and leave state and audit history untouched, and audit events record the role.
- `src/lib/auth/identity.test.ts` — demo user identity changes independently of the simulated role,
  audit events carry the selected user's name and email, and the service layer refuses an approval
  or rejection by the user who escalated the case while allowing a different Reviewer/Admin.
- `src/lib/guardrails.test.ts` — the guardrails on consequential actions: KYC rejection and
  escalation without a reason are refused at the service layer and leave no state or audit trace,
  valid reasons are trimmed and stored, a production change without a reason or with a mistyped
  flag key is refused while a valid one stores the reason, and RBAC plus separation of duties still
  hold.
- `src/lib/audit/audit.test.ts` — the shared log: approving records `KYC_APPROVED`, escalating
  records `KYC_ESCALATED` with its note, disabling a flag records `FLAG_DISABLED`, a rollout change
  records `ROLLOUT_CHANGED` with previous and new percentages, cross-tool chronological querying and
  filtering, and recorded events being frozen.
- `src/components/kyc/ReviewActions.test.tsx` — the reviewer's confirmation step: reject and
  escalate open a confirmation form instead of acting immediately, a blank or whitespace-only
  reason is refused before submission, a valid reason is submitted, a high-risk approval demands a
  note while a low-risk one does not, cancel abandons the action, Escape closes the dialog and
  restores focus to the trigger, and role or separation-of-duties blocks hide the controls and
  explain why.
- `src/components/flags/FlagControls.test.tsx` — the flag confirmation step: every production
  change confirms with flag name, environment, current and proposed value, a production change
  requires a nonblank reason and the flag key typed back, a staging change requires
  neither, out-of-range percentages are refused before confirmation, cancel abandons the change,
  and a role without `flags:manage` sees no controls.
- `src/lib/refunds/refunds.test.ts` — the refund policy and service: the threshold boundary and the
  role-to-decision matrix, a Reviewer approving below $500, approvals and denials writing
  `REFUND_APPROVED`/`REFUND_DENIED` with previous and new status and a trimmed reason, denial
  without a reason refused with no trace, terminal refunds immutable, an Engineer refused both
  decisions, a Reviewer refused both decisions on a $500+ refund, an Admin approving and denying
  one, and queue filtering/search.
- `src/components/refunds/RefundDecisionActions.test.tsx` — the refund confirmation step: approval
  confirms with customer, transaction, amount and resulting status, denial refuses a
  whitespace-only reason and submits a valid one, a blocked decision hides its control and explains
  why, a role that cannot decide sees no controls, and a decided refund shows the immutable notice.
- `src/lib/metrics.test.ts`, `src/lib/charts.test.ts`, `src/lib/search.test.ts` — the pure layer
  behind the dashboard and command palette: SLA aging and breach ordering, dense daily series,
  clearance/approval rates, production flag and actor rollups; chart projection, smoothing, donut
  offsets and bar scaling; and fuzzy ranking that prefers prefixes, word starts and contiguous runs.
- `src/lib/seed/history.test.ts`, `src/lib/theme.test.ts` — the seeded history is anchored to the
  current day, its decided cases match their audit events, escalations precede decisions by a
  different operator, and final flag state equals the last event's new value; theme precedence puts
  a stored choice above the dark default and ignores unrecognised values.

Component tests run in jsdom. They mount with the React build Next.js vendors for the App Router
(see the aliases in `vitest.config.ts`), because `useFormState`/`useFormStatus` do not exist in the
published `react-dom` 18 package; the server actions are mocked so the tests assert on the
submitted `FormData`.

## Persistence

State is held in in-memory stores on `globalThis` (survives dev-server reloads, resets on process
restart). The audit log is the `audit_events` table stand-in: one record shape for all tools.
Replacing the `store.ts` modules and `lib/audit/log.ts` with database-backed repositories
is the only change needed to persist data — the pure mutation layers and the UI are unaffected.
