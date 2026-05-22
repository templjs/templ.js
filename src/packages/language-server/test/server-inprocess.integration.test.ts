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
const onRequest = vi.fn();
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
    onRequest,
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
    onRequest.mockClear();
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

    await import('../src/index.ts');

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

    await import('../src/index.ts');

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

  it('supports semantic token full and range requests via delegated handlers', async () => {
    initialize.mockResolvedValueOnce({
      capabilities: {
        semanticTokensProvider: {
          full: true,
          range: true,
          legend: {
            tokenTypes: ['keyword'],
            tokenModifiers: ['readonly'],
          },
        },
      },
    });

    const semanticTokens = { data: [0, 0, 3, 0, 0] };
    const languageService = {
      getCompletionItems: vi.fn(async () => ({ isIncomplete: false, items: [] })),
      getHover: vi.fn(async () => null),
      getDefinition: vi.fn(async () => null),
      getDocumentFormattingEdits: vi.fn(async () => []),
      getSemanticTokens: vi.fn(async () => semanticTokens),
      semanticTokenLegend: {
        tokenTypes: ['keyword'],
        tokenModifiers: ['readonly'],
      },
    };

    getLanguageService.mockResolvedValue(languageService);

    await import('../src/index.ts');

    const initializeHandler = onInitialize.mock.calls[0][0] as (params: unknown) => Promise<{
      capabilities: {
        semanticTokensProvider?: unknown;
      };
    }>;
    const init = await initializeHandler({ rootUri: 'file:///workspace' });

    expect(init.capabilities.semanticTokensProvider).toEqual({
      full: true,
      range: true,
      legend: {
        tokenTypes: ['keyword'],
        tokenModifiers: ['readonly'],
      },
    });

    const fullHandler = onRequest.mock.calls.find(
      (call) => call[0] === 'textDocument/semanticTokens/full'
    )?.[1] as (request: { textDocument: { uri: string } }, token: unknown) => Promise<unknown>;
    const rangeHandler = onRequest.mock.calls.find(
      (call) => call[0] === 'textDocument/semanticTokens/range'
    )?.[1] as (
      request: {
        textDocument: { uri: string };
        range: {
          start: { line: number; character: number };
          end: { line: number; character: number };
        };
      },
      token: unknown
    ) => Promise<unknown>;

    await expect(
      fullHandler(
        {
          textDocument: { uri: 'file:///workspace/sample.md.tmpl' },
        },
        {}
      )
    ).resolves.toEqual(semanticTokens);

    await expect(
      rangeHandler(
        {
          textDocument: { uri: 'file:///workspace/sample.md.tmpl' },
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 10 },
          },
        },
        {}
      )
    ).resolves.toEqual(semanticTokens);

    expect(languageService.getSemanticTokens).toHaveBeenCalledTimes(2);
  });

  it('returns null for semantic token handlers when language service has no semantic token API', async () => {
    initialize.mockResolvedValueOnce({
      capabilities: {
        semanticTokensProvider: {
          full: true,
          range: true,
          legend: {
            tokenTypes: ['keyword'],
            tokenModifiers: ['readonly'],
          },
        },
      },
    });

    const languageService = {
      getCompletionItems: vi.fn(async () => ({ isIncomplete: false, items: [] })),
      getHover: vi.fn(async () => null),
      getDefinition: vi.fn(async () => null),
      getDocumentFormattingEdits: vi.fn(async () => []),
    };

    getLanguageService.mockResolvedValue(languageService);

    await import('../src/index.ts');

    const initializeHandler = onInitialize.mock.calls[0][0] as (
      params: unknown
    ) => Promise<unknown>;
    await initializeHandler({ rootUri: 'file:///workspace' });

    const fullHandler = onRequest.mock.calls.find(
      (call) => call[0] === 'textDocument/semanticTokens/full'
    )?.[1] as (request: { textDocument: { uri: string } }, token: unknown) => Promise<unknown>;
    const rangeHandler = onRequest.mock.calls.find(
      (call) => call[0] === 'textDocument/semanticTokens/range'
    )?.[1] as (
      request: {
        textDocument: { uri: string };
        range: {
          start: { line: number; character: number };
          end: { line: number; character: number };
        };
      },
      token: unknown
    ) => Promise<unknown>;

    await expect(
      fullHandler(
        {
          textDocument: { uri: 'file:///workspace/sample.md.tmpl' },
        },
        {}
      )
    ).resolves.toBeNull();

    await expect(
      rangeHandler(
        {
          textDocument: { uri: 'file:///workspace/sample.md.tmpl' },
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 10 },
          },
        },
        {}
      )
    ).resolves.toBeNull();
  });
});
