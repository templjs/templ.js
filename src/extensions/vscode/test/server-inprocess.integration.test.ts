import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileChangeType } from '@volar/language-server';
import { pathToFileURL } from 'url';

const onInitialize = vi.fn();
const onInitialized = vi.fn();
const onShutdown = vi.fn();
const onDidOpenTextDocument = vi.fn();
const onDidChangeTextDocument = vi.fn();
const onDidChangeWatchedFiles = vi.fn();
const onCompletion = vi.fn();
const onHover = vi.fn();
const onDefinition = vi.fn();
const sendDiagnostics = vi.fn();
const listen = vi.fn();
const consoleLog = vi.fn();
const consoleWarn = vi.fn();

const initialize = vi.fn(async () => ({ capabilities: {} }));
const initialized = vi.fn();
const shutdown = vi.fn();
const getProject = vi.fn();
const FILE_CHANGE_TYPE_CHANGED = FileChangeType.Changed;
const toFileUri = (filePath: string): string => pathToFileURL(filePath).href;

function completionLabels(result: unknown): string[] {
  if (Array.isArray(result)) {
    return result
      .map((item) => (item && typeof item === 'object' ? (item as { label?: unknown }).label : ''))
      .filter((label): label is string => typeof label === 'string' && label.length > 0);
  }

  if (
    result &&
    typeof result === 'object' &&
    'items' in result &&
    Array.isArray((result as { items?: unknown[] }).items)
  ) {
    return ((result as { items: Array<{ label?: unknown }> }).items ?? [])
      .map((item) => item?.label)
      .filter((label): label is string => typeof label === 'string' && label.length > 0);
  }

  return [];
}

function definitionUri(result: unknown): string | undefined {
  const candidate = Array.isArray(result) ? result[0] : result;
  if (!candidate || typeof candidate !== 'object') {
    return undefined;
  }

  if ('uri' in candidate && typeof (candidate as { uri?: string }).uri === 'string') {
    return (candidate as { uri: string }).uri;
  }

  if (
    'targetUri' in candidate &&
    typeof (candidate as { targetUri?: string }).targetUri === 'string'
  ) {
    return (candidate as { targetUri: string }).targetUri;
  }

  return undefined;
}

function definitionStartLine(result: unknown): number | undefined {
  const candidate = Array.isArray(result) ? result[0] : result;
  if (!candidate || typeof candidate !== 'object') {
    return undefined;
  }

  if ('range' in candidate) {
    return (candidate as { range?: { start?: { line?: number } } }).range?.start?.line;
  }

  if ('targetRange' in candidate) {
    return (candidate as { targetRange?: { start?: { line?: number } } }).targetRange?.start?.line;
  }

  return undefined;
}

vi.mock('@volar/language-server/node', () => ({
  createConnection: vi.fn(() => ({
    onInitialize,
    onInitialized,
    onShutdown,
    onDidOpenTextDocument,
    onDidChangeTextDocument,
    onDidChangeWatchedFiles,
    onCompletion,
    onHover,
    onDefinition,
    sendDiagnostics,
    console: {
      log: consoleLog,
      warn: consoleWarn,
    },
    listen,
  })),
  createServer: vi.fn(() => ({
    initialize,
    initialized,
    shutdown,
    projects: {
      getProject,
    },
  })),
  createSimpleProjectProvider: { name: 'simple-project-provider' },
}));

