# Architecture Decision Records

Why the project is the way it is. Agents: read this before starting work, and add a new ADR when you make (or the owner approves) a significant choice.
Never rewrite an accepted ADR. To change a decision, add a new ADR that **supersedes** it and update the old one's status.

Format: `## ADR-NNN: Title` → **Status** (Proposed / Accepted / Superseded by ADR-NNN), **Context**, **Decision**, **Consequences**.

---

## ADR-001: Technology stack and hosting
**Status:** Accepted (2026-11-27)

**Context:** A TODO PWA with user accounts, built entirely by AI agents, deployed to Azure. The owner is experienced with .NET and Azure SQL.

**Decision:**
- Backend: ASP.NET Core on **.NET 10 (LTS)**, EF Core, xUnit.
- Frontend: React + TypeScript (strict) + Vite, React Router, TanStack Query; Vitest + React Testing Library; Playwright for E2E.
- Database: **Azure SQL** (serverless tier with auto-pause).
- Hosting: **Azure Container Apps**, with the API and frontend as separate containers in resource group `rg-mytodoapp`, region **France Central**.

**Consequences:** One familiar, well-supported stack. Scale-to-zero and serverless SQL keep idle cost low, but there are cold starts after idle periods (acceptable for this app).

---

## ADR-002: Clean Architecture + light CQRS, organized by feature
**Status:** Accepted (2026-11-27)

**Context:** We need clear boundaries that agents can follow reliably, while keeping each feature easy to find. MediatR and AutoMapper moved to commercial licenses.

**Decision:**
- Four projects: Domain, Application, Infrastructure, Api, with dependencies pointing inward only.
- **Light CQRS:** our own `ICommandHandler<TCommand, TResult>` / `IQueryHandler<TQuery, TResult>`, one handler per use case, injected directly into endpoints. No mediator or pipeline behaviors. One database and one `DbContext`.
- Folders: **`<Feature>/<Action>/`** in Application and Api (and their tests), **`<Feature>/`** in Domain and Infrastructure.
- **No MediatR, AutoMapper or other commercial-licensed packages**; map by hand.

**Consequences:** One issue usually maps to one Action folder. More files per feature than a single-project app, so `CLAUDE.md` documents exactly where each file goes.

---

## ADR-003: Minimal APIs, built-in validation, ProblemDetails
**Status:** Accepted (2026-11-27)

**Decision:**
- **Minimal APIs** with `MapGroup` per feature and `TypedResults`, plus built-in OpenAPI.
- **Built-in .NET 10 validation** (`AddValidation()` + DataAnnotations, `IValidatableObject` for complex rules). No FluentValidation.
- Errors are **ProblemDetails (RFC 9457)**. Domain exceptions are mapped by one global `IExceptionHandler`. Unexpected errors return a generic 500 with no stack trace.

**Consequences:** No extra validation package, and less expressive than FluentValidation for complex rules. Rules that need the database live in handlers.

---

## ADR-004: Monorepo layout
**Status:** Accepted (2026-11-27)

**Decision:** One repository: `src/backend`, `src/frontend`, `tests/`, `infra/`, `.github/workflows/`, `docs/`.

**Consequences:** Every agent can see the whole system (e.g. the frontend agent can read backend DTOs to confirm the contract). A feature touching API and UI can still be one issue and one PR. CI uses path filters so only affected parts build.

---

## ADR-005: Deployment only through GitHub Actions with OIDC
**Status:** Accepted (2026-11-27)

**Context:** "Never deploy manually." The pipeline needs Azure access without stored passwords.

**Decision:**
- Entra app registration **`gh-mytodoapp-deploy`** with a federated credential trusting only `repo:baghos85/mytodoapp:ref:refs/heads/main`.
  - *Update (2026-11-27):* GitHub now issues OIDC subjects with immutable ids: `repo:<owner>@<ownerId>/<repo>@<repoId>:ref:refs/heads/main`. The first deployment failed with `AADSTS700213` (no matching federated identity record). The owner added a second federated credential **`gh-main-immutable`** with that subject format; the original credential is kept. Both still trust only `main`.
