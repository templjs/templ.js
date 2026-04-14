# Project Guidelines

## Code Style

- TypeScript is the primary language for templjs packages; follow co-located test naming `*.test.ts` as shown in [docs/adr/006-testing.md](docs/adr/006-testing.md).
- Keep documentation frontmatter aligned to [schemas/frontmatter/document.json](schemas/frontmatter/document.json) and backlog artifacts aligned to the canonical work-management schemas under [schemas/work-management/](schemas/work-management/).

## Architecture

- Monorepo structure uses pnpm workspaces + Nx, with packages for core, CLI, Volar plugin, and VS Code extension as documented in [docs/adr/005-monorepo.md](docs/adr/005-monorepo.md).
- VS Code integration is Volar-based with virtual code mapping and base-format delegation per [docs/adr/003-vscode-architecture.md](docs/adr/003-vscode-architecture.md).
- Migration plan and phase ordering are the source of truth in [MIGRATION_PLAN.md](MIGRATION_PLAN.md).

## Build and Test

- Install dependencies from the repo root: `pnpm install`.
- Build from the repo root: `pnpm build` (see [MIGRATION_PLAN.md](MIGRATION_PLAN.md)).
- Testing strategy and locations are defined in [docs/adr/006-testing.md](docs/adr/006-testing.md).

## Project Conventions

- Backlog artifacts live under [backlog/](backlog/): active work items in `backlog/active/`, archived work items in `backlog/archive/`, and evidence records in `backlog/records/`.
- Prefer `pnpm run backlog:doc-vader -- ...` for backlog mutations so PR links, evidence records, and archival stay aligned with the canonical `doc-vader` workflow.
- ADRs are in [docs/adr/](docs/adr/) and are treated as accepted decisions for architecture.
- Documentation files must include document frontmatter and remain schema-valid.
- Branch and release workflow is defined in [docs/release-process.md](docs/release-process.md).
- CI/CD workflow inventory and required checks are defined in [docs/ci-cd.md](docs/ci-cd.md).
- Repository layout and naming conventions are defined in [docs/repository-structure.md](docs/repository-structure.md).
- Contributor PRs that change `src/packages/**` or `src/extensions/vscode/**` must include a `.changeset/*.md` file; the automated version PR on `main` is exempt.

## Integration Points

- Volar language server is the primary IDE integration layer; it delegates base-format linting to VS Code language servers per [docs/adr/003-vscode-architecture.md](docs/adr/003-vscode-architecture.md).

## Security

- No project-specific security conventions documented yet; avoid inventing patterns beyond the ADRs/PRD.

## RTK — Token-Optimized CLI

**rtk** is a CLI proxy that filters and compresses command outputs, saving 60-90% tokens.

## Rule

Always prefix shell commands with `rtk`:

```bash
# Instead of:              Use:
git status                 rtk git status
git log -10                rtk git log -10
cargo test                 rtk cargo test
docker ps                  rtk docker ps
kubectl get pods           rtk kubectl pods
```

## Meta commands (use directly)

```bash
rtk gain              # Token savings dashboard
rtk gain --history    # Per-command savings history
rtk discover          # Find missed rtk opportunities
rtk proxy <cmd>       # Run raw (no filtering) but track usage
```
