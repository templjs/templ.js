# @templjs/language-core

Package-owned language-core contracts for TemplJS editor tooling.

## Boundary

- Owns package contracts for virtual document metadata and semantic references.
- Does not depend on VS Code extension implementation modules.
- Public payloads are JSON-compatible and free of Volar/TypeScript/VS Code type leakage.
