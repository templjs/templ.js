import {
  extractTemplateScopeBindings,
  getFrontmatterKeyValueAtOffset,
  getFrontmatterSchemaAliases,
  getFrontmatterSchemaReferenceAtOffset,
  getSemanticProfileId,
  getTokenAtOffset,
  isOffsetInFrontmatter,
  type SemanticContextBlock,
  type SemanticOperation,
  type SemanticZone,
  SchemaValidator,
  type TemplateScopeBinding,
} from '@templjs/core';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import type {
  ContextNode,
  GraphSnapshot,
  JsonPrimitive,
  QueryRequest,
  QueryResponse,
} from '@templjs/context-graph';
import { fileURLToPath, pathToFileURL } from 'url';
import { splitSchemaSourceReference, resolveSchemaFilePathSync } from './schema-utils.js';

export interface SemanticQueryContext {
  operation: SemanticOperation;
  contextBlock?: SemanticContextBlock;
  semanticZone?: SemanticZone;
  profileId?: string;
  documentUri?: string;
  offset?: number;
  line?: number;
  character?: number;
}

export interface SemanticCompletionCandidate {
  label: string;
  kind: 'variable' | 'property' | 'keyword';
  detail?: string;
  documentation?: string;
}

export interface SemanticDefinitionDescriptor {
  uri: string;
  path?: string;
  pathKind?: 'property' | 'value';
  valueToken?: string;
}

export interface SemanticDefinitionOptions {
  schemaUri?: string;
  contentSchemaUri?: string;
}

export interface SemanticSchemaReadOptions {
  schema?: object;
  contentSchema?: object;
  schemaUri?: string;
  contentSchemaUri?: string;
}

export interface DefinitionResolutionOptions {
  schema?: object;
  contentSchema?: object;
  documentUri?: string;
  workspaceRoot?: string;
}

export interface DefinitionTarget {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

interface SchemaPathDetails {
  path: string;
  type?: string;
  description?: string;
}

type QueryAttributes = Readonly<Record<string, JsonPrimitive>>;

interface ResolvedSchemaPathTarget {
  uri: string;
  startOffset: number;
  pathAtTarget: string;
}

const ZERO_RANGE: DefinitionTarget['range'] = {
  start: { line: 0, character: 0 },
  end: { line: 0, character: 0 },
};

function getPathRegistryKeysFromSchema(schema: unknown): Set<string> {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return new Set();
  }

  const properties = (schema as Record<string, unknown>).properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return new Set();
  }

  const keys = new Set<string>();
  for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }

    const property = value as Record<string, unknown>;
    const format = typeof property.format === 'string' ? property.format.toLowerCase() : '';
    const description =
      typeof property.description === 'string' ? property.description.toLowerCase() : '';

    if (
      format === 'uri' ||
      format === 'uri-reference' ||
      key.toLowerCase().includes('path') ||
      key.toLowerCase().includes('schema') ||
      key.toLowerCase().includes('file') ||
      description.includes('path') ||
      description.includes('file')
    ) {
      keys.add(key);
    }
  }

  return keys;
}

function isLikelyPathValue(token: string): boolean {
  if (!token) {
    return false;
  }

  if (token.startsWith('http://') || token.startsWith('https://') || token.startsWith('file://')) {
    return true;
  }

  return /\//.test(token) || /\.[A-Za-z0-9]+($|[#?])/.test(token);
}

function toDefinitionTarget(uri: string): DefinitionTarget {
  return { uri, range: ZERO_RANGE };
}

function getPathValueDefinition(
  text: string,
  offset: number,
  options: DefinitionResolutionOptions
): DefinitionTarget | null {
  const keyValue = getFrontmatterKeyValueAtOffset(text, offset);
  if (!keyValue) {
    return null;
  }

  const registryKeys = new Set<string>([
    '$schema',
    '$templ-schema',
    '$content-schema',
    '$content_schema',
    ...getPathRegistryKeysFromSchema(options.schema),
    ...getPathRegistryKeysFromSchema(options.contentSchema),
  ]);

  if (!registryKeys.has(keyValue.key)) {
    return null;
  }

  if (!isLikelyPathValue(keyValue.valueToken)) {
    return null;
  }

  const { source } = splitSchemaSourceReference(keyValue.valueToken);
  const resolved = resolveSchemaFilePathSync(source, options.workspaceRoot, options.documentUri);
  if (!resolved) {
    return null;
  }

  if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
    return toDefinitionTarget(resolved);
  }

  if (!existsSync(resolved)) {
    return null;
  }

  return toDefinitionTarget(pathToFileURL(resolved).toString());
}

