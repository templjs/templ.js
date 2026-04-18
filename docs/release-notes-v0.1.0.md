---
id: release-notes-100
type: document
subtype: guide
lifecycle: active
status: ready
title: templjs v0.1.0 Release Notes
---

{% raw %}

## templjs v0.1.0

templjs v0.1.0 is the first public pre-1.0 release of the TypeScript-native meta-templating system.

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
npm install @templjs/core@0.1.0
npm install -D @templjs/cli@0.1.0
```

### VS Code

Install the templjs extension from the marketplace:

- <https://marketplace.visualstudio.com/items?itemName=templjs.templjs>

### Documentation

- [Getting Started](./getting-started.md)
- [API Reference](./api-reference.md)
- [CLI Reference](./cli.md)
- [Examples](./examples.md)

### Known Follow-Ups

- TypeDoc coverage ratcheting tracked in WI-090.
- Full-text docs search is deferred to v1.1.

{% endraw %}
