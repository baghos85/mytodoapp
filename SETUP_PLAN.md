# Agentic Development Setup Plan

Goal: a real project built entirely by AI agents (Claude CLI), coordinating through GitHub, and deployed to Azure.

## Instructions for Claude

- Work through this file **one step at a time**, in order.
- Before each step: explain what you'll do and **wait for my OK**.
- Steps marked **[HUMAN]** must be done by me. Give me exact instructions and wait until I confirm.
- After finishing a step: check it off (`- [x]`), commit, and stop.
- Never put secrets (keys, passwords, tokens) in files or chat.
- If a session restarts: continue from the first unchecked step.

---

## Project Info (fill in before starting)

- Project idea: a TODO web app with user accounts, lists, tasks (title, due date, done/not done) and a filter for today, upcoming and completed. Responsive and installable as a PWA.
- Stack: ASP.NET Core Web API (.NET 10 LTS), EF Core, xUnit for unit tests; React + TypeScript frontend (Vite); Playwright for E2E tests.
- Database: Azure SQL
- Hosting: Azure Container Apps — API and frontend as separate containers
- GitHub repo name: mytodoapp
- Azure region: France Central (francecentral)

---

## Phase 1: Laptop & Accounts

- [x] 1.1 Check installed tools: git, gh, az, docker, node/python. List what's missing and give me install commands.
- [x] 1.2 **[HUMAN]** Run `gh auth login` and `az login`.
- [x] 1.3 Initialize the git repo, add `.gitignore`, create the GitHub repo with `gh repo create`, and push.
- [x] 1.4 Create the Azure resource group (e.g. `rg-<project>`) with `az group create`.
- [ ] 1.5 **[HUMAN]** Set a budget alert on the resource group in the Azure portal.
- [ ] 1.6 Set up Azure auth for GitHub Actions using OIDC (federated credential) scoped to the resource group only. Prepare the commands for me.
- [ ] 1.7 **[HUMAN]** Add the required values (client ID, tenant ID, subscription ID) as GitHub repo secrets.

## Phase 2: Agent Configuration

- [ ] 2.1 Create a root `CLAUDE.md` with project rules: stack, coding standards, branch naming (`feat/<issue>-<slug>`), every change goes through a PR, tests must pass, never deploy manually. Include my .NET preferences (architecture style, minimal APIs vs controllers, naming, validation/error handling). Add rule: when I correct you or something fails, add a one-line entry to docs/LEARNINGS.md (what went wrong → what fixed it).
- [ ] 2.2 Create `.claude/settings.json` with permissions: allow build/test/git/gh commands; deny destructive commands (`az group delete`, `rm -rf`, force push to main).
- [ ] 2.3 Create subagents in `.claude/agents/`:
  - `architect.md`: writes spec + architecture, creates GitHub issues
  - `backend-dev.md`: implements API/data layer with unit tests
  - `frontend-dev.md`: implements UI
  - `reviewer.md`: reviews PRs, runs tests, files bugs as issues
  - `devops.md`: infra-as-code, Dockerfile, CI/CD pipelines
- [ ] 2.4 Add MCP servers to `.mcp.json`: GitHub MCP, Azure MCP (optionally Playwright for E2E tests).
- [ ] 2.5 Add hooks to run lint/format after file edits.
- [ ] 2.6 **[HUMAN]** Restart `claude` so the new agents, settings and MCP servers load. Verify with `/agents` and `/mcp`.

## Phase 3: GitHub Guardrails

- [ ] 3.1 Enable branch protection on `main`: require PRs, passing checks, and 1 approval (me).
- [ ] 3.2 Create issue labels: `backend`, `frontend`, `devops`, `bug`, `spec`.
- [ ] 3.3 Create a `docs/` folder with `SPEC.md` and `DECISIONS.md` (shared memory for agents).

## Phase 4: Specification (architect agent)

- [ ] 4.1 Architect writes `docs/SPEC.md`: features, data model, API endpoints, UI pages.
- [ ] 4.2 Architect writes the architecture section and records choices in `docs/DECISIONS.md`.
- [ ] 4.3 **[HUMAN]** I review and approve the spec.
- [ ] 4.4 Architect creates 5–10 small GitHub issues with labels and acceptance criteria.

## Phase 5: Infrastructure & Pipeline (devops agent)

- [ ] 5.1 Write infra-as-code in `infra/` (Bicep): Container Apps environment, container registry, app(s), logging.
- [ ] 5.2 Write the Dockerfile(s).
- [ ] 5.3 Write GitHub Actions:
  - `ci.yml`: on PR → lint, test, build
  - `deploy.yml`: on merge to main → build image, push, deploy to Azure via OIDC
- [ ] 5.4 Open a PR for the infra + pipeline; reviewer agent reviews it.
- [ ] 5.5 **[HUMAN]** I approve and merge. Verify the first (empty/hello-world) deployment works and share the URL.

## Phase 6: Build the Product (dev + reviewer agents)

For each open issue:
- [ ] 6.1 Developer agent picks the issue, creates a branch, implements it with tests, and opens a PR linked to the issue.
- [ ] 6.2 Reviewer agent reviews the PR, runs tests, and requests changes or approves.
- [ ] 6.3 **[HUMAN]** I approve and merge → auto-deploy runs.
- [ ] 6.4 Repeat until all issues are closed.

## Phase 7: Full Automation (GitHub Actions — my role: approve PRs only)

- [ ] 7.1 **[HUMAN]** Create a GitHub App for the agents (permissions: contents, issues, pull requests: read/write). Store its App ID + private key as repo secrets. (Needed because actions using the default GITHUB_TOKEN don't trigger other workflows.)
- [ ] 7.2 **[HUMAN]** Add the Anthropic API key / Claude token as a repo secret.
- [ ] 7.3 Create labels: `spec`, `ready-for-dev`, `needs-human`.
- [ ] 7.4 Create workflows in `.github/workflows/` using the Claude Code Action, each reusing the prompt from the matching `.claude/agents/*.md` and authenticating with the GitHub App token:
  - `agent-architect.yml`: on issue labeled `spec` → write/update spec, create small issues labeled `ready-for-dev`
  - `agent-developer.yml`: on issue labeled `ready-for-dev` → branch, implement, test, open PR linked to issue; also on review "changes requested" → fix and push
  - `agent-reviewer.yml`: on PR opened/updated → review, run tests, approve or request changes
- [ ] 7.5 Safety limits in every agent workflow:
  - `max-turns` limit per run
  - scoped permissions per agent (reviewer can comment but not push)
  - after 3 review rounds on a PR → add label `needs-human` and stop
  - concurrency: one agent run per issue/PR at a time
- [ ] 7.6 Keep branch protection: merge to `main` requires passing CI + MY approval.
- [ ] 7.7 Test end-to-end: I create one small `spec` issue → verify issues, PR, review, and (after my approval) deploy all happen automatically.
- [ ] 7.8 **[HUMAN]** Set up cost monitoring (Anthropic usage + Azure budget) and review after the first week.

## Phase 8: Retrospective

- [ ] 8.1 Review what broke or needed my intervention.
- [ ] 8.2 Update `CLAUDE.md` and the agent prompts with the lessons learned.