function getSchemaPathDefinition(
  text: string,
  offset: number,
  options: DefinitionResolutionOptions
): DefinitionTarget | null {
  if (!isOffsetInFrontmatter(text, offset)) {
    return null;
  }

  const schemaRef = getFrontmatterSchemaReferenceAtOffset(text, offset);
  let token = schemaRef?.value;

  if (!token) {
    const tokenRef = getTokenAtOffset(text, offset);
    if (!tokenRef) {
      return null;
    }

    token = tokenRef.token;
  }

  const keyToSchemaValue = (key: string): string | undefined => {
    const trimmedKey = key.replace(/^"|"$/g, '');
    if (
      trimmedKey === '$schema' ||
      trimmedKey === '$templ-schema' ||
      trimmedKey === '$content_schema' ||
      trimmedKey === '$content-schema'
    ) {
      const extracted = getFrontmatterSchemaAliases(text);
      if (trimmedKey === '$schema' || trimmedKey === '$templ-schema') {
        return extracted.templSchema;
      }
      return extracted.contentSchema;
    }
    return undefined;
  };

  token = keyToSchemaValue(token) ?? token;
  if (!token.includes('.json') && !token.startsWith('http://') && !token.startsWith('https://')) {
    return null;
  }

  const { source: tokenSource } = splitSchemaSourceReference(token);
  const resolved = resolveSchemaFilePathSync(
    tokenSource,
    options.workspaceRoot,
    options.documentUri
  );
  if (!resolved) {
    return null;
  }

  if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
    return toDefinitionTarget(resolved);
  }

  if (!existsSync(resolved)) {
    return null;
  }

  return toDefinitionTarget(pathToFileURL(resolved).toString());
}

function getPositionForOffset(text: string, offset: number): { line: number; character: number } {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  let line = 0;
  let lineStart = 0;

  for (let index = 0; index < safeOffset; index += 1) {
    if (text[index] === '\n') {
      line += 1;
      lineStart = index + 1;
    }
  }

  return {
    line,
    character: safeOffset - lineStart,
  };
}

