# Learnings

One line per lesson: what went wrong → what fixed it / rule to follow. Newest at the bottom.
Agents: read this before starting work, and add to it whenever the owner corrects you or something fails (see `CLAUDE.md` → Learning loop).

- 2026-11-27: `winget install` failed with `0x8a15003b` (msstore source error) → use `--source winget`, or `winget source remove msstore`.
- 2026-11-27: `git push` failed in the agent shell ("could not read Username") → run `gh auth setup-git` once so git uses the gh login.
- 2026-11-27: `/agents` wizard no longer exists → verify agents by checking they're listed as available agent types, or by reading `.claude/agents/`.
- 2026-11-27: MCP servers timed out (30s) on first start while `npx` downloaded them → pre-warm with `npx -y <pkg>@latest --version`, then reconnect via `/mcp`.
- 2026-11-27: `gh api --input` returned "Problems parsing JSON" → PowerShell 5.1 `Set-Content -Encoding utf8` writes a BOM; use `[IO.File]::WriteAllText(path, json, (New-Object System.Text.UTF8Encoding($false)))`.
- 2026-11-27: Migrate image build failed: `tar -xj` needs `bzip2`, which `dotnet/sdk:10.0` doesn't have → install tools a build stage needs explicitly; don't assume they're in the base image.
- 2026-11-27: First deploy failed with `AADSTS700213`: GitHub's OIDC subject now includes owner/repo ids → add a federated credential with the immutable-id subject (see ADR-005).
- 2026-11-27: SETUP_PLAN boxes for Phase 5 were left unticked because ticking was deferred to "a later PR" → tick a step's box in the same PR that completes it (or the PR right after a [HUMAN] step); never defer.
- 2026-11-27: Restore failed with NU1507 (central package management + extra NuGet sources on the dev machine) → the repo `nuget.config` clears sources and uses nuget.org only; don't remove it.
- 2026-11-27: `dotnet test` failed with xunit.v3 4.x ("VSTest target is no longer supported") because 4.x uses Microsoft.Testing.Platform v2 → stay on xunit.v3 3.x + xunit.runner.visualstudio 3.x while CI runs `dotnet test MyTodoApp.slnx` in VSTest mode.
- 2026-11-27: `UseStatusCodePages()` would have broken the deploy smoke test (it accepts `/api/v1/auth/me` only as 401 or an empty-body 404) → check `deploy.yml` smoke expectations before changing response shapes of unmatched routes.
