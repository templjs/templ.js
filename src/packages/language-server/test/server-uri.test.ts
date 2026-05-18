import * as path from 'path';
import { pathToFileURL } from 'url';
import { describe, expect, it } from 'vitest';
import {
  deriveWorkspaceRootFromDocumentUri,
  isLikelySchemaUri,
  isMdTemplateUri,
  isYamlTemplateUri,
} from '../src/server-uri.js';

describe('server URI helpers', () => {
  it('classifies schema and template URIs', () => {
    expect(isLikelySchemaUri('file:///workspace/schema.json')).toBe(true);
    expect(isLikelySchemaUri('file:///workspace/schema.yaml?version=1')).toBe(true);
    expect(isLikelySchemaUri('file:///workspace/readme.txt')).toBe(false);
    expect(isLikelySchemaUri('file:///workspace/template.tmpl.json')).toBe(false);
    expect(isMdTemplateUri('file:///workspace/doc.markdown.tpl#section')).toBe(true);
    expect(isMdTemplateUri('file:///workspace/doc.html.tpl')).toBe(false);
    expect(isYamlTemplateUri('file:///workspace/data.yml.templ')).toBe(true);
    expect(isYamlTemplateUri('file:///workspace/data.md.templ')).toBe(false);
  });

  it('derives local workspace root URI and file path from document URI', () => {
    const documentPath = path.join(process.cwd(), 'workspace', 'nested', 'template.md.tpl');
    const workspacePath = path.dirname(documentPath);
    const derived = deriveWorkspaceRootFromDocumentUri(pathToFileURL(documentPath).href);

    expect(derived.rootUri).toBe(pathToFileURL(workspacePath).href);
    expect(derived.workspaceRoot).toBe(workspacePath);
  });

  it('returns an empty result for missing, non-file, malformed, and root-only URIs', () => {
    expect(deriveWorkspaceRootFromDocumentUri(undefined)).toEqual({});
    expect(deriveWorkspaceRootFromDocumentUri('https://example.com/template.md.tpl')).toEqual({});
    expect(deriveWorkspaceRootFromDocumentUri('file://%zz')).toEqual({});
    expect(deriveWorkspaceRootFromDocumentUri('file:///')).toEqual({});
  });

  it('keeps root URI when it cannot be converted to a local file path', () => {
    const derived = deriveWorkspaceRootFromDocumentUri('file://server/share/template.md.tpl');

    expect(derived.rootUri).toBe('file://server/share');
    expect(derived.workspaceRoot).toBeUndefined();
  });
});