function findMatchingBracket(text: string, start: number, open: string, close: string): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === open) {
      depth += 1;
      continue;
    }

    if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function skipWhitespace(text: string, index: number): number {
  let cursor = index;
  while (cursor < text.length && /\s/.test(text[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function findStringEnd(text: string, startQuote: number): number {
  let cursor = startQuote + 1;
  let escaped = false;

  while (cursor < text.length) {
    const char = text[cursor];
    if (escaped) {
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '"') {
      return cursor;
    }
    cursor += 1;
  }

  return -1;
}

function findValueRange(
  text: string,
  valueStart: number,
  objectEndExclusive: number
): { start: number; end: number } | null {
  if (valueStart >= objectEndExclusive) {
    return null;
  }

  const first = text[valueStart];
  if (first === '{') {
    const close = findMatchingBracket(text, valueStart, '{', '}');
    return close === -1 ? null : { start: valueStart, end: close + 1 };
  }

  if (first === '[') {
    const close = findMatchingBracket(text, valueStart, '[', ']');
    return close === -1 ? null : { start: valueStart, end: close + 1 };
  }

  if (first === '"') {
    const close = findStringEnd(text, valueStart);
    return close === -1 ? null : { start: valueStart, end: close + 1 };
  }

  let cursor = valueStart;
  while (cursor < objectEndExclusive && text[cursor] !== ',' && text[cursor] !== '}') {
    cursor += 1;
  }

  return { start: valueStart, end: cursor };
}

function findTopLevelPropertyInObjectRange(
  text: string,
  key: string,
  objectStart: number,
  objectEndExclusive: number
): { keyOffset: number; valueStart: number; valueEnd: number } | null {
  if (objectStart < 0 || objectEndExclusive <= objectStart || text[objectStart] !== '{') {
    return null;
  }

  let cursor = objectStart + 1;
  let structuralDepth = 1;
  let inString = false;
  let escaped = false;

  while (cursor < objectEndExclusive) {
    const char = text[cursor];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      cursor += 1;
      continue;
    }

    if (char === '"') {
      if (structuralDepth === 1) {
        const keyOffset = cursor;
        const keyEnd = findStringEnd(text, keyOffset);
        if (keyEnd === -1 || keyEnd >= objectEndExclusive) {
          return null;
        }

        const keyText = text.slice(keyOffset + 1, keyEnd);
        const colonIndex = skipWhitespace(text, keyEnd + 1);
        if (colonIndex < objectEndExclusive && text[colonIndex] === ':' && keyText === key) {
          const valueStart = skipWhitespace(text, colonIndex + 1);
          const valueRange = findValueRange(text, valueStart, objectEndExclusive);
          if (!valueRange) {
            return null;
          }

          return {
            keyOffset,
            valueStart: valueRange.start,
            valueEnd: valueRange.end,
          };
        }

        cursor = keyEnd + 1;
        continue;
      }

      inString = true;
      cursor += 1;
      continue;
    }

    if (char === '{' || char === '[') {
      structuralDepth += 1;
      cursor += 1;
      continue;
    }

    if (char === '}' || char === ']') {
      structuralDepth -= 1;
      if (structuralDepth <= 0) {
        break;
      }
      cursor += 1;
      continue;
    }

    cursor += 1;
  }

  return null;
}

function collectTopLevelObjectRangesInArray(
  text: string,
  arrayStart: number,
  arrayEndExclusive: number
): Array<{ start: number; end: number }> {
  if (
    arrayStart < 0 ||
    arrayEndExclusive <= arrayStart ||
    text[arrayStart] !== '[' ||
    arrayEndExclusive > text.length
  ) {
    return [];
  }

  const ranges: Array<{ start: number; end: number }> = [];
  let cursor = arrayStart + 1;

  while (cursor < arrayEndExclusive) {
    cursor = skipWhitespace(text, cursor);
    if (cursor >= arrayEndExclusive || text[cursor] === ']') {
      break;
    }

    if (text[cursor] === '{') {
      const objectEnd = findMatchingBracket(text, cursor, '{', '}');
      if (objectEnd !== -1 && objectEnd < arrayEndExclusive) {
        ranges.push({ start: cursor, end: objectEnd + 1 });
        cursor = objectEnd + 1;
      } else {
        break;
      }
    } else {
      cursor += 1;
    }

    while (cursor < arrayEndExclusive && text[cursor] !== ',') {
      if (text[cursor] === ']') {
        return ranges;
      }
      cursor += 1;
    }
    if (cursor < arrayEndExclusive && text[cursor] === ',') {
      cursor += 1;
    }
  }

  return ranges;
}

function findPropertyViaCombinators(
  text: string,
  key: string,
  objectStart: number,
  objectEndExclusive: number
): { keyOffset: number; valueStart: number; valueEnd: number } | null {
  for (const combinator of ['allOf', 'anyOf', 'oneOf']) {
    const combinatorEntry = findTopLevelPropertyInObjectRange(
      text,
      combinator,
      objectStart,
      objectEndExclusive
    );
    if (!combinatorEntry || text[combinatorEntry.valueStart] !== '[') {
      continue;
    }

    const branches = collectTopLevelObjectRangesInArray(
      text,
      combinatorEntry.valueStart,
      combinatorEntry.valueEnd
    );

    for (const branch of branches) {
      const viaProperties = findTopLevelPropertyInObjectRange(
        text,
        'properties',
        branch.start,
        branch.end
      );
      if (viaProperties && text[viaProperties.valueStart] === '{') {
        const nested = findTopLevelPropertyInObjectRange(
          text,
          key,
          viaProperties.valueStart,
          viaProperties.valueEnd
        );
        if (nested) {
          return nested;
        }
      }

      const direct = findTopLevelPropertyInObjectRange(text, key, branch.start, branch.end);
      if (direct) {
        return direct;
      }

      const recursive = findPropertyViaCombinators(text, key, branch.start, branch.end);
      if (recursive) {
        return recursive;
      }
    }
  }

  return null;
}

function findPropertyViaSchemaStructure(
  schemaText: string,
  pathValue: string
): { keyOffset: number; valueStart: number; valueEnd: number } | null {
  const rootStart = skipWhitespace(schemaText, 0);
  if (rootStart >= schemaText.length || schemaText[rootStart] !== '{') {
    return null;
  }

  const rootEnd = findMatchingBracket(schemaText, rootStart, '{', '}');
  if (rootEnd === -1) {
    return null;
  }

  const segments = pathValue
    .split('.')
    .map((segment) => segment.replace(/\[[^\]]+\]/g, ''))
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return null;
  }

  let currentObjectStart = rootStart;
  let currentObjectEnd = rootEnd + 1;
  let matched: { keyOffset: number; valueStart: number; valueEnd: number } | null = null;

  for (const segment of segments) {
    const propertiesEntry = findTopLevelPropertyInObjectRange(
      schemaText,
      'properties',
      currentObjectStart,
      currentObjectEnd
    );

    matched = null;
    if (propertiesEntry && schemaText[propertiesEntry.valueStart] === '{') {
      matched = findTopLevelPropertyInObjectRange(
        schemaText,
        segment,
        propertiesEntry.valueStart,
        propertiesEntry.valueEnd
      );
    }

    if (!matched) {
      matched = findPropertyViaCombinators(
        schemaText,
        segment,
        currentObjectStart,
        currentObjectEnd
      );
    }

    if (!matched) {
      let candidateObjectStart = currentObjectStart;
      let candidateObjectEnd = currentObjectEnd;
      const visitedItemRanges = new Set<string>();

      while (true) {
        const itemsEntry = findTopLevelPropertyInObjectRange(
          schemaText,
          'items',
          candidateObjectStart,
          candidateObjectEnd
        );
        if (!itemsEntry || schemaText[itemsEntry.valueStart] !== '{') {
          break;
        }

        const itemRangeKey = `${itemsEntry.valueStart}:${itemsEntry.valueEnd}`;
        if (visitedItemRanges.has(itemRangeKey)) {
          break;
        }
        visitedItemRanges.add(itemRangeKey);

        const nestedProperties = findTopLevelPropertyInObjectRange(
          schemaText,
          'properties',
          itemsEntry.valueStart,
          itemsEntry.valueEnd
        );
        if (!nestedProperties || schemaText[nestedProperties.valueStart] !== '{') {
          candidateObjectStart = itemsEntry.valueStart;
          candidateObjectEnd = itemsEntry.valueEnd;
          continue;
        }

        matched = findTopLevelPropertyInObjectRange(
          schemaText,
          segment,
          nestedProperties.valueStart,
          nestedProperties.valueEnd
        );
        if (matched) {
          break;
        }

        candidateObjectStart = itemsEntry.valueStart;
        candidateObjectEnd = itemsEntry.valueEnd;
      }
    }

    if (!matched || schemaText[matched.valueStart] !== '{') {
      break;
    }

    currentObjectStart = matched.valueStart;
    currentObjectEnd = matched.valueEnd;
  }

  return matched;
}

function findBestPropertyOffset(
  schemaText: string,
  pathValue: string,
  pathKind: 'property' | 'value' = 'property',
  valueToken?: string
): number {
  const matched = findPropertyViaSchemaStructure(schemaText, pathValue);

  if (!matched) {
    return 0;
  }

  if (pathKind === 'value' && valueToken) {
    const quotedValue = `"${valueToken}"`;
    const valueIndex = schemaText.indexOf(quotedValue, matched.valueStart);
    if (valueIndex !== -1 && valueIndex < matched.valueEnd) {
      return valueIndex;
    }
  }

  return matched.keyOffset;
}

function stripJsonQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function decodeJsonPointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function splitPropertyPath(pathValue: string): string[] {
  return pathValue
    .split('.')
    .map((segment) => segment.replace(/\[[^\]]+\]/g, ''))
    .filter((segment) => segment.length > 0);
}

