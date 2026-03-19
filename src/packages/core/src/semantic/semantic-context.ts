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

export interface SemanticDiagnosticResult {
  message: string;
  severity: number;
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
  diagnostics?: SemanticDiagnosticResult[];
}

export function getSemanticProfileId(contextBlock: SemanticContextBlock): string {
  return `schema-${contextBlock}`;
}

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

export function getFrontmatterSchemaAliases(text: string): {
  templSchema?: string;
  contentSchema?: string;
} {
  const range = detectFrontmatterRange(text);
  if (!range) {
    return {};
  }

  const frontmatterText = text.slice(range.start, range.end);
  const templMatch = frontmatterText.match(
    /^\s*["']?(\$schema|\$templ-schema)["']?\s*:\s*["']?([^"'\n#]+)["']?/m
  );
  const contentMatch = frontmatterText.match(
    /^\s*["']?(\$content-schema|\$content_schema)["']?\s*:\s*["']?([^"'\n#]+)["']?/m
  );

  return {
    templSchema: templMatch?.[2]?.trim() || undefined,
    contentSchema: contentMatch?.[2]?.trim() || undefined,
  };
}

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
    const match = line.match(
      /^(\s*["']?)(\$schema|\$templ-schema|\$content-schema|\$content_schema)(["']?\s*:\s*["']?)([^"'\n#]+)(.*)$/
    );
    if (match) {
      const [, prefix, key, separator, rawValue] = match;
      const value = rawValue.trim();
      const keyStart = lineStart + prefix.length;
      const keyEnd = keyStart + key.length;
      const valueStart = keyEnd + separator.length;
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

export function resolveSemanticZone(text: string, offset: number): SemanticZone {
  return toSemanticZone(resolveSemanticContextBlock(text, offset));
}

export function resolveSemanticHostLanguage(documentUri?: string): SemanticHostLanguage {
  if (!documentUri) {
    return 'unknown';
  }

  const normalized = documentUri.toLowerCase();

  if (normalized.includes('.md.templ') || normalized.includes('.templ.md')) {
    return 'markdown';
  }
  if (
    normalized.includes('.yaml.templ') ||
    normalized.includes('.yml.templ') ||
    normalized.includes('.templ.yaml') ||
    normalized.includes('.templ.yml')
  ) {
    return 'yaml';
  }
  if (normalized.includes('.json.templ') || normalized.includes('.templ.json')) {
    return 'json';
  }
  if (normalized.includes('.toml.templ') || normalized.includes('.templ.toml')) {
    return 'toml';
  }
  if (normalized.includes('.html.templ') || normalized.includes('.templ.html')) {
    return 'html';
  }
  if (normalized.includes('.xml.templ') || normalized.includes('.templ.xml')) {
    return 'xml';
  }

  return 'unknown';
}

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
