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

This document defines the target editor-tooling architecture for TemplJS and the staged
migration from the current implementation. It is written for an AI agent that will
execute the migration.

The target intentionally disregards compatibility constraints for the current
`@templjs/volar` exports and `vscode-templjs` initialization shape. Existing ADRs remain
authoritative strategic anchors:

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

## Current Implementation Audit

**Status**: ✅ COMPLETED. This section documents the target architecture and migration requirements that were addressed in WI-097 through WI-104 (archived 2026-05-06). The findings below are **historical** and describe the state as-of 2026-05-01. Current implementation now follows the target architecture outlined in "Target Architecture" section above.

### `src/packages/volar/src/index.ts`

**Status**: ✅ COMPLETE — Virtual code model migrated (WI-100).

As-is (historical):

- `TempljsVirtualCode` uses `id = 'root'`.
- Root `languageId` is set to the detected host language, such as `markdown`, `json`,
  `yaml`, or `html`.
- Template syntax is stripped or whitespace-masked directly into the root virtual code.
- `embeddedCodes` exists but is always empty.
- Source mappings are generated from local text masking instead of a parser-owned
  document model.

Required change:

- Replace root-as-host virtual code with a root TemplJS virtual code plus explicit
  embedded virtual documents.
- Move host-language masking into a `host.<language>` embedded code.
- Add `templjs.dsl`, frontmatter, and optional semantic generated code embeddings.
- Store parse results, delimiter config, semantic zones, and context graph snapshot
  metadata on the root virtual code.
- Build mappings from `@templjs/core` parse/token ranges where possible.

Why required:

- Volar's embedded-language model is based on virtual code trees. Root-only host
  masquerading hides the real source language, makes Volar Labs less useful, and
  prevents services from cleanly targeting host versus template semantics.
- Vue and Astro both model source files as root framework documents with embedded
  language documents rather than rewriting the root as one host language.

How to make it:

- Introduce `TempljsRootVirtualCode`, `TempljsEmbeddedVirtualCode`, and
  `TempljsVirtualDocumentMetadata` in `@templjs/language-core`.
- Make `createVirtualCode()` return undefined for non-TemplJS source language ids and
  return a root virtual code for TemplJS files.
- Implement `onSnapshotUpdated()` to parse once, regenerate embedded documents, and
  publish metadata.
- Keep incremental update optimization only after full-regeneration mappings are
  correct and covered by tests.

### `src/extensions/vscode/src/server.ts`

**Status**: ✅ COMPLETE — Server moved to @templjs/language-server (WI-099).

As-is (historical):

- The VS Code extension package contains the language server implementation.
- It creates the Volar connection/server and initializes language/service plugins.
- It manually registers completion, hover, definition, and formatting handlers after
  `server.initialize()`.
- It overrides capabilities in the initialization result.
- It contains debug inspection helpers against Volar internals.

Required change:

- Move server creation and request routing into `@templjs/language-server`.
- Let Volar service plugins provide authoring features through normal service methods.
- Keep only a server binary/import entrypoint in the extension package if needed for
  bundled VS Code distribution.
- Remove manual completion, hover, definition, and formatting handlers once service
  plugins expose those capabilities.

Why required:

- The server is a reusable LSP product surface, not a VS Code implementation detail.
- Manual request forwarding duplicates Volar's service pipeline and makes capability
  ownership unclear.
- Svelte, Vue, and Astro all keep the editor client separate from reusable server logic.

How to make it:

- Create a `startTempljsLanguageServer()` function in `@templjs/language-server`.
- Create a small `bin/templjs-language-server.js` entrypoint with `--version` support.
- Move `serverOptions`, project initialization, file watching, and service registration
  into that package.
- Use integration tests to assert that the VS Code extension starts the server but does
  not own feature handlers.

### `src/extensions/vscode/src/service-plugins.ts`

**Status**: ✅ COMPLETE — Service plugins moved to @templjs/language-service (WI-099, WI-101).

As-is (historical):

- The VS Code extension package builds TemplJS service plugins.
- It resolves source files through Volar context internals.
- It loads schema sources synchronously for completions and diagnostics.
- It creates YAML validation services and markdown-frontmatter diagnostics locally.
- It decides which diagnostics should run for TemplJS, markdown, and YAML documents.