- Roles, scoped to `rg-mytodoapp` only: **Contributor**, plus **Role Based Access Control Administrator** with a condition that allows assigning or removing **only the AcrPull role** (so Bicep can let the container apps pull images).
- GitHub repo secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (identifiers, not passwords).
- Agents and humans never run `az deployment ... create`; the agent permission rules block it.

**Consequences:** No long-lived credentials. PR workflows can't reach Azure (CI doesn't need it). If Bicep ever needs another role assignment, the condition must be widened deliberately via a new ADR.

---

## ADR-006: Public repo with branch protection; approval rules over time
**Status:** Accepted (2026-11-27)

**Context:** Branch protection is not available for private repos on GitHub Free. While agents run locally they use the owner's GitHub login, so every PR is authored by the owner, and GitHub doesn't let authors approve their own PRs.

**Decision:**
- The repo is **public**, with secret scanning and push protection enabled.
- `main` is protected: PR required, applies to admins, no force pushes, no deletion, conversations must be resolved, stale approvals dismissed.
- **Required approvals: 0 for now.** The owner's approval is the act of merging (agents are blocked from `gh pr merge`).
- Required CI status checks are added once `ci.yml` exists (Phase 5).
- **Phase 7:** once PRs are authored by a GitHub App, set required approvals to **1** so nothing merges without the owner's review.

**How to let the reviewer agent approve PRs later (if wanted):**
1. The reviewer needs its **own GitHub identity**, different from the PR author: a second GitHub App, a machine-user account, or (in Actions) a separate App token.
2. Remove the `gh pr review * --approve*` deny rules from `.claude/settings.json` and update `reviewer.md` to approve on a ✅ verdict.
3. To keep the owner's final say on sensitive areas, add `CODEOWNERS` (e.g. `infra/` and `.github/workflows/` owned by the owner) and enable "Require review from Code Owners".
4. Keep "Allow GitHub Actions to create and approve pull requests" **off** unless a GitHub App is not used.

**Consequences:** Code and issues are publicly visible (no secrets are stored in the repo). Until Phase 7 the approval gate is a process rule (only the owner merges), not a GitHub-enforced review.

---

## ADR-007: Reviewer agent gives verdicts, never approves or merges
**Status:** Accepted (2026-11-27)

**Decision:** The reviewer runs checks and posts **one PR comment** with a ✅ / ❌ verdict and findings. It has no Edit/Write tools and is blocked from `gh pr review --approve` and `gh pr merge`. After 3 review rounds with open ❌ items it adds the `needs-human` label and stops.

**Consequences:** The owner stays the single gate to `main`. See ADR-006 for how to change this later.

---

## ADR-008: MCP servers: Azure (read-only) and Playwright; no GitHub MCP
**Status:** Accepted (2026-11-27)

**Decision:**
- **Azure MCP** with `--read-only`, so agents can inspect resources and logs but never change them.
- **Playwright MCP**, so agents can open the app in a real browser to verify UI changes.
- **No GitHub MCP**: the `gh` CLI (already authenticated) covers issues, PRs and labels without an extra token.
- Agents that need MCP tools (frontend-dev, devops, reviewer) don't restrict their tool list; the reviewer uses `disallowedTools` to stay read-only.

**Consequences:** One less credential to manage. If structured GitHub access is needed later, add the GitHub MCP with a fine-grained token stored only in an environment variable.

---

## ADR-009: Same origin: nginx reverse proxy and internal-only API ingress
**Status:** Accepted (2026-11-27)

**Context:** API and frontend run as separate containers (ADR-001). On different origins the auth cookie would be third-party (blocked by Safari and increasingly Chrome) and CORS would be needed.

**Decision:**
- The browser talks only to the web container (`ca-mytodoapp-web`). Its nginx serves the SPA and reverse-proxies `/api/*` to the API's internal FQDN. The API app (`ca-mytodoapp-api`) has **internal-only ingress**.
- nginx sets `Host` to the upstream (Container Apps routes by Host) and passes the original host, client IP and scheme in `X-Forwarded-Host/-For/-Proto`; the API uses `ForwardedHeaders` middleware with a fixed `ForwardLimit`.
- **No CORS** in the API. The frontend uses a configurable base URL (`VITE_API_BASE_URL`, default `/api/v1`); locally the Vite dev-server proxy forwards `/api`.