function findPropertyMatchInObjectRange(
  schemaText: string,
  segment: string,
  objectStart: number,
  objectEndExclusive: number
): { keyOffset: number; valueStart: number; valueEnd: number } | null {
  const propertiesEntry = findTopLevelPropertyInObjectRange(
    schemaText,
    'properties',
    objectStart,
    objectEndExclusive
  );
  if (propertiesEntry && schemaText[propertiesEntry.valueStart] === '{') {
    const directProperty = findTopLevelPropertyInObjectRange(
      schemaText,
      segment,
      propertiesEntry.valueStart,
      propertiesEntry.valueEnd
    );
    if (directProperty) {
      return directProperty;
    }
  }

  const combinatorProperty = findPropertyViaCombinators(
    schemaText,
    segment,
    objectStart,
    objectEndExclusive
  );
  if (combinatorProperty) {
    return combinatorProperty;
  }

  let candidateObjectStart = objectStart;
  let candidateObjectEnd = objectEndExclusive;
  const visitedItemRanges = new Set<string>();
  while (true) {
    const itemsEntry = findTopLevelPropertyInObjectRange(
      schemaText,
      'items',
      candidateObjectStart,
      candidateObjectEnd
    );
    if (!itemsEntry || schemaText[itemsEntry.valueStart] !== '{') {
      break;
    }

    const itemRangeKey = `${itemsEntry.valueStart}:${itemsEntry.valueEnd}`;
    if (visitedItemRanges.has(itemRangeKey)) {
      break;
    }
    visitedItemRanges.add(itemRangeKey);

    const nestedProperties = findTopLevelPropertyInObjectRange(
      schemaText,
      'properties',
      itemsEntry.valueStart,
      itemsEntry.valueEnd
    );
    if (nestedProperties && schemaText[nestedProperties.valueStart] === '{') {
      const itemProperty = findTopLevelPropertyInObjectRange(
        schemaText,
        segment,
        nestedProperties.valueStart,
        nestedProperties.valueEnd
      );
      if (itemProperty) {
        return itemProperty;
      }
    }

    candidateObjectStart = itemsEntry.valueStart;
    candidateObjectEnd = itemsEntry.valueEnd;
  }

  return null;
}

function resolveRefTargetUri(baseUri: string, refSource: string): string | null {
  if (!baseUri.startsWith('file://')) {
    return null;
  }

  if (!refSource || refSource === '#') {
    return baseUri;
  }

  if (refSource.startsWith('http://') || refSource.startsWith('https://')) {
    return refSource;
  }

  if (refSource.startsWith('#')) {
    return baseUri;
  }

  try {
    const baseFilePath = fileURLToPath(baseUri);
    const absolute = path.resolve(path.dirname(baseFilePath), refSource);
    return pathToFileURL(absolute).toString();
  } catch {
    return null;
  }
}

function findObjectRangeByPointer(
  schemaText: string,
  pointer: string
): { start: number; end: number } | null {
  const rootStart = skipWhitespace(schemaText, 0);
  if (rootStart >= schemaText.length || schemaText[rootStart] !== '{') {
    return null;
  }

  const rootEnd = findMatchingBracket(schemaText, rootStart, '{', '}');
  if (rootEnd === -1) {
    return null;
  }

  if (!pointer || pointer === '#') {
    return { start: rootStart, end: rootEnd + 1 };
  }

  const normalized = pointer.startsWith('#') ? pointer.slice(1) : pointer;
  if (!normalized.startsWith('/')) {
    return { start: rootStart, end: rootEnd + 1 };
  }

  const segments = normalized
    .split('/')
    .slice(1)
    .map((segment) => decodeJsonPointerSegment(segment));

  let currentStart = rootStart;
  let currentEnd = rootEnd + 1;

  for (const segment of segments) {
    const next = findTopLevelPropertyInObjectRange(schemaText, segment, currentStart, currentEnd);
    if (!next || schemaText[next.valueStart] !== '{') {
      return null;
    }

    currentStart = next.valueStart;
    currentEnd = next.valueEnd;
  }

  return { start: currentStart, end: currentEnd };
}

