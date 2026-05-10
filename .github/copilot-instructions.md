# Project Guidelines

## Code Style

- TypeScript is the primary language for templjs packages; follow co-located test naming `*.test.ts` as shown in [docs/adr/006-testing.md](../docs/adr/006-testing.md).
- Keep documentation frontmatter aligned to the canonical document schema and backlog artifacts aligned to the canonical work-management schemas under [schemas/work-management/](../schemas/work-management/).

## Architecture

- Monorepo structure uses pnpm workspaces + Nx, with package boundaries across `@templjs/core`, `@templjs/cli`, `@templjs/volar`, `@templjs/context-graph`, `@templjs/language-core`, `@templjs/language-service`, `@templjs/language-server`, and `vscode-templjs`.
- VS Code integration is Volar-based with a thin VS Code client (`vscode-templjs`) delegating language-server startup to `@templjs/language-server`, feature plugins to `@templjs/language-service`, and semantic/runtime authority to `@templjs/core` + `@templjs/context-graph`.
- Treat the Volar target architecture document plus ADR-008 (context graph) and ADR-009 (adapter runtime manifest and plugin boundaries) as implementation anchors for package ownership and adapter-runtime boundaries.
- Migration plan and phase ordering are the source of truth in [migration-plan.md](../migration-plan.md).

## Build and Test

- Install dependencies from the repo root: `rtk pnpm install`.
- Build from the repo root: `rtk pnpm build` (see [migration-plan.md](../migration-plan.md)).
- Testing strategy and locations are defined in [docs/adr/006-testing.md](../docs/adr/006-testing.md).

## Project Conventions

- Backlog artifacts live under [backlog/](../backlog/): active work items in `backlog/active/`, archived work items in `backlog/archive/`, and evidence records in `backlog/records/`.
- Prefer `rtk pnpm run backlog:doc-vader -- ...` for backlog mutations so PR links, evidence records, and archival stay aligned with the canonical `doc-vader` workflow.
- ADRs are in [docs/adr/](../docs/adr/) and are treated as accepted decisions for architecture.
- Documentation files must include document frontmatter and remain schema-valid.
- Branch and release workflow is defined in [docs/release-process.md](../docs/release-process.md).
- CI/CD workflow inventory and required checks are defined in [docs/ci-cd.md](../docs/ci-cd.md).
- Repository layout and naming conventions are defined in [docs/repository-structure.md](../docs/repository-structure.md).
- Contributor PRs that change `src/packages/**` or `src/extensions/vscode/**` must include a `.changeset/*.md` file; the automated version PR on `main` is exempt.
- For versioning, keep `@templjs/core`, `@templjs/cli`, `@templjs/volar`, and `@templjs/context-graph` synchronized; treat `@templjs/language-core`, `@templjs/language-service`, and `@templjs/language-server` as dependent packages aligned through the same release train; `vscode-templjs` remains independently versioned.

## Integration Points

- Volar language server is the primary IDE integration layer and delegates base-format linting/authoring to host language services via virtual code.
- Keep extension-layer code transport-focused (activation, settings, client wiring); keep language-domain behavior in language-service plugins and shared semantic contracts.

## Template Parsing

- Prefer deterministic token-based parsing over regex when validating template statement syntax. Tokenise the inner content once (`split(/\s+/)`, filter empties and whitespace-control markers such as `-`), then check token counts, positions, and keyword equality structurally.
- Reserve regex only for single-token character-class checks (e.g. validating that an already-isolated token is a legal identifier). Never write a multi-token regex that spans an unbounded content string.

## Security

- No project-specific security conventions documented yet; avoid inventing patterns beyond the ADRs/PRD.

## RTK — Token-Optimized CLI

**rtk** is a CLI proxy that filters and compresses command outputs, saving 60-90% tokens.

## Rule

Always prefix shell commands with `rtk`.

```bash
git status                 -> rtk git status
git log -10                -> rtk git log -10
pnpm install               -> rtk pnpm install
pnpm build                 -> rtk pnpm build
pnpm test                  -> rtk pnpm test
npx vsce package           -> rtk npx vsce package
npx vsce publish           -> rtk npx vsce publish
npm publish                -> rtk npm publish
```

## Meta commands

```bash
rtk gain
rtk gain --history
rtk discover
rtk proxy <cmd>
```

## Autonomous Release Guidance

- For release and publishing work, consult the nearest applicable `AGENTS.md` and relevant `SKILL.md` files before making changes.
- Prefer the smallest change that unblocks release or prerelease publication.
- Do not refactor unrelated code during release work.
- Prefer dry runs and packaging verification before any publish attempt.
- Summarize commands run, files changed, versions produced, and blockers remaining.
