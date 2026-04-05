---
id: wi-051
type: work-item
subtype: story
lifecycle: draft
title: '051: Implement Extraction CLI Command'
status: proposed
priority: medium
estimated: 6
actual: 0
assignee: ''
links:
  depends_on:
    - '[[050_extraction_validation]]'
    - '[[017_cli_commands]]'
    - '[[033_schema_parity]]'
---

## Goal

Add `templjs extract` CLI command that extracts structured data from a source rendered document using a template and schema.

## Background

With the extraction engine (WI-049) and validation (WI-050) complete, we need a CLI for users to extract data from the command line. This mirrors the existing `templjs render` command but works in reverse.

The CLI should:

1. Accept source rendered document input (file or stdin)
2. Accept template file
3. Accept schema file
4. Output extracted data in specified format (JSON/YAML/TOML)
5. Report extraction errors clearly
6. Support all input/output formats from WI-033

## Tasks

- [ ] Add `extract` subcommand to CLI
- [ ] Implement `--rendered` / `-i` flag for source rendered document input
- [ ] Implement `--template` flag for template file
- [ ] Implement `--schema` flag for schema file
- [ ] Implement `--format` output format (json/yaml/toml)
- [ ] Support stdin for rendered document input (pipe rendered docs)
- [ ] Add `--strict-whitespace` flag
- [ ] Add extraction error formatting
- [ ] Add progress indicator for large files
- [ ] Add `--verbose` mode for extraction debugging
- [ ] Update CLI help text and examples
- [ ] Add CLI integration tests

## Deliverables

- `src/packages/cli/src/commands/extract.ts` - Extract command implementation
- `src/packages/cli/src/formatters/extraction-error.ts` - Error formatting
- CLI tests in `src/packages/cli/test/extract.test.ts`
- Updated README with examples

## Acceptance Criteria

- [ ] `templjs extract --rendered out.md --template tmpl.md --schema schema.json` works
- [ ] Output format can be JSON, YAML, or TOML
- [ ] Stdin input works: `cat output.md | templjs extract --template tmpl.md --schema schema.json`
- [ ] Extraction errors are clearly formatted with positions
- [ ] `--format` flag controls output format
- [ ] `--strict-whitespace` flag works
- [ ] `--verbose` shows extraction debugging info
- [ ] Help text is clear and comprehensive
- [ ] 15+ CLI integration tests passing

## CLI Usage Examples

### Basic Extraction

```bash
templjs extract \
  --rendered rendered-output.md \
  --template template.md.tmpl \
  --schema schema.json \
  --format json
```

Output:

```json
{
  "title": "Extracted Title",
  "author": {
    "name": "John Doe"
  }
}
```

### Extract to YAML

```bash
templjs extract \
  --rendered rendered.md \
  --template template.md.tmpl \
  --schema schema.json \
  --format yaml > data.yaml
```

### Stdin Input

```bash
cat rendered-document.md | templjs extract \
  --template template.md.tmpl \
  --schema schema.json
```

### With Verbose Debugging

```bash
templjs extract \
  --rendered out.md \
  --template tmpl.md \
  --schema schema.json \
  --verbose
```

Output:

```text
[DEBUG] Parsing template...
[DEBUG] Generating extraction rules...
[DEBUG] Matching rendered document against template...
[DEBUG] Extracted 3 expressions, 1 loop, 0 conditionals
[DEBUG] Applying schema validation...
[SUCCESS] Extraction complete

{"title": "..."}
```

### Error Example

```bash
templjs extract --rendered bad.md --template tmpl.md --schema schema.json
```

Output:

```text
Extraction failed with 2 errors:

  Error at line 5, column 12:
    Expected number for field 'count', got 'abc'

  Error:
    Missing required field 'email'

Failed to extract data from rendered document.
```

## CLI Flags

- `--rendered`, `-i`: Source rendered document path (or `-` for stdin)
- `--template`, `-t`: Path to template file (required)
- `--schema`, `-s`: Path to schema file (required)
- `--format`, `-f`: Output format (json|yaml|toml, default: json)
- `--strict-whitespace`: Do not normalize whitespace during matching
- `--verbose`, `-v`: Show extraction debugging information
- `--help`, `-h`: Show help text

## Non-Goals

- Interactive extraction (show ambiguities and ask user)
- Batch extraction of multiple files
- Watch mode for extraction
- GUI/web interface
