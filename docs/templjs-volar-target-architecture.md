---
id: volararch-001
type: document
subtype: architecture
lifecycle: active
status: ready
title: TemplJS Volar Target Architecture
---

{% raw %}

## Purpose

This document defines the final editor-tooling architecture for TemplJS.

It is implementation guidance for maintaining projection/provenance semantic authority,
with host-delegated formatting and a thin VS Code transport client.

Existing ADRs remain authoritative strategic anchors:

- [ADR-003: VS Code Architecture (Volar)](adr/003-vscode-architecture.md)
- [ADR-007: Syntax Extensibility and Themes](adr/007-syntax-extensibility.md)
- [ADR-008: Context Graph Platform](adr/008-context-graph.md)

## Source Guidance

Review date: 2026-05-09 (updated post-WI-097–104 completion).

Volar guidance:

- [Volar discussion #53](https://github.com/volarjs/volar.js/discussions/53)
- [Why Volar?](https://volarjs.dev/core-concepts/why-volar/)
- [Embedded Languages](https://volarjs.dev/core-concepts/embedded-languages/)
- [Volar Labs](https://volarjs.dev/core-concepts/volar-labs/)
- [Your First Volar Language Server](https://volarjs.dev/guides/first-server/)
- [File Structure](https://volarjs.dev/guides/file-structure/)
- [Languages](https://volarjs.dev/reference/languages/)
- [Services](https://volarjs.dev/reference/services/)

Reference architectures:

- [Vue SFC docs](https://vuejs.org/guide/scaling-up/sfc.html)
- [vuejs/language-tools](https://github.com/vuejs/language-tools)
- [Svelte `.svelte` file docs](https://svelte.dev/docs/svelte/svelte-files)
- [sveltejs/language-tools](https://github.com/sveltejs/language-tools)
- [Astro component docs](https://docs.astro.build/en/basics/astro-components/)
- [withastro/language-tools](https://github.com/withastro/language-tools)

Key lessons:

- Volar expects language definitions to create and update `VirtualCode` objects.
- Embedded language support should be expressed as explicit `embeddedCodes`, not as
  editor-specific request handling.
- Services provide LSP features through Volar's service-plugin API.
- Volar Labs should be used to inspect projects, generated virtual files, virtual
  source maps, and TypeScript memory usage.
- Vue and Astro split language-core, language-server, TypeScript integration, and VS
  Code client concerns.
- Svelte demonstrates the same principle without Volar: parse component files into an
  internal document model, then route HTML, CSS, TypeScript, diagnostics, and editor
  features through focused services.

## Target Architecture

TemplJS should use a Volar-style split:

```text
vscode-templjs
  -> @templjs/language-server
    -> @volar/language-server
    -> @templjs/language-core
    -> @templjs/language-service
      -> @templjs/core
      -> @templjs/context-graph
      -> host-language services
```

### Package Responsibilities

`@templjs/core`

- Owns template syntax parsing, delimiter interpretation, statement semantics, scope
  extraction, semantic zones, renderer behavior, and schema-independent syntax facts.
- Provides reusable parse and semantic APIs for CLI, Volar services, diagnostics,
  completion, hover, and definition.
- Does not depend on Volar or VS Code packages.
- Applies parser/binder layering rules:
  - parser and grammar logic define syntax truth only
  - binding behavior is defined declaratively from parsed node kinds
  - imperative semantic hooks are used only for runtime-dependent behavior (schema-derived symbols, iterable coercion, and mapping edge cases)
  - local variable bindings and schema contract references remain separate concepts

`@templjs/context-graph`

- Owns the shared semantic query substrate.
- Publishes document facts from template parse results, schema sources, host-language
  zones, frontmatter metadata, and future extraction providers.
- Exposes package-owned, JSON-compatible query contracts, following ADR-008.
- Does not leak Volar, TypeScript, VS Code, or third-party schema types through public
  contracts.

`@templjs/language-core`

- Owns Volar language plugins and `VirtualCode` generation.
- Parses a source document once through `@templjs/core` and stores document metadata on
  the root virtual code.
- Generates explicit embedded virtual documents with source maps:
  - host document: markdown, JSON, YAML, HTML, or plaintext with template syntax masked
    into host-valid placeholders
  - template DSL document: template statements and expressions for TemplJS-only
    diagnostics and navigation
  - semantic generated document: TypeScript or TSX-like generated code only when needed
    for type-aware expression services
  - frontmatter document: YAML or JSON metadata when a host format has a frontmatter
    zone
  - host sub-documents such as HTML scripts/styles only when required by host services
- Owns source-to-generated and generated-to-source mapping contracts and tests.

`@templjs/language-service`

- Owns Volar service plugins for TemplJS language features.
- Registers completion, hover, definition, diagnostics, formatting hooks, semantic
  tokens, document symbols, and schema-driven features through Volar services.
- Uses `@templjs/core` and `@templjs/context-graph` as semantic authority.
- Uses host-language services for host formats instead of duplicating markdown, YAML,
  JSON, HTML, CSS, or TypeScript semantics.

`@templjs/language-server`

- Owns server startup, Volar project creation, TypeScript SDK loading, file watching,
  service-plugin registration, diagnostics orchestration, and workspace configuration.
- Exposes a server entrypoint usable by VS Code and other LSP clients.
- Treats settings and initialization options as transport configuration, not semantic
  provider APIs.

`vscode-templjs`

- Owns activation, configuration collection, client transport, marketplace metadata,
  commands, and VS Code-specific wiring.
- Does not parse template syntax, create service plugins, load schemas for semantic
  decisions, or register custom completion/hover/definition handlers outside normal
  language-client plumbing.

### Raw-Text Exception Contract

Authoritative template syntax and statement semantics must come from shared parser-backed
core and language-service layers. Raw-text scanning is allowed only for non-semantic
responsibilities.

Allowed raw-text exceptions:

- delimiter token validation and normalization preflight
- virtual-code masking and range or offset preservation
- TextMate grammar and syntax-highlighting plumbing
- transport-level URI/document routing, request mapping, and caching

Disallowed raw-text behavior:

- regex or ad hoc parsing that infers alias scope, statement structure, iterable
  expressions, or binding semantics from template source text
- server-side semantic interpretation that duplicates core or Volar semantic authority

### Target Data Flow

1. VS Code starts the language server and passes workspace/configuration data.
2. The language server creates a Volar project with TemplJS language plugins and
   service plugins.
3. `@templjs/language-core` creates a root `TempljsVirtualCode` per source file.
4. The root virtual code stores parsed syntax facts and emits embedded virtual
   documents for host language, template DSL, semantic generated code, and frontmatter.
5. `@templjs/language-service` services answer LSP requests through Volar by consulting
   virtual documents, `@templjs/core`, and `@templjs/context-graph`.
6. Host-language services operate on the host embedded documents and return mapped
   diagnostics/features through Volar.
7. Volar maps generated positions back to original source positions.

### Target Virtual Code Shape

Root virtual code:

- `id`: `root`
- `languageId`: source TemplJS language id, not the host language id
- `snapshot`: original source snapshot
- `mappings`: identity mapping over the source document
- `embeddedCodes`: explicit generated documents
- `metadata`: package-owned document metadata, including host language, source file
  kind, delimiter config, semantic zones, schema source hints, parse diagnostics, and
  context graph snapshot id

Embedded host virtual code:

- `id`: `host.<language>`
- `languageId`: `markdown`, `json`, `yaml`, `html`, or `plaintext`
- `snapshot`: host-valid document with template syntax masked or replaced
- `mappings`: source-preserving mappings for all host-owned content
- `purpose`: `host-delegation`

Embedded template DSL virtual code:

- `id`: `templjs.dsl`
- `languageId`: `templjs`
- `snapshot`: normalized template statements and expressions
- `mappings`: mappings from DSL spans to original template spans
- `purpose`: `template-semantics`

Embedded semantic generated code:

- `id`: `templjs.semantic.ts`
- `languageId`: `typescript` or `typescriptreact`
- `snapshot`: generated type-aware expression program if needed
- `mappings`: expression-level source maps
- `purpose`: `type-semantics`

Embedded frontmatter code:

- `id`: `frontmatter.yaml` or `frontmatter.json`
- `languageId`: `yaml` or `json`
- `snapshot`: frontmatter-only text

- `mappings`: exact frontmatter range mappings
- `purpose`: `metadata-validation`

## Implementation Status

The architecture described in this document is now the active baseline for the
TemplJS editor stack.

Current repository expectations:

- projection/runtime contracts are the semantic authority for editor features,
- Volar/language-service layers shape LSP payloads and coordinate transport,
- language-server owns capability wiring and request orchestration,
- VS Code extension remains transport/configuration focused,
- formatting remains host delegated.

## Public Surface Expectations

- Public semantic kinds should use projection-native namespaces (for example,
  `templjs.schema-path`, `templjs.schema-enum-value`) without legacy compatibility
  remapping.
- Semantify public exports should remain projection/profile contract focused.
- Context-graph payloads must remain JSON-compatible and must not leak Volar,
  TypeScript, VS Code, or validator implementation types.

## Formatting Boundary

- Formatting edit generation remains host delegated through host adapters (for example,
  `templjs-prettier-host`) and must follow workspace formatter selection/settings.
- Semantic orchestration for formatting is limited to deterministic handoff metadata,
  currently represented by the `templjs.authoring.formatting` helper-extension contract.
- Semantify core must not encode formatter-specific policy, style rules, or edit logic.

## Validation

Documentation linting:

```bash
rtk pnpm run lint:markdown:docs
rtk pnpm run lint:frontmatter
```

Repository validation for architecture conformance:

```bash
rtk pnpm run type-check
rtk pnpm run test
rtk pnpm run build
```

Required verification scenarios:

- Root and embedded virtual files remain inspectable with correct source-map round-trips.
- Host-language diagnostics map to original source ranges.
- Completion, hover, definition, diagnostics, and semantic tokens stay projection-backed.
- Host formatting remains delegated and respects workspace formatter settings.

## Maintenance Rules

- Keep semantic policy in shared semantic packages, not transport clients.
- Avoid introducing migration or compatibility fallback guidance in this architecture doc.
- Prefer additive ADR updates for future architectural changes rather than reintroducing
  phased migration runbooks here.

{% endraw %}