function resolvePathDefinitionAcrossRefs(
  rootUri: string,
  pathValue: string,
  pathKind: 'property' | 'value',
  valueToken: string | undefined,
  maxDepth = 8
): ResolvedSchemaPathTarget | null {
  if (!rootUri.startsWith('file://')) {
    return null;
  }

  const segments = splitPropertyPath(pathValue);
  if (segments.length === 0) {
    return null;
  }

  const visit = (
    activeUri: string,
    remainingSegments: string[],
    pointer: string,
    depth: number,
    seen: Set<string>
  ): ResolvedSchemaPathTarget | null => {
    if (depth > maxDepth || !activeUri.startsWith('file://')) {
      return null;
    }

    const visitKey = `${activeUri}::${pointer}::${remainingSegments.join('.')}`;
    if (seen.has(visitKey)) {
      return null;
    }
    seen.add(visitKey);

    let schemaText: string;
    try {
      schemaText = readFileSync(fileURLToPath(activeUri), 'utf-8');
    } catch {
      return null;
    }

    const pointerRange = findObjectRangeByPointer(schemaText, pointer);
    if (!pointerRange) {
      return null;
    }

    let currentStart = pointerRange.start;
    let currentEnd = pointerRange.end;
    let lastMatch: { keyOffset: number; valueStart: number; valueEnd: number } | null = null;

    for (let index = 0; index < remainingSegments.length; index += 1) {
      const segment = remainingSegments[index];
      const matched = findPropertyMatchInObjectRange(schemaText, segment, currentStart, currentEnd);
      if (!matched) {
        return null;
      }

      lastMatch = matched;

      if (index === remainingSegments.length - 1) {
        if (pathKind === 'value' && valueToken) {
          const quotedValue = `"${valueToken}"`;
          const valueIndex = schemaText.indexOf(quotedValue, matched.valueStart);
          if (valueIndex !== -1 && valueIndex < matched.valueEnd) {
            return {
              uri: activeUri,
              startOffset: valueIndex,
              pathAtTarget: remainingSegments.slice(0, index + 1).join('.'),
            };
          }
        }

        return {
          uri: activeUri,
          startOffset: matched.keyOffset,
          pathAtTarget: remainingSegments.slice(0, index + 1).join('.'),
        };
      }

      const refEntry =
        schemaText[matched.valueStart] === '{'
          ? findTopLevelPropertyInObjectRange(
              schemaText,
              '$ref',
              matched.valueStart,
              matched.valueEnd
            )
          : null;

      if (refEntry) {
        const refValueRaw = schemaText.slice(refEntry.valueStart, refEntry.valueEnd);
        const refValue = stripJsonQuotes(refValueRaw);
        const splitRef = splitSchemaSourceReference(refValue);
        const targetUri = resolveRefTargetUri(activeUri, splitRef.source);
        if (targetUri) {
          const targetPointer = splitRef.fragment ?? '#';
          return visit(
            targetUri,
            remainingSegments.slice(index + 1),
            targetPointer,
            depth + 1,
            seen
          );
        }
      }

      if (schemaText[matched.valueStart] !== '{') {
        return {
          uri: activeUri,
          startOffset: matched.keyOffset,
          pathAtTarget: remainingSegments.slice(0, index + 1).join('.'),
        };
      }

      currentStart = matched.valueStart;
      currentEnd = matched.valueEnd;
    }

    if (lastMatch) {
      return {
        uri: activeUri,
        startOffset: lastMatch.keyOffset,
        pathAtTarget: remainingSegments.join('.'),
      };
    }

    return null;
  };

  return visit(rootUri, segments, '#', 0, new Set<string>());
}

function stableSerialize(value: unknown): string {
  const visited = new WeakSet<object>();

  const normalize = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') {
      return input;
    }

    if (visited.has(input)) {
      return '[Circular]';
    }
    visited.add(input);

    if (Array.isArray(input)) {
      return input.map((item) => normalize(item));
    }

    const record = input as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      result[key] = normalize(record[key]);
    }
    return result;
  };

  const serialized = JSON.stringify(normalize(value));
  return serialized ?? 'undefined';
}

let nextSnapshotSchemaId = 1;
const snapshotSchemaIdMap = new WeakMap<object, number>();
const snapshotSchemaHashBySerialized = new Map<string, string>();