**Consequences:** First-party `SameSite=Strict` cookie, no CORS, smaller attack surface. nginx is on every API request (small latency, proxy timeouts must cover cold starts). The API can't be called directly from the internet, so `/health` is probed by the platform only. See SPEC 7.1, 10.2.

---

## ADR-010: Authentication: ASP.NET Core Identity, cookie-only in v1, scheme-agnostic API
**Status:** Accepted (2026-11-27)

**Context:** We need accounts with email + password and a secure browser session; a mobile client might come later.

**Decision:**
- ASP.NET Core Identity (`IdentityUser<Guid>`) in the app's database. Only `register` and `login` of `MapIdentityApi` are exposed under `/api/v1/auth`, plus our own `logout`, `GET me` and `DELETE me`; other Identity endpoints return 404.
- **Cookie only** in v1: `MyTodoApp.Auth`, `HttpOnly`, `Secure`, `SameSite=Strict`, 14-day sliding expiry. No antiforgery tokens (same origin + `SameSite=Strict` + JSON-only bodies + no CORS). `401`/`403` instead of redirects.
- **Scheme agnostic:** endpoints use only `RequireAuthorization()`; Application code gets the user only via `ICurrentUser`; no code reads cookies directly. Bearer tokens (Identity bearer or JWT via OIDC) can be added later beside the cookie.

**Consequences:** No token handling in the SPA (no XSS-stealable tokens). Bearer login is unsupported in v1. Adding mobile auth later is configuration + a new ADR, not a rewrite.

---

## ADR-011: Open registration with rate limiting and lockout
**Status:** Accepted (2026-11-27)

**Decision:** Anyone can register. `register`, `login` and `DELETE /auth/me` share the built-in rate limiter policy: fixed window, **10 requests/minute per client IP** → `429` with `Retry-After`. Identity lockout: 5 failed logins → 5 minutes. Limits are configurable so tests can raise them.

**Consequences:** No invite flow to build. No email confirmation, so registration reveals whether an email exists (accepted v1 limitation, SPEC 7.2). Rate limiting depends on a correct client IP behind two proxies (ADR-009).

---

## ADR-012: Every task belongs to a list; Inbox created at registration
**Status:** Accepted (2026-11-27)

**Decision:** `TodoTask.ListId` is required. Each user gets an **Inbox** list (`IsDefault = true`), created in the same transaction as the user; it can't be renamed or deleted. Deleting another list deletes its tasks.

**Consequences:** One simple invariant (no list-less tasks), an obvious home for quick-add in Today. Because `MapIdentityApi`'s register can't be extended, the Inbox is added by the `DbContext` when a new user is saved (ADR-021).

---

## ADR-013: Due dates as DateOnly; "today" from the browser's IANA time zone
**Status:** Accepted (2026-11-27)

**Decision:** `DueDate` is `DateOnly` (SQL `date`, JSON `YYYY-MM-DD`), no due times. Today/Upcoming endpoints take a required `timeZone` query parameter (IANA id from `Intl.DateTimeFormat().resolvedOptions().timeZone`); the server computes `today` from `TimeProvider` in that zone. Today includes overdue; Upcoming has no horizon. Timestamps are UTC.

**Consequences:** No stored user time zone and no DST edge cases for dates. The runtime image must include ICU + tzdata. The frontend must never parse date-only strings with `new Date()`.

---

## ADR-014: GDPR: account deletion and privacy page in v1, export later
**Status:** Accepted (2026-11-27)

**Decision:** Self-service account deletion confirmed with the current password: hard delete of tasks, lists and the user in one transaction, then sign-out. Public `/privacy` page. Azure SQL point-in-time backup retention **7 days**, stated in the privacy notice. Data stays in France Central. Logs contain no emails or task/list content. Data export is a future item.

