# vscode-templjs

## 0.1.0

### Added

- implement JSON Schema validation and inference (4a38b95)
- WI-012 Build Volar Language Server Plugin (#3)
- WI-028 TextMate grammar with embedded language support (#10)
- add WI-034 pre-release coverage quality gate work item (6f2a5fb)
- add experimental stream-json input parsing (9226bf4)
- enhance templjs with frontmatter support and variable resolution (92c83eb)
- integrate context graph into semantic reads (91d942c)
- complete graph-backed semantic resolution (cb3f6a0)
- add .tmpl language associations and YAML scalar tokenization (f276da3)
- implement parser-authority scope semantics (WI-062) (8d27b20)
- add deterministic repo benchmark harness (3a59ae9)
- add whitespace controls and fixture parity (78e0adf)

### Fixed

- add watchdog test runners and stabilize pre-push (06fc91a)
- surface language client startup failures (db623c1)
- avoid rethrow in startup catch (8ddf67c)
- export explicit schema-loading default module (936dffa)
- normalize schema pattern paths (18a1112)
- address CodeRabbit feedback for PR #31 (174144e)
- address second round of CodeRabbit feedback for PR #31 (250b796)
- reload schema-aware diagnostics on schema file changes (WI-054, WI-055) (13a7f34)
- harden watched-file diagnostics behavior (76f29ab)
- avoid schema-watch false positives for template files (02cf127)
- harden watch mode and vscode server handling (dc2cdbd)
- normalize watch output and extension wiring (54f33cc)
- cache URL schemas and complete WI-054 docs/tests (f944e22)
- satisfy schema-loading coverage gate (d89e404)
- drop manual package version edits from PR (9774b94)
- add extension license and document marketplace pre-release constraint (ab85aa3)
- realign publish state to v0.1.0 (97a86dd)

### Changed

- consolidate test files into aligned test/ directories (f0cc295)
- extract middleware result helper functions (7fd7e12)
- cache schema loads and skip redundant reloads (1ac385d)
- optimize schema resolution and semantic caches (8ab845c)

### Maintenance

- refactor and expand test suites for core/volar (2811644)
- add comprehensive renderer, filter, and variable resolver edge case tests (5d8f77f)
- mark WI-007 reconciliation complete in tracking plan (039333d)
- expand activation and server lifecycle tests (cbc5241)
- update vitest coverage thresholds after WI-031 run (5d43763)
- exclude direct execution bootstrap from coverage (54fd671)
- use pathToFileURL for mock definition URIs (3eef8cb)
- wait deterministically for diagnostics (83e571f)
- clarify schemaPatterns setting example (ab6bf79)
- refresh supported template extensions (b1a8438)
- harden activation coverage (74e7070)
- restore schema-loading coverage (0a242cf)
- align WI-034 coverage policy to ADR-006 (03014dc)
- raise strict WI-034 branch coverage (30196db)
- named constant for file change type and exact extensions assertion (d1d60f9)
- replace watched-file change-type magic number (cb2b90e)
- schedule fake timers before didOpen (aaa4a48)
- verify schema reload after watched changes (2fc1390)
- cover server reload edge cases (a0350af)
- align workflows and node toolchain for release cleanup (9414cba)
- stabilize cli watch and vscode trace assertions (f8a7852)
- stabilize remaining PR feedback items (ecedb15)
- normalize integration file URIs (7058a09)
- normalize server unit test file uris (31a40dd)
- stabilize windows path and signal handling assertions (d3d47be)
- align ci label and cross-platform test typing (b60e1da)
- cover HTTP schema non-ok responses (8093bd4)
- validate markdown host-language activation matrix (aa6dec7)
- bump minimatch from 9.0.5 to 9.0.7 (2c737e6)
- complete WI-022 repo-side v1.0 prep (a875ccb)
- apply changeset for v1.0.0 via automation (d887fa4)
- align versioning guidance and set v1.0.0-beta.1 (2a76121)
- complete critical-path groups 1-3 (41e62b1)

### Dependencies

- Bundled with `@templjs/core@0.1.0`
- Bundled with `@templjs/volar@0.1.0`
