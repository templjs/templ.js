export type SemanticOperation = 'completion' | 'hover' | 'definition' | 'diagnostics';
export type SemanticContextBlock = 'frontmatter' | 'content';
export type SemanticZoneKind = 'metadata' | 'body';
export type SemanticHostLanguage =
  | 'markdown'
  | 'yaml'
  | 'json'
  | 'toml'
  | 'html'
  | 'xml'
  | 'unknown';

export interface SemanticZone {
  kind: SemanticZoneKind;
  profileId: string;
  legacyContextBlock: SemanticContextBlock;
}

export interface SemanticLocation {
  documentUri?: string;
  line: number;
  character: number;
  offset?: number;
}

export interface SemanticRequest {
  version: 'v1';
  operation: SemanticOperation;
  location: SemanticLocation;
  contextBlock: SemanticContextBlock;
  zone?: SemanticZone;
}

export interface SemanticCompletionItem {
  label: string;
  kind: 'variable' | 'property' | 'keyword' | 'filter';
  detail?: string;
  documentation?: string;
}

export interface SemanticHoverResult {
  markdown?: string;
  plaintext?: string;
}

export interface SemanticDefinitionResult {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export type DiagnosticSeverity = 1 | 2 | 3 | 4;

export interface SemanticDiagnosticRecord {
  message: string;
  severity: DiagnosticSeverity;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  code?: string;
  source?: string;
}

export interface SemanticResponse {
  version: 'v1';
  revision: number;
  operation: SemanticOperation;
  contextBlock: SemanticContextBlock;
  zone?: SemanticZone;
  completionItems?: SemanticCompletionItem[];
  hover?: SemanticHoverResult | null;
  definition?: SemanticDefinitionResult | null;
  diagnostics?: SemanticDiagnosticRecord[];
}

/**
 * Derive a stable schema profile ID from a semantic context block name.
 *
 * @param contextBlock - `"frontmatter"` or `"content"`
 * @returns Profile ID string (e.g. `"schema-frontmatter"`)
 */
export function getSemanticProfileId(contextBlock: SemanticContextBlock): string {
  return `schema-${contextBlock}`;
}

/**
 * Convert a semantic context block into a structured `SemanticZone`.
 *
 * @param contextBlock - `"frontmatter"` or `"content"`
 * @returns `SemanticZone` with `kind`, `profileId`, and legacy block name
 */
export function toSemanticZone(contextBlock: SemanticContextBlock): SemanticZone {
  return {
    kind: contextBlock === 'frontmatter' ? 'metadata' : 'body',
    profileId: getSemanticProfileId(contextBlock),
    legacyContextBlock: contextBlock,
  };
}

export interface FrontmatterRange {
  start: number;
  end: number;
}

export interface FrontmatterKeyValueAtOffset {
  key: string;
  valueToken: string;
}

/**
 * Detect the string index range (code unit offsets) occupied by a YAML
 * frontmatter block.
 *
 * @param text - Full document text to scan
 * @returns `FrontmatterRange` `{start, end}` if a `---`-delimited block is
 *   found at the document start, or `undefined` if none is present. These
 *   indices are intended for use with `text.slice(range.start, range.end)`.
 */
export function detectFrontmatterRange(text: string): FrontmatterRange | undefined {
  const openingFenceLength = text.startsWith('---\r\n')
    ? '---\r\n'.length
    : text.startsWith('---\n')
      ? '---\n'.length
      : 0;
  if (openingFenceLength === 0) {
    return undefined;
  }

  const crlfEndFence = text.indexOf('\r\n---', openingFenceLength);
  const lfEndFence = text.indexOf('\n---', openingFenceLength);

  let endFenceStart = -1;
  let endFenceLength = 0;

  if (crlfEndFence !== -1 && (lfEndFence === -1 || crlfEndFence < lfEndFence)) {
    endFenceStart = crlfEndFence;
    endFenceLength = '\r\n---'.length;
  } else if (lfEndFence !== -1) {
    endFenceStart = lfEndFence;
    endFenceLength = '\n---'.length;
  }

  if (endFenceStart === -1) {
    return undefined;
  }

  return {
    start: 0,
    end: endFenceStart + endFenceLength,
  };
}

/**
 * Return `true` when `offset` falls inside the frontmatter block.
 *
 * @param text - Full document text
 * @param offset - Zero-based character offset to test
 * @returns `true` if the offset is within the `---` YAML frontmatter block
 */
export function isOffsetInFrontmatter(text: string, offset: number): boolean {
  const range = detectFrontmatterRange(text);
  if (!range) {
    return false;
  }

  return offset >= range.start && offset < range.end;
}

function isTokenCharacter(character: string): boolean {
  return /[A-Za-z0-9_./:#$~+-]/.test(character);
}

/**
 * Extract the token under (or immediately before) the given text offset.
 *
 * Token characters include alphanumerics plus path/symbol characters used by
 * schema and query references (`.`, `/`, `:`, `#`, `$`, `~`, `+`, `-`).
 *
 * @param text - Full document text
 * @param offset - Zero-based character offset
 * @returns Token string with its start/end offsets, or `undefined` when no
 *   token is present at that location
 */
export function getTokenAtOffset(
  text: string,
  offset: number
): { token: string; start: number; end: number } | undefined {
  if (offset < 0 || offset > text.length) {
    return undefined;
  }

  let start = offset;
  let end = offset;

  if (start > 0 && !isTokenCharacter(text[start]) && isTokenCharacter(text[start - 1])) {
    start -= 1;
    end -= 1;
  }

  while (start > 0 && isTokenCharacter(text[start - 1])) {
    start -= 1;
  }
  while (end < text.length && isTokenCharacter(text[end])) {
    end += 1;
  }

  if (end <= start) {
    return undefined;
  }

  const token = text.slice(start, end).trim();
  if (!token) {
    return undefined;
  }

  return { token, start, end };
}

function matchFrontmatterSchemaAlias(line: string):
  | {
      prefix: string;
      key: string;
      separator: string;
      value: string;
      valueOffset: number;
    }
  | undefined {
  const match = line.match(
    /^(\s*["']?)(\$schema|\$templ-schema|\$content-schema|\$content_schema)(["']?\s*:\s*)(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([^\r\n]+?)(?=\s+#|$))/
  );
  if (!match) {
    return undefined;
  }

  const [, prefix, key, separator, doubleQuotedValue, singleQuotedValue, unquotedValue] = match;
  const rawValue = doubleQuotedValue ?? singleQuotedValue ?? unquotedValue ?? '';
  const value = rawValue.trim();
  if (!value) {
    return undefined;
  }

  return {
    prefix,
    key,
    separator,
    value,
    valueOffset:
      prefix.length +
      key.length +
      separator.length +
      (doubleQuotedValue !== undefined || singleQuotedValue !== undefined ? 1 : 0),
  };
}

/**
 * Read known schema alias keys from YAML frontmatter.
 *
 * Supported aliases:
 * - templ schema: `$schema`, `$templ-schema`
 * - content schema: `$content-schema`, `$content_schema`
 *
 * @param text - Full document text
 * @returns Object with discovered schema URI values (if present)
 */
export function getFrontmatterSchemaAliases(text: string): {
  templSchema?: string;
  contentSchema?: string;
} {
  const range = detectFrontmatterRange(text);
  if (!range) {
    return {};
  }

  const frontmatterText = text.slice(range.start, range.end);
  let templSchema: string | undefined;
  let contentSchema: string | undefined;

  for (const line of frontmatterText.split(/\r?\n/)) {
    const alias = matchFrontmatterSchemaAlias(line);
    if (!alias) {
      continue;
    }

    if ((alias.key === '$schema' || alias.key === '$templ-schema') && templSchema === undefined) {
      templSchema = alias.value;
    }

    if (
      (alias.key === '$content-schema' || alias.key === '$content_schema') &&
      contentSchema === undefined
    ) {
      contentSchema = alias.value;
    }
  }

  return {
    templSchema,
    contentSchema,
  };
}

/**
 * Resolve a schema URI reference when the cursor is on a frontmatter schema
 * key or value token.
 *
 * @param text - Full document text
 * @param offset - Zero-based character offset
 * @returns `{ value }` when offset targets a schema alias key/value, else `null`
 */
export function getFrontmatterSchemaReferenceAtOffset(
  text: string,
  offset: number
): { value: string } | null {
  if (!isOffsetInFrontmatter(text, offset)) {
    return null;
  }

  const range = detectFrontmatterRange(text);
  if (!range) {
    return null;
  }

  const frontmatterText = text.slice(range.start, range.end);
  let lineStart = 0;
  const lineRegex = /[^\r\n]*(?:\r?\n|$)/g;
  let lineMatch: RegExpExecArray | null;

  while ((lineMatch = lineRegex.exec(frontmatterText)) !== null) {
    const rawLine = lineMatch[0];
    if (rawLine.length === 0) {
      break;
    }
    const line = rawLine.replace(/\r?\n$/, '');
    const alias = matchFrontmatterSchemaAlias(line);
    if (alias) {
      const { prefix, key, value, valueOffset } = alias;
      const keyStart = lineStart + prefix.length;
      const keyEnd = keyStart + key.length;
      const valueStart = lineStart + valueOffset;
      const valueEnd = valueStart + value.length;

      if (
        (offset >= keyStart && offset <= keyEnd) ||
        (offset >= valueStart && offset <= valueEnd)
      ) {
        return { value };
      }
    }

    lineStart += rawLine.length;
  }

  return null;
}

/**
 * Parse the frontmatter key/value pair at a cursor offset.
 *
 * @param text - Full document text
 * @param offset - Zero-based character offset
 * @returns Parsed key and normalized value token, or `null` if offset does not
 *   fall on a parseable key/value line
 */
export function getFrontmatterKeyValueAtOffset(
  text: string,
  offset: number
): FrontmatterKeyValueAtOffset | null {
  if (!isOffsetInFrontmatter(text, offset)) {
    return null;
  }

  const lineStart = text.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
  const nextNewline = text.indexOf('\n', offset);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;
  const line = text.slice(lineStart, lineEnd);

  const match = line.match(/^(\s*["']?)([A-Za-z_$][\w$-]*)(["']?\s*:\s*)(.+)$/);
  if (!match) {
    return null;
  }

  const [, prefix, key, separator, rawValue] = match;
  const keyStart = lineStart + prefix.length;
  const keyEnd = keyStart + key.length;
  const valueStart = keyEnd + separator.length;
  if (offset < valueStart) {
    return null;
  }

  const valueText = rawValue.trim().replace(/^["']|["']$/g, '');
  if (!valueText) {
    return null;
  }

  return { key, valueToken: valueText };
}

/**
 * Determine which semantic block surrounds the given offset.
 *
 * @param text - Full document text
 * @param offset - Zero-based character offset to classify
 * @returns `"frontmatter"` when offset is inside the YAML block, `"content"` otherwise
 */
export function resolveSemanticContextBlock(text: string, offset: number): SemanticContextBlock {
  if (!isOffsetInFrontmatter(text, offset)) {
    return 'content';
  }

  const isContentAlias = (value: string | undefined): boolean => {
    if (!value) {
      return false;
    }

    const normalized = value
      .replace(/^['"]|['"]$/g, '')
      .replace(/[:\s]+$/g, '')
      .trim();
    return (
      normalized === '$content-schema' ||
      normalized === '$content_schema' ||
      normalized === 'content-schema' ||
      normalized === 'content_schema'
    );
  };

  const keyValue = getFrontmatterKeyValueAtOffset(text, offset);
  if (isContentAlias(keyValue?.key)) {
    return 'content';
  }

  const tokenAtOffset = getTokenAtOffset(text, offset)?.token;
  if (isContentAlias(tokenAtOffset)) {
    return 'content';
  }

  return 'frontmatter';
}

/**
 * Resolve the full `SemanticZone` for the given offset.
 *
 * Convenience wrapper around `resolveSemanticContextBlock` + `toSemanticZone`.
 *
 * @param text - Full document text
 * @param offset - Zero-based character offset
 * @returns `SemanticZone` describing the zone at that offset
 */
export function resolveSemanticZone(text: string, offset: number): SemanticZone {
  return toSemanticZone(resolveSemanticContextBlock(text, offset));
}

/**
 * Infer the host document language from the file URI extension.
 *
 * Recognises `.md.templ` / `.md.tmpl` / `.md.tpl`,
 * `.yml.templ` / `.yml.tmpl` / `.yml.tpl`,
 * `.yaml.templ` / `.yaml.tmpl` / `.yaml.tpl`,
 * `.json.templ` / `.json.tmpl` / `.json.tpl`,
 * `.toml.templ` / `.toml.tmpl` / `.toml.tpl`,
 * `.html.templ` / `.html.tmpl` / `.html.tpl`,
 * and `.xml.templ` / `.xml.tmpl` / `.xml.tpl`
 * double-extension conventions (and their reversed forms).
 *
 * @param documentUri - Optional document URI or path
 * @returns `SemanticHostLanguage` string (`"markdown"`, `"json"`, etc.)
 *   or `"unknown"` if no recognised extension is found
 */
export function resolveSemanticHostLanguage(documentUri?: string): SemanticHostLanguage {
  if (!documentUri) {
    return 'unknown';
  }

  const normalized = documentUri.toLowerCase();

  if (
    normalized.includes('.md.templ') ||
    normalized.includes('.templ.md') ||
    normalized.includes('.md.tmpl') ||
    normalized.includes('.tmpl.md') ||
    normalized.includes('.md.tpl') ||
    normalized.includes('.tpl.md')
  ) {
    return 'markdown';
  }
  if (
    normalized.includes('.yaml.templ') ||
    normalized.includes('.yml.templ') ||
    normalized.includes('.templ.yaml') ||
    normalized.includes('.templ.yml') ||
    normalized.includes('.yaml.tmpl') ||
    normalized.includes('.yml.tmpl') ||
    normalized.includes('.tmpl.yaml') ||
    normalized.includes('.tmpl.yml') ||
    normalized.includes('.yaml.tpl') ||
    normalized.includes('.yml.tpl') ||
    normalized.includes('.tpl.yaml') ||
    normalized.includes('.tpl.yml')
  ) {
    return 'yaml';
  }
  if (
    normalized.includes('.json.templ') ||
    normalized.includes('.templ.json') ||
    normalized.includes('.json.tmpl') ||
    normalized.includes('.tmpl.json') ||
    normalized.includes('.json.tpl') ||
    normalized.includes('.tpl.json')
  ) {
    return 'json';
  }
  if (
    normalized.includes('.toml.templ') ||
    normalized.includes('.templ.toml') ||
    normalized.includes('.toml.tmpl') ||
    normalized.includes('.tmpl.toml') ||
    normalized.includes('.toml.tpl') ||
    normalized.includes('.tpl.toml')
  ) {
    return 'toml';
  }
  if (
    normalized.includes('.html.templ') ||
    normalized.includes('.templ.html') ||
    normalized.includes('.html.tmpl') ||
    normalized.includes('.tmpl.html') ||
    normalized.includes('.html.tpl') ||
    normalized.includes('.tpl.html')
  ) {
    return 'html';
  }
  if (
    normalized.includes('.xml.templ') ||
    normalized.includes('.templ.xml') ||
    normalized.includes('.xml.tmpl') ||
    normalized.includes('.tmpl.xml') ||
    normalized.includes('.xml.tpl') ||
    normalized.includes('.tpl.xml')
  ) {
    return 'xml';
  }

  return 'unknown';
}

/**
 * Resolve semantic zone defaults based on host language + offset context.
 *
 * Frontmatter detection is only active for Markdown files. For JSON/YAML and
 * other host languages, all content is treated as the `content` zone.
 *
 * @param text - Full document text
 * @param offset - Zero-based character offset
 * @param hostLanguage - Host language inferred from file extension
 * @returns `SemanticZone` suitable for language-aware tooling behavior
 */
export function resolveSemanticZoneByHostLanguage(
  text: string,
  offset: number,
  hostLanguage: SemanticHostLanguage
): SemanticZone {
  if (hostLanguage === 'markdown') {
    return resolveSemanticZone(text, offset);
  }

  return toSemanticZone('content');
}
