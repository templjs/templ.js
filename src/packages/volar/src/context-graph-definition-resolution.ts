import {
  getFrontmatterKeyValueAtOffset,
  getFrontmatterSchemaAliases,
  getFrontmatterSchemaReferenceAtOffset,
  getTokenAtOffset,
  isOffsetInFrontmatter,
} from '@templjs/core';
import { existsSync } from 'fs';
import { pathToFileURL } from 'url';
import { schemaSourceResolutionTesting, splitSchemaSourceReference } from '@templjs/semantify';
import { resolveSchemaFilePathSync } from './schema-utils.js';

export {
  collectTopLevelObjectRangesInArray,
  decodeJsonPointerSegment,
  findBestPropertyOffset,
  findBestPropertyRange,
  findMatchingBracket,
  findObjectRangeByPointer,
  findPropertyMatchInObjectRange,
  findPropertyViaCombinators,
  findPropertyViaSchemaStructure,
  findStringEnd,
  findTopLevelPropertyInObjectRange,
  findValueRange,
  getPositionForOffset,
  resolvePathDefinitionAcrossRefs,
  resolveRefTargetUri,
  skipWhitespace,
  splitPropertyPath,
  splitSchemaSourceReference,
  stripJsonQuotes,
  type ResolvedSchemaPathTarget,
  type SchemaSourceRange,
  type SchemaSourceReference,
} from '@templjs/semantify';

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

/** @internal */
export const contextGraphDefinitionResolutionTesting = {
  ...schemaSourceResolutionTesting,
  getPathRegistryKeysFromSchema,
  isLikelyPathValue,
  toDefinitionTarget,
  getPathValueDefinition,
  getSchemaPathDefinition,
};
