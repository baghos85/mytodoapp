# Learnings

One line per lesson: what went wrong → what fixed it / rule to follow. Newest at the bottom.
Agents: read this before starting work, and add to it whenever the owner corrects you or something fails (see `CLAUDE.md` → Learning loop).

- 2026-11-27: `winget install` failed with `0x8a15003b` (msstore source error) → use `--source winget`, or `winget source remove msstore`.
- 2026-11-27: `git push` failed in the agent shell ("could not read Username") → run `gh auth setup-git` once so git uses the gh login.
