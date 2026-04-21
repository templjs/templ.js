# templjs Demo Video Script

This script accompanies `assets/demo/templjs-demo.mp4`.

## Sections

1. Installation
   - `pnpm install`
   - `pnpm --filter @templjs/core build`
   - `pnpm --filter @templjs/cli build`
2. First render
   - Render `examples/markdown-report/template.md.tmpl` with `examples/markdown-report/data.json`
3. Example pack overview
   - markdown-report
   - html-email
   - json-api
   - config-files
   - documentation
4. VS Code workflow
   - open a template file
   - completion for object paths and filters
   - hover documentation for built-ins
   - diagnostics on malformed statements
5. CLI workflow
   - `templjs render --template <file> --input <data.json>`
6. Summary and next steps
   - docs/getting-started.md
   - docs/examples.md
   - examples/\*/README.md

## Validation

Regenerate the video with:

```bash
bash scripts/demo/build-wi021-demo.sh
```

Inspect duration with:

```bash
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 assets/demo/templjs-demo.mp4
```