Required change:

- Move service plugin creation to `@templjs/language-service` or
  `@templjs/language-server`.
- Move schema-source resolution and schema fact publication into shared service/server
  layers.
- Use Volar host-language services for YAML, JSON, HTML, markdown, CSS, and TypeScript
  where possible.
- Keep VS Code-specific code limited to passing settings and workspace information to
  the server.

Why required:

- Service composition is editor-independent. Keeping it in `vscode-templjs` prevents
  reuse by other LSP clients and makes semantic behavior depend on VS Code packaging.
- Schema and frontmatter behavior is semantic behavior and must be available to CLI,
  tests, and future extraction workflows.

How to make it:

- Export `createTempljsServicePlugins(options)` from `@templjs/language-service`.
- Define a package-owned schema resolver interface that accepts workspace, document,
  and initialization settings.
- Publish schema facts to `@templjs/context-graph` and let completion/diagnostic
  providers query the graph.
- Replace local YAML diagnostics with a host YAML service mounted on the frontmatter
  embedded code.

### `src/packages/volar/src/diagnostic-provider.ts`

**Status**: ✅ COMPLETE — Diagnostics refactored to use context-graph facts (WI-102).

As-is (historical):

- Diagnostics extract blocks and detect unclosed delimiters with local scanners.
- Statement tags, filters, variable references, and scope paths are interpreted in
  Volar-layer code.
- Some helper paths use `@templjs/core`, but syntax interpretation is split across
  packages.

Required change:

- Route diagnostics through `@templjs/core` parser and semantic helpers first.
- Use context graph facts for schema-aware path diagnostics, frontmatter/content zone
  selection, and alias resolution.
- Keep Volar diagnostic provider code limited to converting shared diagnostic facts
  into LSP diagnostic payloads and mapping ranges.

Why required:

- ADR-007 and local package guardrails require one syntax authority.
- Duplicate scanners are likely to drift under custom delimiters and future syntax
  themes.

How to make it:

- Add or expose missing parser/semantic facts in `@templjs/core` before adding new
  Volar-specific scanning.
- Define a shared diagnostic model with stable codes and source ranges.
- Convert shared diagnostics to Volar/LSP diagnostics in `@templjs/language-service`.
- Delete Volar-local syntax scanners after equivalent shared tests pass.

### `src/packages/volar/src/intellisense-provider.ts`

**Status**: ✅ COMPLETE — IntelliSense refactored to use context-graph facts (WI-102).

As-is (historical):

- Completion, hover, and definition use local text extraction for expressions,
  filters, aliases, frontmatter context, and path prefixes.
- Context graph integration exists, but local fallback semantic logic remains broad.
- Provider APIs expose editor-oriented behavior directly from `@templjs/volar`.

Required change:

- Move expression, alias, zone, schema, and definition semantics behind
  `@templjs/core` and `@templjs/context-graph`.
- Keep the language service provider responsible for LSP item shaping only.
- Split completion sources into template keywords, filters, schema paths, enum values,
  local aliases, document definitions, and host-language delegated completions.

Why required:

- Completion/hover/definition must agree with diagnostics and rendering semantics.
- Context graph exists specifically to avoid feature-specific resolvers and context
  heuristics.

How to make it:

- Build a semantic snapshot from the root virtual code parse result.
- Publish snapshot facts to context graph on document update.
- Query context graph from providers by operation, semantic zone, source range, and
  document URI.
- Keep local text-prefix logic only for non-semantic completion filtering after the
  semantic candidate set has been computed.

### `src/extensions/vscode/src/schema-loading.ts`

As-is:

- Schema loading, dereferencing, inline directive parsing, root property extraction,
  glob matching, and sync URL loading live in the VS Code extension package.

Required change:

- Split this into shared schema-source resolution and editor transport configuration.
- Move semantic schema resolution into language service/server code.
- Keep VS Code responsible only for reading user settings and forwarding them.

Why required:

- Schemas affect completions, diagnostics, definitions, and future extraction. They are
  not VS Code-only behavior.

