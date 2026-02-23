# vscode-templjs

VS Code extension for templjs meta-template language support.

## Features

- **Syntax Highlighting**: Proper colorization of template directives and expressions
- **Diagnostics**: Real-time error detection and validation
- **IntelliSense**: Autocompletion for template syntax and data paths
- **Virtual Code Mapping**: Seamless integration with base format language servers

## Supported File Extensions

- `.templ.yaml` / `.templ.yml` - YAML templates
- `.templ.json` - JSON templates
- `.templ.md` - Markdown templates
- `.templ.html` - HTML templates

## Architecture

This extension uses Volar language server to provide IDE features:

1. **Template Processing**: Strips template syntax from documents
2. **Virtual Documents**: Creates virtual documents in base format
3. **Feature Delegation**: Delegates base format features to VS Code's native servers
4. **Mapping**: Maps diagnostics and completions back to original template

## Configuration

```json
{
  "templjs.trace.server": "off" // or "messages" or "verbose"
}
```

## Status

🚧 **Under Development** - This extension is part of the initial monorepo setup and full language server integration is being implemented.

## Installation

Install from VS Code marketplace (coming soon) or build from source:

```bash
cd extensions/vscode
pnpm install
pnpm run build
```

## License

Apache-2.0