function hashStringFNV1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function getSnapshotSchemaToken(schema: unknown): string {
  if (schema && typeof schema === 'object') {
    const existingId = snapshotSchemaIdMap.get(schema);
    if (existingId !== undefined) {
      return `id:${existingId}`;
    }

    const assignedId = nextSnapshotSchemaId;
    nextSnapshotSchemaId += 1;
    snapshotSchemaIdMap.set(schema, assignedId);
    return `id:${assignedId}`;
  }

  const serialized = stableSerialize(schema);
  const existingHash = snapshotSchemaHashBySerialized.get(serialized);
  if (existingHash !== undefined) {
    return `hash:${existingHash}`;
  }

  const computedHash = hashStringFNV1a(serialized);
  snapshotSchemaHashBySerialized.set(serialized, computedHash);
  return `hash:${computedHash}`;
}

function buildSnapshotCacheKey(options: { schema?: object; contentSchema?: object }): string {
  const frontmatterHash = getSnapshotSchemaToken(options.schema);
  const contentOrFallbackSchema = options.contentSchema ?? options.schema;
  const contentHash = getSnapshotSchemaToken(contentOrFallbackSchema);
  return `${frontmatterHash}::${contentHash}`;
}

function getParentPath(path: string): string {
  const lastDot = path.lastIndexOf('.');
  return lastDot === -1 ? '' : path.slice(0, lastDot);
}

function getLabel(path: string): string {
  const lastDot = path.lastIndexOf('.');
  const label = lastDot === -1 ? path : path.slice(lastDot + 1);
  return label.replace(/\[[^\]]+\]/g, '');
}

function resolveProfileId(context: SemanticQueryContext): string {
  return (
    context.semanticZone?.profileId ??
    context.profileId ??
    getSemanticProfileId(context.contextBlock ?? 'content')
  );
}

function resolveZoneKind(context: SemanticQueryContext): 'metadata' | 'body' {
  return (
    context.semanticZone?.kind ?? (context.contextBlock === 'frontmatter' ? 'metadata' : 'body')
  );
}

function resolveSchemaUriForContext(
  context: SemanticQueryContext,
  options: Pick<SemanticSchemaReadOptions, 'schemaUri' | 'contentSchemaUri'>
): string | undefined {
  return resolveZoneKind(context) === 'metadata'
    ? options.schemaUri
    : (options.contentSchemaUri ?? options.schemaUri);
}

function buildPathNodes(contextBlock: SemanticContextBlock, schema?: object): ContextNode[] {
  if (!schema) {
    return [];
  }

  const profileId = getSemanticProfileId(contextBlock);

  const metadata = new SchemaValidator(schema).getMetadata();
  const nodes: ContextNode[] = [];

  for (const [path, entry] of Object.entries(metadata)) {
    nodes.push({
      id: `${profileId}:schema-path:${path}`,
      profileId,
      kind: 'schema-path',
      attributes: {
        path,
        parentPath: getParentPath(path),
        label: getLabel(path),
        type: entry.type,
        description: entry.description ?? '',
        contextBlock,
        isTopLevel: getParentPath(path) === '',
        isDirectProperty: !path.includes('.') && !path.includes('['),
      },
    });
  }

  const walkSchema = (node: unknown, currentPath = ''): void => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      return;
    }

    const record = node as Record<string, unknown>;
    if (currentPath && Array.isArray(record.enum)) {
      for (const value of record.enum) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          nodes.push({
            id: `${profileId}:schema-enum:${currentPath}:${String(value)}`,
            profileId,
            kind: 'schema-enum-value',
            attributes: {
              path: currentPath,
              value,
              label: String(value),
              contextBlock,
            },
          });
        }
      }
    }

    const properties = record.properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      return;
    }

    for (const [key, child] of Object.entries(properties as Record<string, unknown>)) {
      walkSchema(child, currentPath ? `${currentPath}.${key}` : key);
    }
  };

  walkSchema(schema);
  return nodes;
}

function filterNodes(snapshot: GraphSnapshot, request: QueryRequest): ContextNode[] {
  return snapshot.nodes.filter((node) => {
    if (request.nodes?.kind && node.kind !== request.nodes.kind) {
      return false;
    }

    if (request.nodes?.profileIds && !request.nodes.profileIds.includes(node.profileId)) {
      return false;
    }

    if (request.nodes?.attributeEquals) {
      const attributes = node.attributes ?? {};
      for (const [key, value] of Object.entries(request.nodes.attributeEquals)) {
        if (attributes[key] !== value) {
          return false;
        }
      }
    }

    return true;
  });
}

function querySnapshot(snapshot: GraphSnapshot, request: QueryRequest): QueryResponse {
  return {
    version: request.version,
    revision: snapshot.revision,
    nodes: filterNodes(snapshot, request).sort((left, right) => left.id.localeCompare(right.id)),
    edges: [],
  };
}

export class ContextGraphSemanticReadAdapter {
  private readonly snapshotCache = new Map<string, GraphSnapshot>();

  private getSnapshot(options: { schema?: object; contentSchema?: object }): GraphSnapshot {
    const cacheKey = buildSnapshotCacheKey(options);
    const cachedSnapshot = this.snapshotCache.get(cacheKey);
    if (cachedSnapshot) {
      return cachedSnapshot;
    }

    const snapshot = this.buildSnapshot(options);
    this.snapshotCache.set(cacheKey, snapshot);
    return snapshot;
  }

