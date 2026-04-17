# Pull Request

## Summary

<!-- Describe what changed and why. -->

> **Branch target**: open routine feature, fix, and chore PRs against `staging`. Reserve direct PRs to `main` for promotion and hotfix flows.

## Related Issues

<!-- Link related issues using keywords: Fixes #123, Closes #456, Relates to #789 -->

Fixes #

## Release Metadata

<!--
Required when PR changes released artifacts under src/packages/** or src/extensions/vscode/**.
Keep this YAML valid. CI parses it for release notes and changelog automation.
-->

```yaml
release_note:
  type: feat # feat, fix, perf, refactor, docs, chore
  scope:
    - core # core, cli, volar, context-graph, vscode, docs, infra
  summary: 'Describe the user-visible change in one sentence'
  changelog:
    - root # root, vscode, none
  breaking: false
```

## Breaking Changes

<!-- If `breaking: true` above, describe the change and migration path. -->

## Testing

<!-- Describe what was tested and how to reproduce. -->

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist

- [ ] Code changes align with the stated scope
- [ ] `pnpm test` passes
- [ ] `pnpm lint` passes
- [ ] I added a `.changeset/*.md` file when released artifacts changed
- [ ] Documentation updated where relevant
- [ ] No new warnings or errors introduced
