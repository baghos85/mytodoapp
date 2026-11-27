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
