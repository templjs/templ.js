---
id: release-notes-100
type: document
subtype: guide
lifecycle: active
status: ready
title: templjs v1.0.0-beta.1 Release Notes
---

{% raw %}

## templjs v1.0.0-beta.1

templjs v1.0.0-beta.1 is the first beta release of the TypeScript-native meta-templating system.

### Highlights

- Stable package surfaces for:
  - `@templjs/core`
  - `@templjs/cli`
  - `@templjs/volar`
- GitHub Pages documentation site at:
  - <https://templjs.github.io/templ.js/>
- Expanded docs and examples for core authoring workflows.
- CI docs API guard to prevent TypeDoc regression drift.

### Installation

```bash
npm install @templjs/core
npm install -D @templjs/cli
```

### VS Code

Install the templjs extension from the marketplace:

- <https://marketplace.visualstudio.com/items?itemName=templjs.vscode-templjs>

### Documentation

- Getting Started: ./getting-started.md
- API Reference: ./api-reference.md
- CLI Reference: ./cli.md
- Examples: ./examples.md

### Known Follow-Ups

- TypeDoc coverage ratcheting tracked in WI-090.
- Full-text docs search is deferred to v1.1.

{% endraw %}