  private expandScopedPath(path: string, bindings: TemplateScopeBinding[]): string {
    let resolved = path;
    const usedBindingIndexes = new Set<number>();

    for (let iteration = 0; iteration < bindings.length; iteration += 1) {
      let changed = false;

      for (const [bindingIndex, binding] of bindings.entries()) {
        if (usedBindingIndexes.has(bindingIndex)) {
          continue;
        }

        if (
          resolved === binding.alias ||
          resolved.startsWith(`${binding.alias}.`) ||
          resolved.startsWith(`${binding.alias}[`)
        ) {
          const iterableBase = binding.iterablePath.endsWith(']')
            ? binding.iterablePath
            : `${binding.iterablePath}[0]`;
          resolved = `${iterableBase}${resolved.slice(binding.alias.length)}`;
          usedBindingIndexes.add(bindingIndex);
          changed = true;
          break;
        }
      }

      if (!changed) {
        break;
      }
    }

    return resolved;
  }

  private buildSnapshot(options: { schema?: object; contentSchema?: object }): GraphSnapshot {
    return {
      version: 'v1',
      revision: 1,
      nodes: [
        ...buildPathNodes('frontmatter', options.schema),
        ...buildPathNodes('content', options.contentSchema ?? options.schema),
      ],
      edges: [],
    };
  }

  getPathDetails(
    context: SemanticQueryContext,
    path: string,
    options: SemanticSchemaReadOptions
  ): SchemaPathDetails | null {
    const contextProfileId = resolveProfileId(context);
    const response = this.query(
      options,
      {
        version: 'v1',
        nodes: {
          profileIds: [contextProfileId],
          kind: 'schema-path',
          attributeEquals: {
            path,
            operation: context.operation,
            ...(context.documentUri ? { documentUri: context.documentUri } : {}),
            ...(typeof context.offset === 'number' ? { offset: context.offset } : {}),
            ...(typeof context.line === 'number' ? { line: context.line } : {}),
            ...(typeof context.character === 'number' ? { character: context.character } : {}),
          },
        },
      },
      context
    );

    const node = response.nodes[0];
    if (node?.attributes) {
      return {
        path,
        type: typeof node.attributes.type === 'string' ? node.attributes.type : undefined,
        description:
          typeof node.attributes.description === 'string' ? node.attributes.description : undefined,
      };
    }

    const schemaUri = resolveSchemaUriForContext(context, options);
    if (!schemaUri) {
      return null;
    }

    const resolved = resolvePathDefinitionAcrossRefs(schemaUri, path, 'property', undefined);
    if (!resolved || !resolved.uri.startsWith('file://')) {
      return null;
    }

    try {
      const schemaText = readFileSync(fileURLToPath(resolved.uri), 'utf-8');
      const schema = JSON.parse(schemaText) as object;
      const metadata = new SchemaValidator(schema).getMetadata();
      const entry = metadata[resolved.pathAtTarget];
      if (!entry) {
        return null;
      }

      return {
        path,
        type: entry.type,
        description: entry.description,
      };
    } catch {
      return null;
    }
  }

  getChildCompletions(
    context: SemanticQueryContext,
    parentPath: string,
    options: SemanticSchemaReadOptions
  ): SemanticCompletionCandidate[] {
    const contextProfileId = resolveProfileId(context);
    const attributes: QueryAttributes = parentPath
      ? {
          parentPath,
          operation: context.operation,
          ...(context.documentUri ? { documentUri: context.documentUri } : {}),
          ...(typeof context.offset === 'number' ? { offset: context.offset } : {}),
          ...(typeof context.line === 'number' ? { line: context.line } : {}),
          ...(typeof context.character === 'number' ? { character: context.character } : {}),
        }
      : {
          parentPath: '',
          operation: context.operation,
          ...(context.documentUri ? { documentUri: context.documentUri } : {}),
          ...(typeof context.offset === 'number' ? { offset: context.offset } : {}),
          ...(typeof context.line === 'number' ? { line: context.line } : {}),
          ...(typeof context.character === 'number' ? { character: context.character } : {}),
          isDirectProperty: true,
        };
    const response = this.query(
      options,
      {
        version: 'v1',
        nodes: {
          profileIds: [contextProfileId],
          kind: 'schema-path',
          attributeEquals: attributes,
        },
      },
      context
    );

    return response.nodes.map((node) => ({
      label: String(node.attributes?.label ?? ''),
      kind: parentPath ? 'property' : 'variable',
      detail: typeof node.attributes?.type === 'string' ? node.attributes.type : undefined,
      documentation:
        typeof node.attributes?.description === 'string' && node.attributes.description.length > 0
          ? node.attributes.description
          : undefined,
    }));
  }

