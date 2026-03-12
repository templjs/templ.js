import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const onInitialize = vi.fn();
const onInitialized = vi.fn();
const onShutdown = vi.fn();
const onDidOpenTextDocument = vi.fn();
const onDidChangeTextDocument = vi.fn();
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

vi.mock('@volar/language-server/node', () => ({
  createConnection: vi.fn(() => ({
    onInitialize,
    onInitialized,
    onShutdown,
    onDidOpenTextDocument,
    onDidChangeTextDocument,
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
  })),
  createSimpleProjectProvider: { name: 'simple-project-provider' },
}));

describe('language-server-inprocess-integration', () => {
  beforeEach(() => {
    vi.resetModules();
    onInitialize.mockClear();
    onInitialized.mockClear();
    onShutdown.mockClear();
    onDidOpenTextDocument.mockClear();
    onDidChangeTextDocument.mockClear();
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

      const docUri = `file://${path.join(workspaceDir, 'sample.md.templ')}`;
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
        rootUri: `file://${workspaceDir}`,
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
      }) => Array<{ label: string }>;

      const frontmatterCompletions = completionHandler({
        textDocument: { uri: docUri },
        position: locate(1, 'frontData.t', 'frontData.t'.length),
      });
      expect(frontmatterCompletions.some((item) => item.label === 'title')).toBe(true);

      const contentCompletions = completionHandler({
        textDocument: { uri: docUri },
        position: locate(3, 'contentData.h', 'contentData.h'.length),
      });
      expect(contentCompletions.some((item) => item.label === 'heading')).toBe(true);

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

      const frontmatterHover = hoverHandler({
        textDocument: { uri: docUri },
        position: locate(1, 'frontData.title', 2),
      });
      const frontmatterHoverText =
        typeof frontmatterHover?.contents === 'string'
          ? frontmatterHover.contents
          : frontmatterHover?.contents?.value;
      expect(frontmatterHoverText).toContain('frontData');

      const contentHover = hoverHandler({
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

      const contentCompletionsAfterEdit = completionHandler({
        textDocument: { uri: docUri },
        position: locate(3, 'contentData.h', 'contentData.h'.length),
      });
      expect(contentCompletionsAfterEdit.some((item) => item.label === 'heading')).toBe(true);
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

      const docUri = `file://${path.join(workspaceDir, 'sample.md.templ')}`;
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
        rootUri: `file://${workspaceDir}`,
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

      const schemaPathDefinition = definitionHandler({
        textDocument: { uri: docUri },
        position: locate(1, path.basename(frontmatterSchemaPath), 2),
      });
      expect(schemaPathDefinition?.uri).toBe(`file://${frontmatterSchemaPath}`);

      const contentSchemaPathDefinition = definitionHandler({
        textDocument: { uri: docUri },
        position: locate(2, path.basename(contentSchemaPath), 2),
      });
      expect(contentSchemaPathDefinition?.uri).toBe(`file://${contentSchemaPath}`);

      const frontVariableDefinition = definitionHandler({
        textDocument: { uri: docUri },
        position: locate(3, 'frontData.title', 2),
      });
      expect(frontVariableDefinition?.uri).toBe(`file://${frontmatterSchemaPath}`);
      expect(frontVariableDefinition?.range.start.line).toBeGreaterThanOrEqual(0);

      const contentVariableDefinition = definitionHandler({
        textDocument: { uri: docUri },
        position: locate(5, 'contentData.heading', 2),
      });
      expect(contentVariableDefinition?.uri).toBe(`file://${contentSchemaPath}`);
      expect(contentVariableDefinition?.range.start.line).toBeGreaterThanOrEqual(0);
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

      const docUri = `file://${path.join(workspaceDir, 'sample.md.templ')}`;
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
        rootUri: `file://${workspaceDir}`,
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

      const schemaPathDefinition = definitionHandler({
        textDocument: { uri: docUri },
        position: locate(1, schemaSource, schemaSource.length - 'milestone'.length + 2),
      });
      expect(schemaPathDefinition?.uri).toBe(`file://${commonSchemaPath}`);

      const loopAliasDefinition = definitionHandler({
        textDocument: { uri: docUri },
        position: locate(4, 'relationship.target', 2),
      });
      expect(loopAliasDefinition?.uri).toBe(`file://${commonSchemaPath}`);
      expect(loopAliasDefinition?.range.start.line).toBeGreaterThan(0);
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

      const docUri = `file://${path.join(workspaceDir, 'milestone.md.tpl')}`;
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
        rootUri: `file://${workspaceDir}`,
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

      await new Promise((resolve) => setTimeout(resolve, 0));

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
      }) => Array<{ label: string }>;

      const completionItems = completionHandler({
        textDocument: { uri: docUri },
        position: locate(6, 'milestoneObjective', 12),
      });
      expect(completionItems.some((item) => item.label === 'milestoneObjective')).toBe(true);

      const definitionHandler = onDefinition.mock.calls[0][0] as (params: {
        textDocument: { uri: string };
        position: { line: number; character: number };
      }) => { uri: string; range: { start: { line: number; character: number } } } | null;

      const schemaKeyDefinition = definitionHandler({
        textDocument: { uri: docUri },
        position: locate(2, '$schema', 2),
      });
      expect(schemaKeyDefinition?.uri).toContain(
        '/schemas/work-management/frontmatter/milestone.json'
      );

      const variableDefinition = definitionHandler({
        textDocument: { uri: docUri },
        position: locate(14, 'relationship.target', 3),
      });
      expect(variableDefinition).not.toBeNull();
      expect(variableDefinition?.uri.startsWith('file://')).toBe(true);
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });
});