- *Update (2026-11-27, owner decision on #18):* Azure keeps the backup files needed for point-in-time restore for up to a week longer than the retention period, so the privacy notice now says **"backups are deleted automatically within about 14 days"** (7-day PITR window plus up to a week of backup-file retention). The technical setting stays **7-day PITR**.

**Consequences:** Deleted data disappears from backups within about 14 days. Infra must keep PITR retention (and backup storage location) consistent with the privacy notice; if PITR retention changes, the notice changes in the same PR.

---

## ADR-015: Data and API conventions: Guid v7, denormalised owner, string enums, caps instead of pagination
**Status:** Accepted (2026-11-27)

**Decision:**
- Ids are `Guid.CreateVersion7()`. `TodoTask` carries a denormalised `UserId` (FK with `NoAction`, avoiding multiple cascade paths) so every query filters on the owner directly.
- Enums are serialised as camelCase strings, stored as int.
- No pagination in v1: collections are wrapped (`{ items, truncated }`), max 100 lists per user, max 500 tasks per response.

**Consequences:** Simple ownership filters and index-friendly ids. Pagination can be added later without breaking clients. Code must keep `TodoTask.UserId` equal to the list's `UserId`.

---

## ADR-016: Read-only offline PWA; health probe without database
**Status:** Accepted (2026-11-27)

**Decision:**
- vite-plugin-pwa (Workbox), prompt-to-update. App shell precached; `GET /api/v1/*` runtime-cached with NetworkFirst (10 s timeout, 100 entries, 7 days). No offline editing or background sync; mutating controls are disabled offline. Caches are cleared on sign-out, account deletion and `401`.
- `/health` does not query the database, so probes don't keep Azure SQL serverless awake.

**Consequences:** Simple, safe offline story with no conflict resolution. A DB outage is not visible in the health probe; it shows up as API errors and logs.

---

## ADR-017: Azure resource topology, naming and sizing
**Status:** Accepted (2026-11-27)

**Context:** The devops agent needs exact resource names and cost-efficient settings (CLAUDE.md: scale to zero, serverless SQL).

**Decision:**
- In `rg-mytodoapp` (France Central): `log-mytodoapp` (30-day retention), `cae-mytodoapp` (Consumption, no VNet), `acrmytodoapp<sfx>` (Basic, admin user off), `ca-mytodoapp-web`, `ca-mytodoapp-api`, `caj-mytodoapp-migrate`, `sql-mytodoapp-<sfx>` / `sqldb-mytodoapp`, identities `id-mytodoapp-{web,api,migrate}`. `<sfx>` = `take(uniqueString(resourceGroup().id), 6)` only for globally unique names.
- One user-assigned identity per app, each with AcrPull only (plus SQL rights per ADR-019).
- Both apps: min replicas 0, max 2, 0.25 vCPU / 0.5 GiB. SQL: serverless GP_S_Gen5, max 2 vCores, free-offer defaults for size (32 GB) and auto-pause (fixed 15 min), PITR 7 days, **Local** backup redundancy (backups stay in France Central).
- SQL uses the **Azure SQL Database free offer** (owner decision, step 4.3): `useFreeLimit: true`, `freeLimitExhaustionBehavior: 'AutoPause'`. When the monthly free allowance is used up, the database auto-pauses until the next month; usage over the limit is **never billed** (`BillOverUsage` is not allowed).
- Images tagged with the commit SHA.

**Alternatives:** One shared identity for all apps (simpler, but the web app would hold SQL-capable credentials); a VNet with private endpoints (more secure, costs more and adds complexity); regular billed serverless SQL, or the free offer with bill-over-usage (no monthly outage, but costs money).

**Consequences:** Near-zero idle cost; cold starts after idle. Bicep is split into `core.bicep` and `apps.bicep` (ADR-023). With the free offer, if the allowance runs out the app is **unavailable until the month resets** (API calls that need the database fail; migrations fail too), while `/health` and `/healthz` stay green because they don't touch the database (ADR-016), so it is visible only as API errors in the logs. The free offer is limited per subscription; if it can't be used, the devops agent asks the owner instead of falling back to a billed tier (SPEC 10.1).

---

## ADR-018: Database migrations: EF Core bundle run by a Container Apps Job
**Status:** Accepted (2026-11-27)

**Context:** Migrations must run in Azure on each deployment. The deploy identity (ADR-005) has no SQL data-plane access, the API connects with Entra-only managed identity, and SQL serverless may need ~1 minute to resume.

**Decision:**
- `deploy.yml` builds a `mytodoapp-migrate` image containing a self-contained EF Core migration bundle (plus `go-sqlcmd` for the idempotent API-user grant, ADR-019), and runs it as the manual-trigger Container Apps Job `caj-mytodoapp-migrate` with its own identity `id-mytodoapp-migrate`.
- Order: push images → update job image → run job and wait → only then switch the API and web apps to the new image. A failed migration stops the deployment while the old version keeps serving.
- Migrations must be **backward compatible** with the previous API version (expand/contract).

**Alternatives:** (a) API migrates at start-up: simplest, but the internet-facing API would need DDL rights, start-up waits for SQL resume, and replicas race. (b) Bundle run from the GitHub runner: needs SQL firewall openings for runner IPs and data-plane rights for the CI identity. (c) Idempotent SQL script: same problems as (b).

**Consequences:** API stays least-privileged (no DDL). One extra image and job to maintain. Starting the job uses `az containerapp job start` (allowed by Contributor).

---

## ADR-019: Azure SQL: Entra-only auth, per-app managed identities, admin group
**Status:** Accepted (2026-11-27)

**Context:** No passwords (CLAUDE.md). Someone must be SQL Entra admin, and the API's database user must be created.

**Decision:**
- `azureADOnlyAuthentication: true`. Entra admin = security group **`sg-mytodoapp-sql-admins`** (owner + `id-mytodoapp-migrate`); its object id comes from GitHub variable `SQL_ADMIN_GROUP_OBJECT_ID`.
- `id-mytodoapp-api` gets `db_datareader` + `db_datawriter` only. The migration job creates/grants it on every run with an idempotent script (`infra/sql/grant-api-user.sql`): `CREATE USER [id-mytodoapp-api] WITH SID = <sid from the API identity's client id>, TYPE = E`. This does no Entra lookup, so the SQL server needs no "Directory Readers" role. The job gets `API_DB_USER`, `API_CLIENT_ID` (client id, not principal id), `SQL_SERVER`, `SQL_DATABASE` and `SQL_CLIENT_ID` (its own client id for the `sqlcmd` login).
  - *Update (2026-11-27):* the original text said `FROM EXTERNAL PROVIDER WITH OBJECT_ID = <principal id>` avoids Directory Readers. That is wrong: `FROM EXTERNAL PROVIDER` (with or without `OBJECT_ID`) validates the principal in Entra and needs the server identity in Directory Readers when a service principal runs it. The SID form with the **client id** (as the CREATE USER docs require for managed identities) is what the code does; don't switch back.
- Connection strings use `Authentication=Active Directory Managed Identity;User Id=<client id>` (no secret).
- Network: public endpoint with only the "Allow Azure services" rule; no client-IP rules.
- One-time owner steps (agreed by the owner in step 4.3; an owner action in Phase 5 before the first deployment): create the group, add yourself, set the variable; after the first deployment, add `id-mytodoapp-migrate` to the group and re-run the deployment.
  - *Note:* a managed identity's new group membership can take **several hours** to apply, because its tokens are cached (no forced refresh). A re-run right after adding it may still fail; wait and re-run later. If this becomes painful, alternative 2 below avoids it (needs a new ADR).

**Alternatives:** (1) Owner as the only Entra admin and a one-time manual SQL script to create both identities' users: fewer automated admin rights, but a manual data-plane step that needs a client firewall rule. (2) `id-mytodoapp-migrate` as the direct Entra admin: zero manual steps, but the owner has no direct DB access without a Bicep change.

**Consequences:** Fully automated after the one-time setup; the migrate identity is effectively server admin, so the job image must come only from our ACR via the pipeline. "Allow Azure services" admits connections from any Azure tenant to the endpoint (authentication still required); private networking is a later option.

---

## ADR-020: Persist Data Protection keys in Azure SQL
**Status:** Accepted (2026-11-27)

**Context:** The Identity cookie is encrypted with ASP.NET Core Data Protection keys. By default they live in the container's file system, which is lost on every restart, scale-from-zero and new revision, so all users would be signed out constantly and replicas couldn't read each other's cookies.

**Decision:** `AddDataProtection().SetApplicationName("MyTodoApp").PersistKeysToDbContext<AppDbContext>()` (package `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore`); keys in table `DataProtectionKeys`.

**Alternatives:** Azure Blob Storage + Key Vault key wrapping (keys encrypted at rest with a KV key; two more resources and RBAC assignments, which the deploy identity can't create today per ADR-005).

**Consequences:** Sessions survive restarts and scaling with no new resources. Keys are protected by database access control and TDE, not by a separate key; Key Vault wrapping can be added later.

---

## ADR-021: Backend composition details
**Status:** Accepted (2026-11-27)

**Context:** ADR-002 sets the layers; agents need the concrete wiring to be consistent.

**Decision:**
- `IAppDbContext` (Application) exposes `DbSet<TaskList>`, `DbSet<TodoTask>` and `SaveChangesAsync`; Application references the base `Microsoft.EntityFrameworkCore` package (no provider) for LINQ async operators.
- `AppDbContext : IdentityUserContext<User, Guid>` (no role tables) in Infrastructure; `User : IdentityUser<Guid>` lives in Infrastructure; Domain entities hold `UserId` as a plain `Guid`. Users are reached through `IIdentityService`.
- **Inbox creation:** `AppDbContext.SaveChangesAsync` adds `TaskList.CreateInbox(...)` for each newly added `User` (same `SaveChanges`, same transaction).
- **Handler registration** by reflection scanning in `AddApplication()` (no Scrutor), verified by a unit test.
- `ICurrentUser` implemented in Api from claims. `TimeProvider` injected everywhere (no custom `IClock`).
- Explicit ownership filters in each query; no global query filters.
- `EnableRetryOnFailure` for SQL; explicit transactions via the execution strategy.

**Alternatives:** Explicit handler registration (clearer, but every PR edits the same file); a custom register endpoint instead of `MapIdentityApi` for the Inbox (more code to own); global query filters (less repetition, hidden behaviour).

**Consequences:** Adding a use case = add folder + handler, nothing else. The Inbox rule is enforced for any code path that creates users.

---

## ADR-022: Test databases and deterministic time
**Status:** Accepted (2026-11-27)

**Context:** CLAUDE.md requires handler unit tests and endpoint integration tests that are deterministic. Behaviour that matters (case-insensitive unique names, cascades, filtered unique index, migrations, `DateOnly` mapping) is SQL Server-specific.

**Decision:**
- **API integration tests: SQL Server in Docker via Testcontainers** (`Testcontainers.MsSql`): one container per test assembly, a fresh migrated database per test class, each test uses its own users.
- **Handler unit tests: the real `AppDbContext` on SQLite in-memory** (`Microsoft.EntityFrameworkCore.Sqlite`): fast, relational, no Docker. SQL Server-specific behaviour is asserted only in integration tests.
- Time: a hand-written `FixedTimeProvider : TimeProvider` per test project (no `Microsoft.Extensions.TimeProvider.Testing` package). No assertion or mocking library.

**Alternatives:** SQLite for integration tests too (no Docker, but case sensitivity, cascade and index behaviour differ, so it would pass tests that fail in production); EF Core InMemory provider for handler tests (not relational, no `ExecuteDelete`, no constraints).

**Consequences:** Docker is required to run integration tests locally (Docker Desktop) and is available on GitHub `ubuntu-latest` runners. First run downloads the SQL Server image (~1.5 GB); the container start adds ~15–30 s per test run.

---

## ADR-023: CI/CD workflow shape
**Status:** Accepted (2026-11-27)

**Decision:**
- `ci.yml` always runs on PRs; a `changes` job (plain `git diff`, no third-party action) decides which jobs run (backend, frontend, infra, images, e2e). An aggregate **`ci-ok`** job is the single required status check, so skipped jobs never block a PR.
- `deploy.yml` on push to `main` (docs-only changes ignored) and `workflow_dispatch`: deploy `infra/core.bicep` → build/push images (SHA tags) → deploy `infra/apps.bicep` (job with new image, apps with current images) → run migration job → update API, then web → smoke test (`/healthz` 200, `/api/v1/auth/me` 401, and for API and web the latest revision is the ready, active, healthy one running this run's image tag).
- No GitHub `environment:` on the deploy job, because it would change the OIDC subject away from `ref:refs/heads/main` (ADR-005).

**Alternatives:** Path filters on the workflow trigger (simpler, but required checks would stay "pending" on PRs that don't match); a single Bicep file with placeholder images on the first deployment (fragile probes and ordering).

**Consequences:** Migrations always run before new code serves traffic. Two Bicep entry files to maintain. Adding approval gates via GitHub environments later needs a new federated credential.

---

## ADR-024: Local development with docker compose
**Status:** Accepted (2026-11-27)

**Decision:** `compose.yaml` at the repo root with `sql` (SQL Server 2022 Developer container), `migrate`, `api` and `web`; `docker compose up --build` reproduces the production topology at `http://localhost:8080` and is what Playwright runs against. Inner loop: compose `sql` + `migrate`, `dotnet run` for the API (user-secrets connection string) and `npm run dev` with the Vite proxy. The local SA password lives in a git-ignored `.env` (`.env.example` committed).

**Alternatives:** LocalDB (Windows only, doesn't work in CI or containers).

**Consequences:** Same engine locally, in CI and close to Azure SQL. Docker Desktop is required on the owner's machine.

---

## ADR-025: Package and image baseline
**Status:** Accepted (2026-11-27)

**Context:** CLAUDE.md: ask before adding any NuGet/npm package and record why. This is the baseline the agents may use without asking again; anything else still needs approval.

**Decision:**
- **NuGet (runtime):** `Microsoft.EntityFrameworkCore` (Application), `Microsoft.EntityFrameworkCore.SqlServer`, `Microsoft.EntityFrameworkCore.Design` (private assets), `Microsoft.AspNetCore.Identity.EntityFrameworkCore`, `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore` (Infrastructure), `Microsoft.AspNetCore.OpenApi` (Api). Tool: `dotnet-ef` (local tool manifest).
- **NuGet (tests):** `xunit.v3`, `xunit.runner.visualstudio`, `Microsoft.NET.Test.Sdk`, `Microsoft.AspNetCore.Mvc.Testing`, `Microsoft.EntityFrameworkCore.Sqlite`, `Testcontainers.MsSql`.
- **npm (runtime):** `react`, `react-dom`, `react-router`, `@tanstack/react-query`, `vite-plugin-pwa` (+ `workbox-window`).
- **npm (dev):** `typescript`, `vite`, `@vitejs/plugin-react`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-plugin-jsx-a11y`, `prettier`, `eslint-config-prettier`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@playwright/test`, `@axe-core/playwright`.
- **Images/tools:** `mcr.microsoft.com/dotnet/{sdk,aspnet,runtime-deps}:10.0`, `node:24-alpine`, `nginxinc/nginx-unprivileged:stable-alpine`, `mcr.microsoft.com/mssql/server:2022-latest`, `go-sqlcmd` (in the migrate image).
- Deliberately **not** used: MediatR, AutoMapper, FluentValidation, FluentAssertions (commercial from v8), Moq, Scrutor, UI component libraries, CSS-in-JS, MSW (may be proposed later).

**Consequences:** All baseline packages are MIT/Apache and maintained by Microsoft or large communities. Version bumps within these packages need no ADR.

**Update (2026-11-27, owner decision, #12):**

- Approved as explicit npm dev dependencies: `@types/react`, `@types/react-dom`, `@testing-library/dom` (peer of `@testing-library/react`) and `workbox-build` (peer of `vite-plugin-pwa`; build-time only, so `vite-plugin-pwa` is also a dev dependency).
- Rule widened: this ADR also pre-approves (a) `@types/*` packages for approved libraries and (b) required peer dependencies of approved packages. Anything else still needs approval.
- `eslint` and `@eslint/js` are pinned to 9.x because `eslint-plugin-jsx-a11y` (6.10.2) only supports ESLint ≤ 9; move to 10 once jsx-a11y supports it.
