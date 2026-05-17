# regexfight

## Agent skills

### Issue tracker

Issues live as markdown files under `.scratch/<feature>/` in this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context: `CONTEXT-MAP.md` at the root points to per-context `CONTEXT.md` files. See `docs/agents/domain.md`.

## ADRs

ADRs live in `docs/adr/` (system-wide) and `src/<context>/docs/adr/` (per-context). Filename `NNNN-<slug>.md` and header `# ADR-NNNN (<context>): ...` must match — files 0003–0006 under `src/view/docs/adr/` have an off-by-one bug; do not propagate it.

## Lint

`npm run lint` includes `.claude/worktrees/` (old worktrees, ~50 false errors). For PR-scoped lint use `npx eslint <files>`. CI runs in a fresh checkout so these don't fail there.
