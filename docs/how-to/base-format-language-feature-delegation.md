---
id: how-to-base-format-language-feature-delegation
type: document
subtype: how-to
lifecycle: active
status: ready
title: Base-Format Language Feature Delegation
description: How templjs delegates diagnostics, completion, hover, and formatting for host languages in .tmpl files
---

## Overview

templjs provides base-format language features for `.tmpl` files through **server-side Volar service plugins**.

When you open a templated file such as `.md.tmpl`, templjs creates a cleaned virtual document and maps requests between the original template and the virtual host-language view.

## Virtual Language IDs

| File extension             | Virtual language ID |
| -------------------------- | ------------------- |
| `.yaml.tmpl` / `.yml.tmpl` | `templjs-yaml`      |
| `.json.tmpl`               | `templjs-json`      |
| `.md.tmpl`                 | `templjs-markdown`  |
| `.html.tmpl`               | `templjs-html`      |
| `.xml.tmpl`                | `templjs-xml`       |

## How Features Are Delivered

Base-format diagnostics, completion, hover, and formatting are produced by Volar service plugins registered inside the templjs language server process.

This means host-language features depend on server-side plugin registration, not on whether a VS Code extension happens to provide direct `vscode.Diagnostic` entries for on-disk files.

## What Works Automatically

templjs currently uses community Volar service adapters for host-language feature delegation:

- `volar-service-markdown` (backed by `vscode-markdown-languageservice`)
- `volar-service-yaml`
- `volar-service-html`
- `volar-service-json`

templjs-specific diagnostics (template syntax, schema resolution, undefined-variable checks) are produced by templjs plugins and merged with host-language diagnostics.

## Formatter Selection and Prettier

Prettier integration is controlled by formatter selection in VS Code settings.

If a host language is configured to use Prettier as its default formatter, templjs passes that language selection to the language server at initialization and enables server-side Prettier delegation for that language.

## What Does Not Work

The following do not flow through Volar virtual-code mapping for `.tmpl` documents:

- File-watching linters or external CLI tools that only inspect on-disk file extensions
- Extension-API-only diagnostic providers that directly inject `vscode.Diagnostic` objects outside LSP/service-plugin flow

## Why Silence Can Be Expected

If you see no diagnostics for a `.tmpl` file from a non-LSP or file-watching tool, that behavior is expected.

Use host-language tooling that participates in templjs server-side delegation paths to get mapped diagnostics and language features for templated files.