  getEnumValueCompletions(
    context: SemanticQueryContext,
    path: string,
    options: SemanticSchemaReadOptions
  ): SemanticCompletionCandidate[] {
    const contextProfileId = resolveProfileId(context);
    const response = this.query(
      options,
      {
        version: 'v1',
        nodes: {
          profileIds: [contextProfileId],
          kind: 'schema-enum-value',
          attributeEquals: {
            path,
            operation: context.operation,
            ...(context.documentUri ? { documentUri: context.documentUri } : {}),
            ...(typeof context.offset === 'number' ? { offset: context.offset } : {}),
            ...(typeof context.line === 'number' ? { line: context.line } : {}),
            ...(typeof context.character === 'number' ? { character: context.character } : {}),
          },
        },
      },
      context
    );

    return response.nodes.map((node) => ({
      label: String(node.attributes?.label ?? ''),
      kind: 'keyword',
      detail: `${path} enum`,
    }));
  }

  resolveScopedPath(text: string, path: string, offset: number): string {
    const bindings = extractTemplateScopeBindings(text)
      .filter((binding) => offset >= binding.scopeStartOffset && offset < binding.scopeEndOffset)
      .sort((left, right) => right.scopeStartOffset - left.scopeStartOffset);

    return this.expandScopedPath(path, bindings);
  }

  getScopeBindings(text: string): TemplateScopeBinding[] {
    return extractTemplateScopeBindings(text);
  }

  resolveDocumentDefinition(
    _context: SemanticQueryContext,
    text: string,
    offset: number,
    options: DefinitionResolutionOptions
  ): DefinitionTarget | null {
    return (
      getPathValueDefinition(text, offset, options) ??
      getSchemaPathDefinition(text, offset, options)
    );
  }

  resolveDefinitionLocation(
    _context: SemanticQueryContext,
    descriptor: SemanticDefinitionDescriptor
  ): DefinitionTarget {
    if (!descriptor.path || !descriptor.uri.startsWith('file://')) {
      return toDefinitionTarget(descriptor.uri);
    }

    const refResolved = resolvePathDefinitionAcrossRefs(
      descriptor.uri,
      descriptor.path,
      descriptor.pathKind ?? 'property',
      descriptor.valueToken
    );
    if (refResolved) {
      try {
        const targetText = readFileSync(fileURLToPath(refResolved.uri), 'utf-8');
        const endOffset = Math.min(
          targetText.length,
          refResolved.startOffset +
            Math.max(
              (descriptor.valueToken ?? descriptor.path.split('.').pop() ?? '').length + 2,
              3
            )
        );

        return {
          uri: refResolved.uri,
          range: {
            start: getPositionForOffset(targetText, refResolved.startOffset),
            end: getPositionForOffset(targetText, endOffset),
          },
        };
      } catch {
        return toDefinitionTarget(refResolved.uri);
      }
    }

    try {
      const schemaFilePath = fileURLToPath(descriptor.uri);
      const schemaText = readFileSync(schemaFilePath, 'utf-8');
      const startOffset = findBestPropertyOffset(
        schemaText,
        descriptor.path,
        descriptor.pathKind,
        descriptor.valueToken
      );
      const endOffset = Math.min(
        schemaText.length,
        startOffset +
          Math.max((descriptor.valueToken ?? descriptor.path.split('.').pop() ?? '').length + 2, 3)
      );

      return {
        uri: descriptor.uri,
        range: {
          start: getPositionForOffset(schemaText, startOffset),
          end: getPositionForOffset(schemaText, endOffset),
        },
      };
    } catch {
      return toDefinitionTarget(descriptor.uri);
    }
  }

  resolvePathDefinition(
    context: SemanticQueryContext,
    path: string,
    options: SemanticDefinitionOptions,
    pathKind: 'property' | 'value' = 'property',
    valueToken?: string
  ): DefinitionTarget | null {
    const uri = resolveSchemaUriForContext(context, options);

    if (!uri) {
      return null;
    }

    return this.resolveDefinitionLocation(context, {
      uri,
      path,
      pathKind,
      valueToken,
    });
  }

  private withContext(snapshot: GraphSnapshot, context?: SemanticQueryContext): GraphSnapshot {
    if (!context) {
      return snapshot;
    }

    const contextAttributes: Record<string, JsonPrimitive> = {
      operation: context.operation,
      profileId: resolveProfileId(context),
      zoneKind: resolveZoneKind(context),
      contextBlock: context.contextBlock ?? context.semanticZone?.legacyContextBlock ?? 'content',
    };
    if (context.documentUri) {
      contextAttributes.documentUri = context.documentUri;
    }
    if (typeof context.offset === 'number') {
      contextAttributes.offset = context.offset;
    }
    if (typeof context.line === 'number') {
      contextAttributes.line = context.line;
    }
    if (typeof context.character === 'number') {
      contextAttributes.character = context.character;
    }

    return {
      ...snapshot,
      nodes: snapshot.nodes.map((node) => ({
        ...node,
        attributes: {
          ...(node.attributes ?? {}),
          ...contextAttributes,
        },
      })),
    };
  }

  query(
    options: { schema?: object; contentSchema?: object },
    request: QueryRequest,
    context?: SemanticQueryContext
  ): QueryResponse {
    return querySnapshot(this.withContext(this.getSnapshot(options), context), request);
  }
}

export function createContextGraphSemanticReadAdapter(): ContextGraphSemanticReadAdapter {
  return new ContextGraphSemanticReadAdapter();
}
