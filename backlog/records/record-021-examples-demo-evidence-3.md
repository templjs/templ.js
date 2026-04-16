---
$schema: schemas/work-management/frontmatter/record.json
id: record:021-examples-demo-evidence-3
title: '21: Create Example Templates and Demo Video evidence 3'
summary: '21: Create Example Templates and Demo Video evidence 3'
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

Completed the remaining demo-video scope for WI-021:

- Added `assets/demo/templjs-demo.mp4` as a reviewable in-repo slide-based walkthrough artifact
- Added `assets/demo/wi-021-demo-script.md` with the narrated section outline
- Added `scripts/demo/build-wi021-demo.sh` to regenerate the MP4 in a reproducible workflow
- Linked the demo asset from `docs/examples.md`
  Validation:
- `bash scripts/demo/build-wi021-demo.sh`
- `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 assets/demo/templjs-demo.mp4` -> `300.000000`

## Subject References

- [[work-item-021-examples-demo]]

## Artifact References

- <https://github.com/templjs/templ.js/pull/46>
