# Project Guidelines

## Code Style

- TypeScript is the primary language for templjs packages; follow co-located test naming `*.test.ts` as shown in [docs/adr/006-testing.md](docs/adr/006-testing.md).
- Keep documentation frontmatter aligned to schemas in [schemas/frontmatter/document.json](schemas/frontmatter/document.json) and work items aligned to [schemas/frontmatter/work-item.json](schemas/frontmatter/work-item.json).

## Architecture

- Monorepo structure uses pnpm workspaces + Nx, with packages for core, CLI, Volar plugin, and VS Code extension as documented in [docs/adr/005-monorepo.md](docs/adr/005-monorepo.md).
- VS Code integration is Volar-based with virtual code mapping and base-format delegation per [docs/adr/003-vscode-architecture.md](docs/adr/003-vscode-architecture.md).
- Migration plan and phase ordering are the source of truth in [MIGRATION_PLAN.md](MIGRATION_PLAN.md).

## Build and Test

- Install dependencies from the repo root: `pnpm install`.
- Build from the repo root: `pnpm build` (see [MIGRATION_PLAN.md](MIGRATION_PLAN.md)).
- Testing strategy and locations are defined in [docs/adr/006-testing.md](docs/adr/006-testing.md).

## Project Conventions

- Work items live in [backlog/](backlog/) and are authoritative; update their frontmatter status as work progresses.
- ADRs are in [docs/adr/](docs/adr/) and are treated as accepted decisions for architecture.
- Documentation files must include document frontmatter and remain schema-valid.

## Integration Points

- Volar language server is the primary IDE integration layer; it delegates base-format linting to VS Code language servers per [docs/adr/003-vscode-architecture.md](docs/adr/003-vscode-architecture.md).

## Security

- No project-specific security conventions documented yet; avoid inventing patterns beyond the ADRs/PRD.