describe.skip('language-server-inprocess-integration', () => {
  beforeEach(() => {
    vi.resetModules();
    onInitialize.mockClear();
    onInitialized.mockClear();
    onShutdown.mockClear();
    onDidOpenTextDocument.mockClear();
    onDidChangeTextDocument.mockClear();
    onDidChangeWatchedFiles.mockClear();
    onCompletion.mockClear();
    onHover.mockClear();
    onDefinition.mockClear();
    sendDiagnostics.mockClear();
    consoleLog.mockClear();
    consoleWarn.mockClear();
    listen.mockClear();
    initialize.mockClear();
    initialized.mockClear();
    shutdown.mockClear();
    getProject.mockReset();
  });

  it('handles in-process LSP completion/hover across zones and survives incremental edits', async () => {
    const workspaceDir = mkdtempSync(path.join(tmpdir(), 'templjs-server-inproc-'));

    try {
      const frontmatterSchemaPath = path.join(workspaceDir, 'frontmatter.schema.json');
      const contentSchemaPath = path.join(workspaceDir, 'content.schema.json');

      writeFileSync(
        frontmatterSchemaPath,
        JSON.stringify({
          type: 'object',
          properties: {
            frontData: {
              type: 'object',
              properties: {
                title: { type: 'string' },
              },
            },
          },
        })
      );

      writeFileSync(
        contentSchemaPath,
        JSON.stringify({
          type: 'object',
          properties: {
            contentData: {
              type: 'object',
              properties: {
                heading: { type: 'string' },
              },
            },
          },
        })
      );

      await import('../src/server');

      const initializeHandler = onInitialize.mock.calls[0][0] as (params: unknown) => Promise<{
        capabilities: {
          completionProvider?: unknown;
          hoverProvider?: boolean;
        };
      }>;

      const docUri = toFileUri(path.join(workspaceDir, 'sample.md.templ'));
      const initialDocumentText = '---\ntitle: "{{ frontData.t }}"\n---\n{{ contentData.h }}';
      let activeLines = initialDocumentText.split('\n');

      const locate = (line: number, token: string, offsetInToken = 0) => {
        const character = activeLines[line].indexOf(token);
        if (character === -1) {
          throw new Error(`Token '${token}' not found on line ${line}`);
        }
        return { line, character: character + offsetInToken };
      };

      const initializeResult = await initializeHandler({
        rootUri: toFileUri(workspaceDir),
        initializationOptions: {
          schemaPath: frontmatterSchemaPath,
          contentSchemaPath,
        },
      });

      expect(initializeResult.capabilities.completionProvider).toBeDefined();
      expect(initializeResult.capabilities.hoverProvider).toBe(true);

      const didOpenHandler = onDidOpenTextDocument.mock.calls[0][0] as (params: {
        textDocument: { uri: string; text: string };
      }) => void;

      didOpenHandler({
        textDocument: {
          uri: docUri,
          text: initialDocumentText,
        },
      });

      const completionHandler = onCompletion.mock.calls[0][0] as (params: {
        textDocument: { uri: string };
        position: { line: number; character: number };
      }) => unknown;

      const frontmatterCompletions = await completionHandler({
        textDocument: { uri: docUri },
        position: locate(1, 'frontData.t', 'frontData.t'.length),
      });
      expect(completionLabels(frontmatterCompletions)).toContain('title');

      const contentCompletions = await completionHandler({
        textDocument: { uri: docUri },
        position: locate(3, 'contentData.h', 'contentData.h'.length),
      });
      expect(completionLabels(contentCompletions)).toContain('heading');

      const hoverHandler = onHover.mock.calls[0][0] as (params: {
        textDocument: { uri: string };
        position: { line: number; character: number };
      }) => { contents?: { kind: string; value: string } } | null;

      const didChangeHandler = onDidChangeTextDocument.mock.calls[0][0] as (params: {
        textDocument: { uri: string };
        contentChanges: Array<{
          range?: {
            start: { line: number; character: number };
            end: { line: number; character: number };
          };
          text: string;
        }>;
      }) => void;

      const hoverDocumentText =
        '---\ntitle: "{{ frontData.title }}"\n---\n{{ contentData.heading }}';
      didChangeHandler({
        textDocument: { uri: docUri },
        contentChanges: [{ text: hoverDocumentText }],
      });
      activeLines = hoverDocumentText.split('\n');

      const frontmatterHover = await hoverHandler({
        textDocument: { uri: docUri },
        position: locate(1, 'frontData.title', 2),
      });
      const frontmatterHoverText =
        typeof frontmatterHover?.contents === 'string'
          ? frontmatterHover.contents
          : frontmatterHover?.contents?.value;
      expect(frontmatterHoverText).toContain('frontData');

      const contentHover = await hoverHandler({
        textDocument: { uri: docUri },
        position: locate(3, 'contentData.heading', 2),
      });
      const contentHoverText =
        typeof contentHover?.contents === 'string'
          ? contentHover.contents
          : contentHover?.contents?.value;
      expect(contentHoverText).toContain('contentData');

      didChangeHandler({
        textDocument: { uri: docUri },
        contentChanges: [
          {
            range: {
              start: { line: 1, character: 0 },
              end: { line: 1, character: 0 },
            },
            text: '# ',
          },
        ],
      });

      activeLines = '---\n# title: "{{ frontData.title }}"\n---\n{{ contentData.heading }}'.split(
        '\n'
      );

      const contentCompletionsAfterEdit = await completionHandler({
        textDocument: { uri: docUri },
        position: locate(3, 'contentData.h', 'contentData.h'.length),
      });
      expect(completionLabels(contentCompletionsAfterEdit)).toContain('heading');
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('validates markdown host-language activation for .md.templ, .md.tmpl, and .md.tpl', async () => {
    const workspaceDir = mkdtempSync(path.join(tmpdir(), 'templjs-server-md-variants-'));

    try {
      const schemaPath = path.join(workspaceDir, 'schema.json');
      writeFileSync(
        schemaPath,
        JSON.stringify({
          type: 'object',
          properties: {
            contentData: {
              type: 'object',
              properties: {
                heading: { type: 'string' },
              },
            },
          },
        })
      );

      await import('../src/server');

      const initializeHandler = onInitialize.mock.calls[0][0] as (params: unknown) => Promise<{
        capabilities: {
          completionProvider?: unknown;
          hoverProvider?: boolean;
        };
      }>;

      const init = await initializeHandler({
        rootUri: toFileUri(workspaceDir),
        initializationOptions: {
          schemaPath,
        },
      });

      expect(init.capabilities.completionProvider).toBeDefined();
      expect(init.capabilities.hoverProvider).toBe(true);

      const didOpenHandler = onDidOpenTextDocument.mock.calls[0][0] as (params: {
        textDocument: { uri: string; text: string };
      }) => void;
      const didChangeHandler = onDidChangeTextDocument.mock.calls[0][0] as (params: {
        textDocument: { uri: string };
        contentChanges: Array<{
          range?: {
            start: { line: number; character: number };
            end: { line: number; character: number };
          };
          text: string;
        }>;
      }) => void;
      const completionHandler = onCompletion.mock.calls[0][0] as (params: {
        textDocument: { uri: string };
        position: { line: number; character: number };
      }) => unknown;

      for (const variant of ['templ', 'tmpl', 'tpl']) {
        const docUri = toFileUri(path.join(workspaceDir, `matrix.md.${variant}`));

        sendDiagnostics.mockClear();
        didOpenHandler({
          textDocument: {
            uri: docUri,
            text: '{{ contentData.missing }}',
          },
        });

        await vi.waitFor(() => {
          expect(sendDiagnostics).toHaveBeenCalledWith(expect.objectContaining({ uri: docUri }));
        });

        const lastDiagnosticsForDoc = [...sendDiagnostics.mock.calls]
          .reverse()
          .map((call) => call[0] as { uri: string; diagnostics: Array<{ code?: string }> })
          .find((payload) => payload.uri === docUri);
        expect(lastDiagnosticsForDoc).toBeDefined();
        expect(
          lastDiagnosticsForDoc?.diagnostics.some(
            (diag) => diag.code === 'templjs.undefinedVariable'
          )
        ).toBe(true);

        didChangeHandler({
          textDocument: { uri: docUri },
          contentChanges: [{ text: '{{ contentData.h }}' }],
        });

        const completionItems = await completionHandler({
          textDocument: { uri: docUri },
          position: { line: 0, character: '{{ contentData.h'.length },
        });
        expect(completionLabels(completionItems)).toContain('heading');
      }
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('re-publishes diagnostics for open documents when watched schema files change', async () => {
    const workspaceDir = mkdtempSync(path.join(tmpdir(), 'templjs-server-watch-'));

    try {
      const schemaPath = path.join(workspaceDir, 'schema.json');
      writeFileSync(
        schemaPath,
        JSON.stringify({
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
          },
        })
      );

      await import('../src/server');
      const initializeHandler = onInitialize.mock.calls[0][0] as (
        params: unknown
      ) => Promise<unknown>;
      await initializeHandler({
        rootUri: toFileUri(workspaceDir),
        initializationOptions: { schemaPath },
      });

      const docUri = toFileUri(path.join(workspaceDir, 'sample.md.tpl'));
      const didOpenHandler = onDidOpenTextDocument.mock.calls[0][0] as (params: {
        textDocument: { uri: string; text: string };
      }) => void;
      didOpenHandler({
        textDocument: {
          uri: docUri,
          text: '{{ user.name }}',
        },
      });

      await vi.waitFor(
        () => {
          expect(sendDiagnostics).toHaveBeenCalledWith(expect.objectContaining({ uri: docUri }));
        },
        { timeout: 5000 }
      );
      sendDiagnostics.mockClear();

      const watchedFilesRegistration = onDidChangeWatchedFiles.mock.calls[0];
      if (!watchedFilesRegistration || typeof watchedFilesRegistration[0] !== 'function') {
        throw new Error(
          'Server did not register onDidChangeWatchedFiles handler during test setup'
        );
      }

      const watchedFilesHandler = watchedFilesRegistration[0] as (event: {
        changes: Array<{ uri: string; type: number }>;
      }) => void;
      watchedFilesHandler({
        changes: [{ uri: toFileUri(schemaPath), type: FILE_CHANGE_TYPE_CHANGED }],
      });

      await vi.waitFor(
        () => {
          expect(sendDiagnostics).toHaveBeenCalledWith(expect.objectContaining({ uri: docUri }));
        },
        { timeout: 5000 }
      );
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('supports definition for frontmatter schema paths and template variables', async () => {
    const workspaceDir = mkdtempSync(path.join(tmpdir(), 'templjs-server-def-'));

    try {
      const frontmatterSchemaPath = path.join(workspaceDir, 'frontmatter.schema.json');
      const contentSchemaPath = path.join(workspaceDir, 'content.schema.json');

      writeFileSync(
        frontmatterSchemaPath,
        JSON.stringify(
          {
            type: 'object',
            properties: {
              frontData: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                },
              },
            },
          },
          null,
          2
        )
      );

      writeFileSync(
        contentSchemaPath,
        JSON.stringify(
          {
            type: 'object',
            properties: {
              contentData: {
                type: 'object',
                properties: {
                  heading: { type: 'string' },
                },
              },
            },
          },
          null,
          2
        )
      );

      await import('../src/server');

      const initializeHandler = onInitialize.mock.calls[0][0] as (params: unknown) => Promise<{
        capabilities: {
          definitionProvider?: boolean;
        };
      }>;

      const docUri = toFileUri(path.join(workspaceDir, 'sample.md.templ'));
      const text = [
        '---',
        `"$schema": ${path.basename(frontmatterSchemaPath)}`,
        `"$content_schema": ${path.basename(contentSchemaPath)}`,
        'title: "{{ frontData.title }}"',
        '---',
        '{{ contentData.heading }}',
      ].join('\n');
      const lines = text.split('\n');

      const locate = (line: number, token: string, offsetInToken = 0) => {
        const character = lines[line].indexOf(token);
        if (character === -1) {
          throw new Error(`Token '${token}' not found on line ${line}`);
        }
        return { line, character: character + offsetInToken };
      };

      const initializeResult = await initializeHandler({
        rootUri: toFileUri(workspaceDir),
        initializationOptions: {
          documentContext: {
            uri: docUri,
            content: text,
          },
        },
      });

      expect(initializeResult.capabilities.definitionProvider).toBe(true);

      const didOpenHandler = onDidOpenTextDocument.mock.calls[0][0] as (params: {
        textDocument: { uri: string; text: string };
      }) => void;
      didOpenHandler({
        textDocument: { uri: docUri, text },
      });

      const definitionHandler = onDefinition.mock.calls[0][0] as (params: {
        textDocument: { uri: string };
        position: { line: number; character: number };
      }) => { uri: string; range: { start: { line: number; character: number } } } | null;

      const schemaPathDefinition = await definitionHandler({
        textDocument: { uri: docUri },
        position: locate(1, path.basename(frontmatterSchemaPath), 2),
      });
      expect(definitionUri(schemaPathDefinition)).toBe(toFileUri(frontmatterSchemaPath));

      const contentSchemaPathDefinition = await definitionHandler({
        textDocument: { uri: docUri },
        position: locate(2, path.basename(contentSchemaPath), 2),
      });
      expect(definitionUri(contentSchemaPathDefinition)).toBe(toFileUri(contentSchemaPath));

      const frontVariableDefinition = await definitionHandler({
        textDocument: { uri: docUri },
        position: locate(3, 'frontData.title', 2),
      });
      expect(definitionUri(frontVariableDefinition)).toBe(toFileUri(frontmatterSchemaPath));
      expect(definitionStartLine(frontVariableDefinition)).toBeGreaterThanOrEqual(0);

      const contentVariableDefinition = await definitionHandler({
        textDocument: { uri: docUri },
        position: locate(5, 'contentData.heading', 2),
      });
      expect(definitionUri(contentVariableDefinition)).toBe(toFileUri(contentSchemaPath));
      expect(definitionStartLine(contentVariableDefinition)).toBeGreaterThanOrEqual(0);
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('supports schema fragments (#/$defs/...) for diagnostics and definitions', async () => {
    const workspaceDir = mkdtempSync(path.join(tmpdir(), 'templjs-server-fragment-'));

    try {
      const commonSchemaPath = path.join(workspaceDir, 'common.schema.json');

      writeFileSync(
        commonSchemaPath,
        JSON.stringify(
          {
            $defs: {
              milestone: {
                type: 'object',
                properties: {
                  relationships: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        target: { type: 'string' },
                        type: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          null,
          2
        )
      );

      await import('../src/server');

      const initializeHandler = onInitialize.mock.calls[0][0] as (params: unknown) => Promise<{
        capabilities: {
          definitionProvider?: boolean;
        };
      }>;

      const docUri = toFileUri(path.join(workspaceDir, 'sample.md.templ'));
      const schemaSource = `${path.basename(commonSchemaPath)}#/$defs/milestone`;
      const text = [
        '---',
        `"$schema": ${schemaSource}`,
        '---',
        '{% for relationship in relationships %}',
        '- {{ relationship.type }} -> {{ relationship.target }}',
        '{% endfor %}',
      ].join('\n');
      const lines = text.split('\n');

      const locate = (line: number, token: string, offsetInToken = 0) => {
        const character = lines[line].indexOf(token);
        if (character === -1) {
          throw new Error(`Token '${token}' not found on line ${line}`);
        }
        return { line, character: character + offsetInToken };
      };

      await initializeHandler({
        rootUri: toFileUri(workspaceDir),
        initializationOptions: {
          documentContext: {
            uri: docUri,
            content: text,
          },
        },
      });

      const didOpenHandler = onDidOpenTextDocument.mock.calls[0][0] as (params: {
        textDocument: { uri: string; text: string };
      }) => void;
      didOpenHandler({
        textDocument: { uri: docUri, text },
      });

      const definitionHandler = onDefinition.mock.calls[0][0] as (params: {
        textDocument: { uri: string };
        position: { line: number; character: number };
      }) => { uri: string; range: { start: { line: number; character: number } } } | null;

      const schemaPathDefinition = await definitionHandler({
        textDocument: { uri: docUri },
        position: locate(1, schemaSource, schemaSource.length - 'milestone'.length + 2),
      });
      expect(definitionUri(schemaPathDefinition)).toBe(toFileUri(commonSchemaPath));

      const loopAliasDefinition = await definitionHandler({
        textDocument: { uri: docUri },
        position: locate(4, 'relationship.target', 2),
      });
      expect(definitionUri(loopAliasDefinition)).toBe(docUri);
      expect(definitionStartLine(loopAliasDefinition)).toBeGreaterThan(0);
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('resolves definition range for array item properties without substring collisions', async () => {
    const workspaceDir = mkdtempSync(path.join(tmpdir(), 'templjs-server-def-range-'));

    try {
      const contentSchemaPath = path.join(workspaceDir, 'content.schema.json');
      const contentSchema = {
        type: 'object',
        properties: {
          relationships: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                target: { type: 'string' },
              },
            },
          },
        },
      };

      writeFileSync(contentSchemaPath, JSON.stringify(contentSchema, null, 2));

      await import('../src/server');

      const initializeHandler = onInitialize.mock.calls[0][0] as (params: unknown) => Promise<{
        capabilities: {
          definitionProvider?: boolean;
        };
      }>;

      const docUri = toFileUri(path.join(workspaceDir, 'sample.md.templ'));
      const text = [
        '---',
        `"$content_schema": ${path.basename(contentSchemaPath)}`,
        '---',
        '{{ relationships[0].type }}',
      ].join('\n');
      const lines = text.split('\n');

      const locate = (line: number, token: string, offsetInToken = 0) => {
        const character = lines[line].indexOf(token);
        if (character === -1) {
          throw new Error(`Token '${token}' not found on line ${line}`);
        }
        return { line, character: character + offsetInToken };
      };

      await initializeHandler({
        rootUri: toFileUri(workspaceDir),
        initializationOptions: {
          documentContext: {
            uri: docUri,
            content: text,
          },
        },
      });

      const didOpenHandler = onDidOpenTextDocument.mock.calls[0][0] as (params: {
        textDocument: { uri: string; text: string };
      }) => void;
      didOpenHandler({
        textDocument: { uri: docUri, text },
      });

      const definitionHandler = onDefinition.mock.calls[0][0] as (params: {
        textDocument: { uri: string };
        position: { line: number; character: number };
      }) => { uri: string; range: { start: { line: number; character: number } } } | null;

      const schemaLines = readFileSync(contentSchemaPath, 'utf-8').split('\n');
      const expectedItemTypeLine = schemaLines.findIndex((line) => /"type"\s*:\s*\{/.test(line));
      expect(expectedItemTypeLine).toBeGreaterThan(-1);

      const definition = await definitionHandler({
        textDocument: { uri: docUri },
        position: locate(3, 'relationships[0].type', 'relationships[0].type'.length - 2),
      });

      expect(definitionUri(definition)).toBe(toFileUri(contentSchemaPath));
      expect(definitionStartLine(definition)).toBe(expectedItemTypeLine);
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('handles ref-driven content schemas with loops, literals, filters, completion, and definition', async () => {
    const workspaceDir = mkdtempSync(path.join(tmpdir(), 'templjs-server-ref-driven-'));

    try {
      const frontmatterDir = path.join(workspaceDir, 'schemas/work-management/frontmatter');
      const contentDir = path.join(workspaceDir, 'schemas/work-management/content');
      const supportDir = path.join(workspaceDir, 'schemas/work-management/support');

      mkdirSync(frontmatterDir, { recursive: true });
      mkdirSync(contentDir, { recursive: true });
      mkdirSync(supportDir, { recursive: true });

      writeFileSync(
        path.join(frontmatterDir, 'milestone.json'),
        JSON.stringify(
          {
            type: 'object',
            properties: {
              type: { type: 'string' },
            },
          },
          null,
          2
        )
      );

      writeFileSync(
        path.join(supportDir, 'common.json'),
        JSON.stringify(
          {
            $defs: {
              relationship: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  target: { type: 'string' },
                  note: { type: 'string' },
                },
              },
              milestoneContent: {
                type: 'object',
                properties: {
                  milestoneObjective: { type: 'string' },
                  successSignals: { type: 'array', items: { type: 'string' } },
                  completionDefinition: { type: 'array', items: { type: 'string' } },
                  relationships: {
                    type: 'array',
                    items: { $ref: '#/$defs/relationship' },
                  },
                  notes: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
          null,
          2
        )
      );

      writeFileSync(
        path.join(contentDir, 'milestone.json'),
        JSON.stringify(
          {
            allOf: [{ $ref: '../support/common.json#/$defs/milestoneContent' }],
          },
          null,
          2
        )
      );

      await import('../src/server');

      const initializeHandler = onInitialize.mock.calls[0][0] as (params: unknown) => Promise<{
        capabilities: {
          completionProvider?: unknown;
          definitionProvider?: boolean;
        };
      }>;

      const docUri = toFileUri(path.join(workspaceDir, 'milestone.md.tpl'));
      const text = [
        '---',
        'type: milestone',
        '"$schema": schemas/work-management/frontmatter/milestone.json',
        '"$content_schema": schemas/work-management/content/milestone.json',
        '---',
        '',
        '{{ milestoneObjective }}',
        '{% for signal in successSignals %}',
        '- {{ signal }}',
        '{% endfor %}',
        '{% for condition in completionDefinition %}',
        '- [{{ condition.length > 0 ? "x" : " " }}] {{ condition }}',
        '{% endfor %}',
        '{% for relationship in relationships %}',
        '- {{ relationship.type }}: {{ relationship.target }}',
        '{% if relationship.note %}{{ relationship.note }}{% endif %}',
        '{% endfor %}',
        '{% if notes | length > 0 %}',
        '{% for note in notes %}',
        '- {{ note }}',
        '{% endfor %}',
        '{% else %}',
        '{{ notes }}',
        '{% endif %}',
      ].join('\n');
      const lines = text.split('\n');

      const locate = (line: number, token: string, offsetInToken = 0) => {
        const character = lines[line].indexOf(token);
        if (character === -1) {
          throw new Error(`Token '${token}' not found on line ${line}`);
        }
        return { line, character: character + offsetInToken };
      };

      const init = await initializeHandler({
        rootUri: toFileUri(workspaceDir),
        initializationOptions: {
          documentContext: {
            uri: docUri,
            content: text,
          },
        },
      });

      expect(init.capabilities.completionProvider).toBeDefined();
      expect(init.capabilities.definitionProvider).toBe(true);

      const didOpenHandler = onDidOpenTextDocument.mock.calls[0][0] as (params: {
        textDocument: { uri: string; text: string };
      }) => void;
      didOpenHandler({ textDocument: { uri: docUri, text } });

      await vi.waitFor(() => {
        expect(sendDiagnostics).toHaveBeenCalled();
      });

      const diagnosticsCall = sendDiagnostics.mock.calls[
        sendDiagnostics.mock.calls.length - 1
      ]?.[0] as { diagnostics: Array<{ code?: string; message: string }> } | undefined;
      expect(diagnosticsCall).toBeDefined();
      const undefinedDiagnostics =
        diagnosticsCall?.diagnostics.filter((diag) => diag.code === 'templjs.undefinedVariable') ??
        [];
      const invalidFilterDiagnostics =
        diagnosticsCall?.diagnostics.filter((diag) => diag.code === 'templjs.invalidFilter') ?? [];
      expect(undefinedDiagnostics).toHaveLength(0);
      expect(invalidFilterDiagnostics).toHaveLength(0);

      const completionHandler = onCompletion.mock.calls[0][0] as (params: {
        textDocument: { uri: string };
        position: { line: number; character: number };
      }) => unknown;

      const completionItems = await completionHandler({
        textDocument: { uri: docUri },
        position: locate(6, 'milestoneObjective', 12),
      });
      expect(completionLabels(completionItems)).toContain('milestoneObjective');

      const definitionHandler = onDefinition.mock.calls[0][0] as (params: {
        textDocument: { uri: string };
        position: { line: number; character: number };
      }) => { uri: string; range: { start: { line: number; character: number } } } | null;

      const schemaKeyDefinition = await definitionHandler({
        textDocument: { uri: docUri },
        position: locate(2, '$schema', 2),
      });
      expect(definitionUri(schemaKeyDefinition)).toContain(
        '/schemas/work-management/frontmatter/milestone.json'
      );

      const variableDefinition = await definitionHandler({
        textDocument: { uri: docUri },
        position: locate(14, 'relationship.target', 3),
      });
      expect(variableDefinition).not.toBeNull();
      expect(definitionUri(variableDefinition)?.startsWith('file://')).toBe(true);
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });
});

describe('language-server-inprocess-authoring', () => {
  beforeEach(() => {
    vi.resetModules();
    onInitialize.mockClear();
    onCompletion.mockClear();
    onHover.mockClear();
    onDefinition.mockClear();
    initialize.mockClear();
    getProject.mockReset();
  });

  it('supports md/html/json completion, hover, and definition via delegated handlers', async () => {
    const languageService = {
      doComplete: vi.fn(async () => ({
        isIncomplete: false,
        items: [{ label: 'exampleItem' }],
      })),
      doHover: vi.fn(async () => ({
        contents: { kind: 'markdown', value: 'example hover' },
      })),
      findDefinition: vi.fn(async () => [
        {
          targetUri: toFileUri('/tmp/schema.json'),
          targetRange: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 },
          },
          targetSelectionRange: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 },
          },
        },
      ]),
    };
    getProject.mockResolvedValue({
      getLanguageService: () => languageService,
    });

    await import('../src/server');

    const initializeHandler = onInitialize.mock.calls[0][0] as (params: unknown) => Promise<{
      capabilities: {
        completionProvider?: unknown;
        hoverProvider?: boolean;
        definitionProvider?: boolean;
      };
    }>;
    const init = await initializeHandler({ rootUri: toFileUri('/workspace') });

    expect(init.capabilities.completionProvider).toBeDefined();
    expect(init.capabilities.hoverProvider).toBe(true);
    expect(init.capabilities.definitionProvider).toBe(true);

    const completionHandler = onCompletion.mock.calls[0][0] as (params: {
      textDocument: { uri: string };
      position: { line: number; character: number };
      context?: { triggerKind?: number };
    }) => Promise<{ isIncomplete: boolean; items: Array<{ label: string }> }>;
    const hoverHandler = onHover.mock.calls[0][0] as (params: {
      textDocument: { uri: string };
      position: { line: number; character: number };
    }) => Promise<{ contents: { kind: string; value: string } }>;
    const definitionHandler = onDefinition.mock.calls[0][0] as (params: {
      textDocument: { uri: string };
      position: { line: number; character: number };
    }) => Promise<Array<{ targetUri: string }>>;

    for (const uri of [
      toFileUri('/workspace/sample.md.tmpl'),
      toFileUri('/workspace/sample.html.tmpl'),
      toFileUri('/workspace/sample.json.tmpl'),
    ]) {
      const completion = await completionHandler({
        textDocument: { uri },
        position: { line: 0, character: 1 },
        context: { triggerKind: 1 },
      });
      expect(completion.items[0]?.label).toBe('exampleItem');

      const hover = await hoverHandler({
        textDocument: { uri },
        position: { line: 0, character: 1 },
      });
      expect(hover.contents.value).toContain('example hover');

      const definition = await definitionHandler({
        textDocument: { uri },
        position: { line: 0, character: 1 },
      });
      expect(definition[0]?.targetUri).toBe(toFileUri('/tmp/schema.json'));
    }

    expect(languageService.doComplete).toHaveBeenCalledTimes(3);
    expect(languageService.doHover).toHaveBeenCalledTimes(3);
    expect(languageService.findDefinition).toHaveBeenCalledTimes(3);
  });
});
