---
id: wi-021
type: work-item
subtype: task
lifecycle: draft
title: '21: Create Example Templates and Demo Video'
status: proposed
priority: critical
estimated: 8
assignee: ''
links:
  depends_on:
    - '[[017_cli_commands]]'
---

## Goal

Create real-world example templates and video demonstration.

## Background

Examples showcase templ.js capabilities and help users understand syntax. Video makes features discoverable.

## Tasks

- [ ] Create `examples/markdown-report/` (analytics report)
- [ ] Create `examples/html-email/` (transactional email)
- [ ] Create `examples/json-api/` (API response transformation)
- [ ] Create `examples/config-files/` (.env.tmpl, docker-compose.tmpl)
- [ ] Create `examples/documentation/` (auto-generated docs)
- [ ] Annotate all examples with comments
- [ ] Create demo data files for each example
- [ ] Record demo video (5-10 minutes)
- [ ] Add example README with instructions

## Deliverables

- 5+ runnable example templates
- Sample data files for each example
- Example documentation
- 5-10 minute demo video

## Acceptance Criteria

- [ ] All examples run without errors
- [ ] Examples demonstrate different features
- [ ] Example data is realistic
- [ ] Video shows installation → rendering
- [ ] Video shows VS Code features
- [ ] Examples are well-commented

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

1. **Installation** (30s): `npm install @templjs/core`
2. **First Render** (1m): Parse and render simple template
3. **VS Code Setup** (1m): Install extension, open template file
4. **IDE Features** (2m): Show completion, hover, diagnostics
5. **CLI Usage** (1m): `templjs render` command
6. **Complex Example** (2m): Markdown report with loops
7. **Summary** (30s): Where to go next (docs, examples)

## References

- [Example Best Practices](https://github.com/mdn/translated-content/blob/main/docs/writing-examples.md)
- Video recording: OBS, Screenflow, or browser-based tool

## Dependencies

- Requires: [[20 Write Documentation]]
