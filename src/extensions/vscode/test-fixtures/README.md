# Templjs Sample Templates

This directory contains sample template files for testing the Templjs VS Code extension.

## Files

- **example.md.tmpl** — Markdown template sample
- **config.json.tmpl** — JSON configuration template sample
- **deploy.yaml.tmpl** — Kubernetes deployment YAML template sample
- **index.html.tmpl** — HTML page template sample

## Testing

### Manual Testing

1. Open any of these `.*.tmpl` files in VS Code
2. Click the **Templjs: Test Extension** command from the command palette
3. Verify:
   - No errors appear in the Problems panel
   - Syntax highlighting is applied
   - Template blocks and expressions are recognized

### Expected Behavior

- Files should be associated with the `templjs-<format>` language ID (e.g., `templjs-markdown`)
- Base format linting (Markdown, JSON, YAML, HTML) should delegate through the language server
- Template syntax should be stripped and preserved for base linting while maintaining line structure

## For Developers

These samples demonstrate template file patterns for various output formats.
