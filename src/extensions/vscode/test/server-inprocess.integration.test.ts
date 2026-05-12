import { beforeEach, describe, expect, it, vi } from 'vitest';

const onInitialize = vi.fn();
const onInitialized = vi.fn();
const onShutdown = vi.fn();
const onNotification = vi.fn();
const onDidOpenTextDocument = vi.fn();
const onDidChangeTextDocument = vi.fn();
const onDidChangeWatchedFiles = vi.fn();
const onCompletion = vi.fn();
const onHover = vi.fn();
const onDefinition = vi.fn();
const onDocumentFormatting = vi.fn();
const sendDiagnostics = vi.fn();
const listen = vi.fn();
const consoleLog = vi.fn();
const consoleWarn = vi.fn();

const initialize = vi.fn(async () => ({ capabilities: {} }));
const initialized = vi.fn();
const shutdown = vi.fn();
const getLanguageService = vi.fn();
const createSimpleProject = vi.fn((plugins: unknown) => ({ plugins }));

vi.mock('@volar/language-server/node', () => ({
  createConnection: vi.fn(() => ({
    onInitialize,
    onInitialized,
    onShutdown,
    onNotification,
    onDidOpenTextDocument,
    onDidChangeTextDocument,
    onDidChangeWatchedFiles,
    onCompletion,
    onHover,
    onDefinition,
    onDocumentFormatting,
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
    project: {
      getLanguageService,
    },
  })),
  createSimpleProject,
}));

