import { constants, existsSync, promises as fsPromises } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

export interface SchemaSourceReference {
  source: string;
  fragment?: string;
}

export function splitSchemaSourceReference(rawSource: string): SchemaSourceReference {
  const trimmed = rawSource.trim();
  const hashIndex = trimmed.indexOf('#');
  if (hashIndex === -1) {
    return { source: trimmed };
  }

  const source = trimmed.slice(0, hashIndex).trim();
  const fragment = trimmed.slice(hashIndex);
  return {
    source,
    fragment: fragment.length > 0 ? fragment : undefined,
  };
}

export async function resolveSchemaFilePath(
  schemaPath: string,
  workspaceRoot: string | undefined,
  documentUri?: string
): Promise<string | undefined> {
  const { source } = splitSchemaSourceReference(schemaPath);

  if (source.startsWith('http://') || source.startsWith('https://')) {
    return source;
  }

  if (source.startsWith('file://')) {
    try {
      return fileURLToPath(source);
    } catch {
      return undefined;
    }
  }

  if (path.isAbsolute(source)) {
    return source;
  }

  if (
    (source.startsWith('./') || source.startsWith('../')) &&
    documentUri &&
    documentUri.startsWith('file://')
  ) {
    try {
      const documentFilePath = fileURLToPath(documentUri);
      const documentDirectory = path.dirname(documentFilePath);
      const documentRelativePath = path.resolve(documentDirectory, source);
      await fsPromises.access(documentRelativePath, constants.F_OK);
      return documentRelativePath;
    } catch {
      // Fall through to workspace-based resolution.
    }
  }

  if (!workspaceRoot) {
    return undefined;
  }

  return path.resolve(workspaceRoot, source);
}

export function resolveSchemaFilePathSync(
  schemaPath: string,
  workspaceRoot: string | undefined,
  documentUri?: string
): string | undefined {
  const { source } = splitSchemaSourceReference(schemaPath);

  if (source.startsWith('http://') || source.startsWith('https://')) {
    return source;
  }

  if (source.startsWith('file://')) {
    try {
      return fileURLToPath(source);
    } catch {
      return undefined;
    }
  }

  if (path.isAbsolute(source)) {
    return source;
  }

  if (
    (source.startsWith('./') || source.startsWith('../')) &&
    documentUri &&
    documentUri.startsWith('file://')
  ) {
    try {
      const documentFilePath = fileURLToPath(documentUri);
      const documentDirectory = path.dirname(documentFilePath);
      const documentRelativePath = path.resolve(documentDirectory, source);
      if (existsSync(documentRelativePath)) {
        return documentRelativePath;
      }
    } catch {
      // Fall through to workspace-based resolution.
    }
  }

  if (!workspaceRoot) {
    return undefined;
  }

  return path.resolve(workspaceRoot, source);
}
