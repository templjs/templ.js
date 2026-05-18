import {
  getFrontmatterKeyValueAtOffset,
  getFrontmatterSchemaAliases,
  getFrontmatterSchemaReferenceAtOffset,
  getTokenAtOffset,
  isOffsetInFrontmatter,
} from '@templjs/core';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { splitSchemaSourceReference, resolveSchemaFilePathSync } from './schema-utils.js';

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

export interface SchemaPathDetails {
  path: string;
  type?: string;
  description?: string;
}

interface ResolvedSchemaPathTarget {
  uri: string;
  startOffset: number;
  pathAtTarget: string;
}

const ZERO_RANGE: DefinitionTarget['range'] = {
  start: { line: 0, character: 0 },
  end: { line: 0, character: 0 },
};

export function getPathRegistryKeysFromSchema(schema: unknown): Set<string> {
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

export function isLikelyPathValue(token: string): boolean {
  if (!token) {
    return false;
  }

  if (token.startsWith('http://') || token.startsWith('https://') || token.startsWith('file://')) {
    return true;
  }

  return /\//.test(token) || /\.[A-Za-z0-9]+($|[#?])/.test(token);
}

export function toDefinitionTarget(uri: string): DefinitionTarget {
  return { uri, range: ZERO_RANGE };
}

export function getPathValueDefinition(
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

export function getSchemaPathDefinition(
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

export function getPositionForOffset(
  text: string,
  offset: number
): { line: number; character: number } {
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

export function findMatchingBracket(
  text: string,
  start: number,
  open: string,
  close: string
): number {
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

export function skipWhitespace(text: string, index: number): number {
  let cursor = index;
  while (cursor < text.length && /\s/.test(text[cursor])) {
    cursor += 1;
  }
  return cursor;
}

export function findStringEnd(text: string, startQuote: number): number {
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

export function findValueRange(
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

export function findTopLevelPropertyInObjectRange(
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

export function collectTopLevelObjectRangesInArray(
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

export function findPropertyViaCombinators(
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

export function findPropertyViaSchemaStructure(
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

export function findBestPropertyOffset(
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

export function stripJsonQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function decodeJsonPointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

export function splitPropertyPath(pathValue: string): string[] {
  return pathValue
    .split('.')
    .map((segment) => segment.replace(/\[[^\]]+\]/g, ''))
    .filter((segment) => segment.length > 0);
}

export function findPropertyMatchInObjectRange(
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

export function resolveRefTargetUri(baseUri: string, refSource: string): string | null {
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

export function findObjectRangeByPointer(
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

export function resolvePathDefinitionAcrossRefs(
  rootUri: string,
  pathValue: string,
  pathKind: 'property' | 'value',
  valueToken: string | undefined,
  maxDepth = 8,
  readFn: (filePath: string) => string = (p) => readFileSync(p, 'utf-8')
): ResolvedSchemaPathTarget | null {
  if (!rootUri.startsWith('file://')) {
    return null;
  }

  const segments = splitPropertyPath(pathValue);
  if (segments.length === 0) {
    return {
      uri: rootUri,
      startOffset: 0,
      pathAtTarget: '',
    };
  }

  const visit = (
    activeUri: string,
    remainingSegments: string[],
    pointer: string,
    depth: number
  ): ResolvedSchemaPathTarget | null => {
    if (depth > maxDepth || !activeUri.startsWith('file://')) {
      return null;
    }

    let schemaText: string;
    try {
      schemaText = readFn(fileURLToPath(activeUri));
    } catch {
      return null;
    }

    const pointerRange = findObjectRangeByPointer(schemaText, pointer);
    if (!pointerRange) {
      return null;
    }

    let currentStart = pointerRange.start;
    let currentEnd = pointerRange.end;

    for (let index = 0; index < remainingSegments.length; index += 1) {
      const segment = remainingSegments[index];
      const matched = findPropertyMatchInObjectRange(schemaText, segment, currentStart, currentEnd);
      if (!matched) {
        return null;
      }

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

        if (schemaText[matched.valueStart] === '{') {
          const terminalRef = findTopLevelPropertyInObjectRange(
            schemaText,
            '$ref',
            matched.valueStart,
            matched.valueEnd
          );
          if (terminalRef) {
            const refValueRaw = schemaText.slice(terminalRef.valueStart, terminalRef.valueEnd);
            const refValue = stripJsonQuotes(refValueRaw);
            const splitRef = splitSchemaSourceReference(refValue);
            const targetUri = resolveRefTargetUri(activeUri, splitRef.source);
            if (targetUri) {
              const targetPointer = splitRef.fragment ?? '#';
              return visit(targetUri, [], targetPointer, depth + 1);
            }
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
          return visit(targetUri, remainingSegments.slice(index + 1), targetPointer, depth + 1);
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

    // Reached when remainingSegments is empty on a recursive visit (all segments
    // consumed by $ref redirection); returns the resolved pointer location.
    if (schemaText[pointerRange.start] === '{') {
      const pointerRef = findTopLevelPropertyInObjectRange(
        schemaText,
        '$ref',
        pointerRange.start,
        pointerRange.end
      );
      if (pointerRef) {
        const refValueRaw = schemaText.slice(pointerRef.valueStart, pointerRef.valueEnd);
        const refValue = stripJsonQuotes(refValueRaw);
        const splitRef = splitSchemaSourceReference(refValue);
        const targetUri = resolveRefTargetUri(activeUri, splitRef.source);
        if (targetUri) {
          const targetPointer = splitRef.fragment ?? '#';
          return visit(targetUri, [], targetPointer, depth + 1);
        }
      }
    }

    return {
      uri: activeUri,
      startOffset: pointerRange.start,
      pathAtTarget: remainingSegments.join('.'),
    };
  };

  return visit(rootUri, segments, '#', 0);
}

/** @internal */
export const contextGraphDefinitionResolutionTesting = {
  getPathRegistryKeysFromSchema,
  isLikelyPathValue,
  toDefinitionTarget,
  getPathValueDefinition,
  getSchemaPathDefinition,
  getPositionForOffset,
  findMatchingBracket,
  skipWhitespace,
  findStringEnd,
  findValueRange,
  findTopLevelPropertyInObjectRange,
  collectTopLevelObjectRangesInArray,
  findPropertyViaCombinators,
  findPropertyViaSchemaStructure,
  splitPropertyPath,
  stripJsonQuotes,
  findPropertyMatchInObjectRange,
  resolveRefTargetUri,
  findObjectRangeByPointer,
  findBestPropertyOffset,
  resolvePathDefinitionAcrossRefs,
};
