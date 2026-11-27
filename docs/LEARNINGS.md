# Learnings

One line per lesson: what went wrong → what fixed it / rule to follow. Newest at the bottom.
Agents: read this before starting work, and add to it whenever the owner corrects you or something fails (see `CLAUDE.md` → Learning loop).

- 2026-11-27: `winget install` failed with `0x8a15003b` (msstore source error) → use `--source winget`, or `winget source remove msstore`.
- 2026-11-27: `git push` failed in the agent shell ("could not read Username") → run `gh auth setup-git` once so git uses the gh login.
- 2026-11-27: `/agents` wizard no longer exists → verify agents by checking they're listed as available agent types, or by reading `.claude/agents/`.
- 2026-11-27: MCP servers timed out (30s) on first start while `npx` downloaded them → pre-warm with `npx -y <pkg>@latest --version`, then reconnect via `/mcp`.
- 2026-11-27: `gh api --input` returned "Problems parsing JSON" → PowerShell 5.1 `Set-Content -Encoding utf8` writes a BOM; use `[IO.File]::WriteAllText(path, json, (New-Object System.Text.UTF8Encoding($false)))`.
- 2026-11-27: Migrate image build failed: `tar -xj` needs `bzip2`, which `dotnet/sdk:10.0` doesn't have → install tools a build stage needs explicitly; don't assume they're in the base image.