How to make it:

- Create shared schema-source utilities in a package used by language service and CLI.
- Publish schema-source facts and loaded schema metadata to context graph.
- Preserve URL/file timeout and cache behavior in the server layer.

### `src/extensions/vscode/src/extension.ts`

As-is:

- The client is mostly thin, but includes middleware logging, active document context,
  file watchers, settings collection, and user-facing activation messages.

Required change:

- Keep settings collection, language client startup, output channel logging, and
  commands in VS Code.
- Remove semantic document context shaping once the language server can resolve schemas
  and document state through workspace/project services.
- Do not add syntax parsing, schema loading, or service plugin creation here.

Why required:

- `vscode-templjs` should remain replaceable by any LSP client.

How to make it:

- Point server module to the language-server package entrypoint or bundled output.
- Pass initialization options and dynamic configuration only.
- Keep middleware strictly for logging and test instrumentation.

## Breaking Public API Changes

Replace the current primary integration surface:

```ts
createTempljsLanguagePlugin(options);
```

with explicit factories:

```ts
createTempljsLanguagePlugins(options): LanguagePlugin[]
createTempljsServicePlugins(options): ServicePlugin[]
startTempljsLanguageServer(options): Promise<void> | void
```

The implementation may expose these from new packages:

- `@templjs/language-core`
- `@templjs/language-service`
- `@templjs/language-server`

If the repository keeps `@templjs/volar`, it should become a transitional aggregate
package only. The target architecture does not rely on `@templjs/volar` as the main
public API.

### Package-Owned Types

Define package-owned interfaces for these concepts:

- `TempljsSourceFileKind`
- `TempljsHostLanguage`
- `TempljsGeneratedCodePurpose`
- `TempljsVirtualDocumentMetadata`
- `TempljsSemanticZoneRef`
- `TempljsSchemaSourceRef`
- `TempljsDocumentSnapshotId`
- `TempljsLanguageServerInitializationOptions`

Public context graph payloads must be JSON-compatible and must not expose Volar,
TypeScript, VS Code, YAML, JSON Schema validator, or language-service classes.

## Migration Stages

### Stage 1: Establish Target Contracts

Tasks:

- Create package-owned metadata types for source kind, host language, generated-code
  purpose, schema sources, semantic zones, and snapshot ids.
- Add tests that assert public context graph and language-core contract payloads do
  not leak third-party types.
- Document the server/client boundary in package READMEs after code lands.

Acceptance criteria:

- The target contracts compile independently of VS Code extension source.
- Contract tests fail if public context graph APIs expose third-party types.
- No source behavior changes are required in this stage.

### Stage 2: Split Language Core From Server and Client

Tasks:

- Move virtual code creation from `src/packages/volar/src/index.ts` into the new
  language-core layer.
- Move service plugin creation from `src/extensions/vscode/src/service-plugins.ts`
  into the language-service layer.
- Move server startup from `src/extensions/vscode/src/server.ts` into the
  language-server layer.
- Keep thin forwarding shims only until the new package entrypoints are wired.

Acceptance criteria:

- `vscode-templjs` starts the language server through a package entrypoint.
- Other LSP clients can theoretically execute the same server entrypoint.
- No service plugin factory is implemented under `src/extensions/vscode/src/**`.

### Stage 3: Replace Root-Only Virtual Code

Tasks:

- Implement `TempljsRootVirtualCode` with source identity mappings.
- Generate `host.<language>` embedded code for markdown, JSON, YAML, HTML, and
  plaintext templates.
- Generate `templjs.dsl` embedded code with exact mappings for statements and
  expressions.
- Generate frontmatter embedded code for markdown/YAML frontmatter zones.
- Add semantic generated TypeScript or TSX-like code only where type-aware expression
  services need it.

Acceptance criteria:

- Volar Labs shows root plus embedded virtual files.
- Host diagnostics map back to original template files.
- Template diagnostics map to template syntax spans, not placeholder spans.
- Tests cover multiline mappings, custom delimiters, host language detection, and
  generated-to-source round trips.

### Stage 4: Move Host-Language Services To Server Composition

Tasks:

- Register host services in language-server/service composition, not in the VS Code
  package.