describe('language-server-inprocess-authoring', () => {
  beforeEach(() => {
    vi.resetModules();
    onInitialize.mockClear();
    onInitialized.mockClear();
    onShutdown.mockClear();
    onNotification.mockClear();
    onDidOpenTextDocument.mockClear();
    onDidChangeTextDocument.mockClear();
    onDidChangeWatchedFiles.mockClear();
    onCompletion.mockClear();
    onHover.mockClear();
    onDefinition.mockClear();
    onDocumentFormatting.mockClear();
    sendDiagnostics.mockClear();
    consoleLog.mockClear();
    consoleWarn.mockClear();
    listen.mockClear();
    initialize.mockClear();
    initialized.mockClear();
    shutdown.mockClear();
    getLanguageService.mockReset();
    createSimpleProject.mockClear();
  });

  it('supports md/html/json completion, hover, and definition via delegated handlers', async () => {
    const languageService = {
      getCompletionItems: vi.fn(async () => ({
        isIncomplete: false,
        items: [{ label: 'user' }, { label: 'title' }],
      })),
      getHover: vi.fn(async () => ({
        contents: { kind: 'markdown', value: 'hovered' },
      })),
      getDefinition: vi.fn(async () => [
        {
          targetUri: 'file:///workspace/schema.json',
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
      getDocumentFormattingEdits: vi.fn(async () => []),
    };

    getLanguageService.mockResolvedValue(languageService);

    await import('../src/server');

    const initializeHandler = onInitialize.mock.calls[0][0] as (params: unknown) => Promise<{
      capabilities: {
        completionProvider?: unknown;
        hoverProvider?: boolean;
        definitionProvider?: boolean;
      };
    }>;
    const init = await initializeHandler({ rootUri: 'file:///workspace' });

    expect(init.capabilities.completionProvider).toEqual({
      triggerCharacters: [
        '.',
        '|',
        ...'abcdefghijklmnopqrstuvwxyz',
        ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      ],
    });
    expect(init.capabilities.hoverProvider).toBe(true);
    expect(init.capabilities.definitionProvider).toBe(true);

    const completionHandler = onCompletion.mock.calls[0][0] as (params: {
      textDocument: { uri: string };
      position: { line: number; character: number };
      context?: unknown;
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
      'file:///workspace/sample.md.tmpl',
      'file:///workspace/sample.html.tmpl',
      'file:///workspace/sample.json.tmpl',
      'file:///workspace/sample.yaml.tmpl',
    ]) {
      const completion = await completionHandler({
        textDocument: { uri },
        position: { line: 0, character: 2 },
        context: {},
      });
      expect(completion.items.map((item) => item.label)).toEqual(['user', 'title']);

      const hover = await hoverHandler({
        textDocument: { uri },
        position: { line: 0, character: 2 },
      });
      expect(hover.contents.value).toContain('hovered');

      const definition = await definitionHandler({
        textDocument: { uri },
        position: { line: 0, character: 2 },
      });
      expect(definition[0]?.targetUri).toBe('file:///workspace/schema.json');
    }

    expect(languageService.getCompletionItems).toHaveBeenCalledTimes(4);
    expect(languageService.getHover).toHaveBeenCalledTimes(4);
    expect(languageService.getDefinition).toHaveBeenCalledTimes(4);
  });

  it('supports md/html/json/yaml formatting via delegated handlers', async () => {
    const languageService = {
      getCompletionItems: vi.fn(async () => ({ isIncomplete: false, items: [] })),
      getHover: vi.fn(async () => null),
      getDefinition: vi.fn(async () => null),
      getDocumentFormattingEdits: vi.fn(async () => [
        {
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 5 },
          },
          newText: 'formatted',
        },
      ]),
    };
    getLanguageService.mockResolvedValue(languageService);

    await import('../src/server');

    const initializeHandler = onInitialize.mock.calls[0][0] as (params: unknown) => Promise<{
      capabilities: {
        documentFormattingProvider?: boolean;
      };
    }>;
    const init = await initializeHandler({ rootUri: 'file:///workspace' });

    expect(init.capabilities.documentFormattingProvider).toBe(true);

    const formattingHandler = onDocumentFormatting.mock.calls[0][0] as (params: {
      textDocument: { uri: string };
      options: { insertSpaces?: boolean; tabSize?: number };
    }) => Promise<Array<{ range: unknown; newText: string }>>;

    for (const uri of [
      'file:///workspace/sample.md.tmpl',
      'file:///workspace/sample.html.tmpl',
      'file:///workspace/sample.json.tmpl',
      'file:///workspace/sample.yaml.tmpl',
    ]) {
      const formatting = await formattingHandler({
        textDocument: { uri },
        options: { insertSpaces: true, tabSize: 2 },
      });
      expect(formatting[0]?.newText).toBe('formatted');
    }

    expect(languageService.getDocumentFormattingEdits).toHaveBeenCalledTimes(4);
  });

  it('forwards complex for-header hover and definition requests without local semantic parsing', async () => {
    const languageService = {
      getCompletionItems: vi.fn(async () => ({ isIncomplete: false, items: [] })),
      getHover: vi.fn(async () => ({
        contents: { kind: 'markdown', value: 'member: local loop alias' },
      })),
      getDefinition: vi.fn(async () => [
        {
          targetUri: 'file:///workspace/template.md.tmpl',
          targetRange: {
            start: { line: 2, character: 8 },
            end: { line: 2, character: 14 },
          },
          targetSelectionRange: {
            start: { line: 2, character: 8 },
            end: { line: 2, character: 14 },
          },
        },
      ]),
      getDocumentFormattingEdits: vi.fn(async () => []),
    };
    getLanguageService.mockResolvedValue(languageService);

    await import('../src/server');

    const initializeHandler = onInitialize.mock.calls[0][0] as (params: unknown) => Promise<{
      capabilities: {
        hoverProvider?: boolean;
        definitionProvider?: boolean;
      };
    }>;
    const init = await initializeHandler({ rootUri: 'file:///workspace' });
    expect(init.capabilities.hoverProvider).toBe(true);
    expect(init.capabilities.definitionProvider).toBe(true);

    const hoverHandler = onHover.mock.calls[0][0] as (params: {
      textDocument: { uri: string };
      position: { line: number; character: number };
    }) => Promise<{ contents: { kind: string; value: string } }>;
    const definitionHandler = onDefinition.mock.calls[0][0] as (params: {
      textDocument: { uri: string };
      position: { line: number; character: number };
    }) => Promise<Array<{ targetUri: string }>>;

    const request = {
      textDocument: { uri: 'file:///workspace/complex-loop.md.tmpl' },
      position: { line: 3, character: 11 },
    };

    const hover = await hoverHandler(request);
    const definition = await definitionHandler(request);

    expect(hover.contents.value).toBe('member: local loop alias');
    expect(definition[0]?.targetUri).toBe('file:///workspace/template.md.tmpl');

    const hoverArgs = languageService.getHover.mock.calls[0];
    expect(hoverArgs[0]).toMatchObject({
      scheme: 'file',
      path: '/workspace/complex-loop.md.tmpl',
    });
    expect(hoverArgs[1]).toEqual(request.position);

    const definitionArgs = languageService.getDefinition.mock.calls[0];
    expect(definitionArgs[0]).toMatchObject({
      scheme: 'file',
      path: '/workspace/complex-loop.md.tmpl',
    });
    expect(definitionArgs[1]).toEqual(request.position);
  });
});
