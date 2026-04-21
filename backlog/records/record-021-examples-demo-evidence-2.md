---
$schema: schemas/work-management/frontmatter/record.json
id: record:021-examples-demo-evidence-2
title: '21: Create Example Templates and Demo Video evidence 2'
summary: '21: Create Example Templates and Demo Video evidence 2'
type: record
subtype: test-result
lifecycle: active
status: ready
status_reason: recorded
---

## Recorded At

2026-04-13T08:30:08.734Z

## Outcome

noted

## Observation

Expanded WI-021 example coverage and revalidated the full example pack:

- Added `examples/config-files/` with `.env.tmpl`, `docker-compose.tmpl`, shared data, and README
- Added `examples/documentation/` with markdown API-doc generation example, data, and README
- Added inline template comments to markdown-report, html-email, and json-api examples
- Simplified markdown-report, html-email, and config-files example syntax to match the current renderer capabilities
- Updated example READMEs and `docs/examples.md` to use repo-root build and render commands
  Validation:
- `pnpm --filter @templjs/core build`
- `pnpm --filter @templjs/cli build`
- `node src/packages/cli/dist/cli.js render -t examples/markdown-report/template.md.tmpl -i examples/markdown-report/data.json`
- `node src/packages/cli/dist/cli.js render -t examples/html-email/template.html.tmpl -i examples/html-email/data.json`
- `node src/packages/cli/dist/cli.js render -t examples/json-api/template.json.tmpl -i examples/json-api/data.json`
- `node src/packages/cli/dist/cli.js render -t examples/config-files/.env.tmpl -i examples/config-files/data.json`
- `node src/packages/cli/dist/cli.js render -t examples/config-files/docker-compose.tmpl -i examples/config-files/data.json`
- `node src/packages/cli/dist/cli.js render -t examples/documentation/template.md.tmpl -i examples/documentation/data.json`

## Subject References

- [[work-item-021-examples-demo]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/46>
