---
$schema: schemas/work-management/frontmatter/work-item.json
id: work-item:021-examples-demo
title: '21: Create Example Templates and Demo Video'
summary: Create Example Templates and Demo Video
type: work-item
subtype: task
lifecycle: inactive
status: closed
status_reason: completed
priority: critical
estimated: 8
actual: 6
completed_date: '2026-04-10'
commits:
  8418c57: 'docs(release): add critical-path docs and reduced example slice (WI-020, WI-021, WI-022)'
  c306f44: 'docs(examples): expand WI-021 example packs and validate all renders (#40)'
  d0217af: 'Merge pull request #46 chore(backlog): close out WI-021 and WI-024 for review'
links:
  pull_requests:
    - https://github.com/templjs/templ.js/pull/46
  evidence:
    - '[[record-021-examples-demo-evidence-1]]'
    - '[[record-021-examples-demo-evidence-2]]'
    - '[[record-021-examples-demo-evidence-3]]'
---

## Goal

Create real-world example templates and video demonstration.

## Background

Examples showcase templ.js capabilities and help users understand syntax. Video makes features discoverable.

## Tasks

- [x] Create `examples/markdown-report/` (analytics report)
- [x] Create `examples/html-email/` (transactional email)
- [x] Create `examples/json-api/` (API response transformation)
- [x] Create `examples/config-files/` (.env.tmpl, docker-compose.tmpl)
- [x] Create `examples/documentation/` (auto-generated docs)
- [x] Annotate all examples with comments
- [x] Create demo data files for each example
- [x] Record demo video (5-10 minutes)
- [x] Add example README with instructions

## Deliverables

- 5+ runnable example templates
- Sample data files for each example
- Example documentation
- 5-10 minute demo video

## Acceptance Criteria

- [x] All examples run without errors
- [x] Examples demonstrate different features
- [x] Example data is realistic
- [x] Video shows installation → rendering
- [x] Video shows VS Code features
- [x] Examples are well-commented

## Example Templates

### markdown-report

```markdown
# Analytics Report for {{ company }}

Generated: {{ generated_at | date }}

## Summary

- Total Users: {{ total_users }}
- Active Users (30d): {{ active_users }}
- Churn Rate: {{ churn_rate | percent }}

## Top Regions

{% for region in top_regions %}

- {{ region.name }}: {{ region.users }} users
  {% endfor %}
```

### html-email

```html
<!DOCTYPE html>
<html>
  <body>
    <h1>Hello {{ user.first_name }}!</h1>
    <p>Your order {{ order.id }} is {{ order.status | upper }}.</p>

    {% if order.items | length > 0 %}
    <ul>
      {% for item in order.items %}
      <li>{{ item.name }} x{{ item.quantity }}</li>
      {% endfor %}
    </ul>
    {% endif %}
  </body>
</html>
```

### json-api

```json
{
  "id": "{{ response.id }}",
  "timestamp": "{{ timestamp | iso8601 }}",
  "data": {
    {% for field in response.fields %}
    "{{ field.key }}": {{ field.value | json_escape }}{{ loop.last ? "" : "," }}
    {% endfor %}
  }
}
```

## Demo Video Content

1. **Installation and Build**: `pnpm install`, then build core and CLI packages
2. **First Render**: Render `examples/markdown-report/template.md.templ` with CLI
3. **Example Pack Overview**: markdown-report, html-email, json-api, config-files, documentation
4. **VS Code Workflow**: authoring, completion, hover help, and diagnostics
5. **CLI Workflow**: scriptable render command for local and CI usage
6. **Where to Go Next**: docs and example READMEs for follow-on usage

## References

- [Example Best Practices](https://github.com/mdn/translated-content/blob/main/docs/writing-examples.md)
- Video recording: OBS, Screenflow, or browser-based tool

## Dependencies

- Requires: [[20 Write Documentation]]

## Relationships

- `depends_on`: [[work-item-017-cli-commands]]
