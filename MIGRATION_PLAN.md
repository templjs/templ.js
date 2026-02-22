---
id: migration-plan
type: document
subtype: roadmap
lifecycle: active
status: ready
title: 'templ.js v1.0 - Implementation Timeline'
---

**Status**: ✅ PLANNING PHASE COMPLETE  
**Scope**: Full ground-up rewrite as TypeScript implementation  
**Target Release**: 8 weeks from starting Phase 1

---

## 📋 Foundation

All planning artifacts are committed and stable:

- **Architecture**: 7 ADRs in [docs/adr/](docs/adr/) covering language selection, parser, VS Code architecture, branding, monorepo, and testing
- **Requirements**: [v1.0 PRD](docs/prd/v1.0-requirements.md) with functional/non-functional requirements, user personas, success metrics, and timeline
- **Work Items**: 28 items in [backlog/](backlog/) with individual goals, tasks, acceptance criteria, and dependencies

---

## 🚀 8-Week Timeline

### Phase 1: Infrastructure (Weeks 1-2)

**Deliverable**: Foundation for all downstream work  
**Effort**: 23 hours

**Work Items**:

- [[001 Create GitHub Organization]]
- [[002 Initialize Monorepo]]
- [[024 Work Item Guardrails]]
- [[026 CI/CD Scaffolding]]
- [[003 Setup GitHub Actions CI/CD]]
- [[004 Configure Linting & Pre-commit Hooks]]

**Success**: `pnpm install` and `pnpm build` work locally; CI pipelines passing

---

### Phase 2: Core Library (Weeks 3-4)

**Deliverable**: Parser, renderer, query engine with 700+ tests  
**Effort**: 98 hours

**Work Items**:

- [[005 Implement Chevrotain Lexer]]
- [[006 Implement Chevrotain Parser]]
- [[007 Implement AST Renderer]]
- [[008 Implement Query Engine]]
- [[025 Implement Schema Validation]]
- [[009 Write Lexer Tests (200+)]]
- [[010 Write Parser Tests (300+)]]
- [[011 Write Renderer/Query Tests (200+)]]

**Success**: All tests passing; <1ms tokenization, <5ms parsing, <20ms rendering for 4KB templates

---

### Phase 3: VS Code Extension (Weeks 5-6)

**Deliverable**: Volar plugin with diagnostics, completion, hover  
**Effort**: 58 hours

**Work Items**:

- [[012 Build Volar Language Server Plugin]]
- [[027 Implement Virtual Code Mapping]]
- [[013 Implement Syntax Highlighting]]
- [[028 Implement Embedded Language Support]]
- [[014 Implement Diagnostics]]
- [[015 Implement IntelliSense]]
- [[016 Write VS Code Extension Tests (50+)]]

**Success**: Extension activates; diagnostics <200ms latency; IntelliSense provides completions

---

### Phase 4: CLI Tool (Week 7)

**Deliverable**: render/validate/init commands + watch mode  
**Effort**: 26 hours

**Work Items**:

- [[017 Implement CLI Commands]]
- [[018 Add Watch Mode and File I/O]]
- [[029 Implement Signal Handling]]
- [[019 Write CLI Tests (50+)]]

**Success**: `templjs render` works; watch mode <500ms response; CLI handles pipes and signals

---

### Phase 5: Documentation & Release (Week 8)

**Deliverable**: Complete documentation and public release  
**Effort**: 19 hours

**Work Items**:

- [[020 Write Documentation]]
- [[021 Create Examples and Demo Video]]
- [[022 Release v1.0]]

**Success**: v1.0 on npm and VS Code Marketplace; 1,000+ downloads in first month

---

## 📊 Effort Summary

| Phase                   | Effort   | Status                                        |
| ----------------------- | -------- | --------------------------------------------- |
| Infrastructure          | 23h      | ✅ Completed (13/13 tasks, all tests passing) |
| Core Library            | 98h      | ✅ Completed (700+ tests, 100% passing)       |
| VS Code Extension       | 58h      | Ready to start                                |
| CLI Tool                | 26h      | Blocked by Phase 2                            |
| Documentation & Release | 19h      | Blocked by Phases 2-4                         |
| **TOTAL**               | **249h** | **Phases 1-2 complete: 18% done**             |

---

## 🎯 How to Execute

### Before Phase 1

1. ✅ Read [v1.0 PRD](docs/prd/v1.0-requirements.md) for requirements and technical decisions
2. ✅ Review [ADRs](docs/adr/) for architecture rationale
3. ✅ Assign Phase 1 work items (items 1-4, 23 hours)

### Phase 1 Execution

```bash
# For each work item (1, 2, 3, 4):
cd /Users/macos/dev/templjs
# Implement according to backlog/NNN_*.md
# Update status in work item frontmatter
# Create feature branch: git checkout -b phase1/NNN-title
# Commit with conventional messages: git commit -m "feat: ..."
# Submit PR for review
```

### After Phase 1 Completion

1. Verify all infrastructure checks pass
2. Assign Phase 2 work items (items 5-11, 1.5; 98 hours)
3. Continue sequentially through phases

---

## 📌 Key Decisions Log

| Decision | Rationale    | Reference                                                     |
| -------- | ------------ | ------------------------------------------------------------- |
| Language | TypeScript   | [[ADR-001]] - Type safety, single language stack              |
| Parser   | Chevrotain   | [[ADR-002]] - Performance, error recovery, zero deps          |
| IDE      | Volar plugin | [[ADR-003]] - Full IDE support via language server            |
| Branding | templ.js     | [[ADR-004]] - Clean, memorable, TypeScript-native positioning |
| Monorepo | pnpm + Nx    | [[ADR-005]] - Efficient workspace management, atomic releases |
| Testing  | Vitest       | [[ADR-006]] - Jest-compatible, fast, ESM-native               |
| Syntax   | Handlebars   | Custom - Familiar to web devs; v1.1+ will support themes      |

---

## 🔗 Essential References

- **Product Requirements**: [v1.0 PRD](docs/prd/v1.0-requirements.md) — complete feature spec and timeline
- **Work Items**: [backlog/](backlog/) — detailed implementation steps (each file = 1 work item)
- **Architecture**: [docs/adr/](docs/adr/) — technical rationale and decisions

---

## ⚠️ Critical Success Factors

1. **Phase sequencing is strict**: Phase 1 must complete before Phase 2 begins (other phases have the same blocker, can parallelize within constraints)
2. **Individual work items are authoritative**: Update and commit work item files as you progress; they are the source of truth for status
3. **Tests first**: Each phase includes test work items (200+, 300+, 350+) to ensure quality
4. **One week per phase**: Stay on schedule; adjust scope if falling behind, don't slip timeline

---

**Status**: Planning complete. Awaiting Phase 1 start signal. 🚀