- Prefer existing Volar services for host languages where practical.
- Route YAML/frontmatter validation through the frontmatter embedded document.
- Route markdown, JSON, YAML, and HTML diagnostics through host virtual documents.

Acceptance criteria:

- Service plugin registration is visible from the language-server package.
- `src/extensions/vscode/src/service-plugins.ts` is deleted or reduced to a temporary
  compatibility shim.
- Host diagnostics do not need source-document special cases in VS Code code.

### Stage 5: Route Semantics Through Core and Context Graph

Tasks:

- Publish parse, scope, alias, schema, frontmatter, and host-zone facts to
  `@templjs/context-graph`.
- Replace Volar-local semantic scanners with core parse/semantic APIs.
- Rebuild completion, hover, definition, and diagnostics as context graph consumers.
- Preserve provider-local logic only for LSP shaping, candidate filtering, and
  presentation.

Acceptance criteria:

- Completion, hover, definition, and diagnostics resolve paths through the same
  semantic snapshot.
- Default delimiters and at least one custom delimiter configuration pass the same
  feature suites.
- No new regex-based template parsing is introduced in Volar or VS Code layers.

### Stage 6: Thin The VS Code Client

Tasks:

- Remove manual completion, hover, definition, and formatting handlers from the VS Code
  server wrapper after services own those capabilities.
- Keep client middleware only for logging and test instrumentation.
- Keep settings collection and dynamic configuration forwarding in the client.
- Remove semantic active-document content hacks once server-side document/project state
  supplies schema resolution.

Acceptance criteria:

- `vscode-templjs` owns activation, settings, commands, output channels, and client
  lifecycle only.
- Extension integration tests assert that features come from the language server.
- No syntax-aware code lives in `src/extensions/vscode/src/**`.

### Stage 7: Delete Transitional Code

Tasks:

- Delete root-only host virtual code generation.
- Delete duplicated position-mapping utilities that are superseded by language-core
  mappings.
- Delete VS Code-local schema semantic resolution.
- Delete broad text scanners in diagnostics/intellisense once core/context graph
  equivalents exist.
- Update docs, ADR references, package READMEs, and tests.

Acceptance criteria:

- All feature tests pass through the new architecture.
- Volar Labs inspection is documented and verified for representative template files.
- The codebase has one parser/semantic authority for template syntax.

## Test Plan

Validation commands for this document:

```bash
rtk pnpm run lint:markdown:docs
rtk pnpm run lint:frontmatter
```

Migration validation commands should include:

```bash
rtk pnpm --filter @templjs/core test
rtk pnpm --filter @templjs/context-graph test
rtk pnpm --filter @templjs/language-core test
rtk pnpm --filter @templjs/language-service test
rtk pnpm --filter @templjs/language-server test
rtk pnpm --filter vscode-templjs test
rtk pnpm run type-check
```

Required scenarios:

- Volar Labs can inspect root and embedded virtual files.
- Volar Labs shows correct virtual source maps for host, template DSL, and frontmatter
  virtual documents.
- Host-language diagnostics map back to original source ranges.
- Template diagnostics map to template syntax ranges.
- Completion works for schema paths, enum values, filters, keywords, and loop aliases.
- Hover and definition use the same context graph snapshot as completion and
  diagnostics.
- Default delimiters and one custom delimiter configuration pass equivalent feature
  suites.
- Extension tests prove the VS Code client is thin and does not implement template
  semantics.

## Agent Execution Rules

- Follow nearest `AGENTS.md` instructions before editing code.
- Do not modify config files without explicit consent.
- Do not manually edit package versions.
- Use changesets if implementation work changes published package behavior.
- Keep migration PRs staged and reviewable:
  - contracts first
  - language-core virtual code second
  - service/server split third
  - context graph semantic migration fourth
  - VS Code thinning fifth
  - deletion cleanup last
- Never add new syntax semantics to `src/extensions/vscode/src/**`.
- Add or expose missing syntax facts in `@templjs/core` before implementing editor
  feature logic.
- Use Volar Labs screenshots or documented inspection notes as acceptance evidence for
  virtual file and source-map changes.

{% endraw %}
