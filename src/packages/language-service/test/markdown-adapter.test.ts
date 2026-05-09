import { beforeEach, describe, expect, it, vi } from 'vitest';
import { URI } from 'vscode-uri';

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  // Node's util.promisify uses this symbol to discover a custom promise wrapper.
  // We expose it here so execFileAsync in the adapter exercises the mocked promise path.
  execFile: Object.assign((...args: unknown[]) => execFileMock(...args), {
    [Symbol.for('nodejs.util.promisify.custom')]: (...args: unknown[]) =>
      new Promise<{ stdout: unknown; stderr: unknown }>((resolve, reject) => {
        execFileMock(...args, (error: unknown, stdout: unknown, stderr: unknown) => {
          if (error) {
            reject(
              Object.assign(error as object, {
                stdout,
                stderr,
              })
            );
            return;
          }

          resolve({ stdout, stderr });
        });
      }),
  }),
}));

import {
  createMarkdownHostDiagnosticsAdapter,
  createMarkdownlintHostDiagnosticsAdapter,
  markdownAdapterTesting,
  planMarkdownHostAdapterRuntime,
  planMarkdownlintAdapterRuntime,
} from '../src/markdown-adapter.ts';

function callbackFromArgs(args: unknown[]): (...values: unknown[]) => void {
  const callback = args[args.length - 1];
  if (typeof callback !== 'function') {
    throw new Error('Expected callback argument for execFile mock');
  }
  return callback as (...values: unknown[]) => void;
}

describe('markdown-adapter', () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it('plans runtime enablement for markdown and markdownlint hosts', () => {
    expect(planMarkdownHostAdapterRuntime({} as never)).toEqual({
      enabled: true,
      reason: 'default-enabled',
    });
    expect(planMarkdownlintAdapterRuntime({} as never)).toEqual({
      enabled: true,
      reason: 'default-enabled',
    });

    const options = {
      initializationOptions: {
        adapterRuntimes: {
          'templjs-markdown-host': {
            state: 'unavailable',
            reason: 'unavailable-vscode-extension-markdown',
          },
          'templjs-markdownlint-host': {
            state: 'unavailable',
            reason: 'unavailable-binary-markdownlint',
          },
        },
      },
    };

    expect(planMarkdownHostAdapterRuntime(options as never)).toEqual({
      enabled: false,
      reason: 'unavailable-vscode-extension-markdown',
    });
    expect(planMarkdownlintAdapterRuntime(options as never)).toEqual({
      enabled: false,
      reason: 'unavailable-binary-markdownlint',
    });
  });

  it('covers markdownlint helper transforms and offset mapping', () => {
    expect(markdownAdapterTesting.isMarkdownLanguage('markdown')).toBe(true);
    expect(markdownAdapterTesting.isMarkdownLanguage('templjs-markdown')).toBe(true);
    expect(markdownAdapterTesting.isMarkdownLanguage('yaml')).toBe(false);

    expect(markdownAdapterTesting.toMarkdownlintCode(['MD041', 'first-line-heading'])).toBe(
      'MD041'
    );
    expect(markdownAdapterTesting.toMarkdownlintCode('MD012')).toBe('MD012');
    expect(markdownAdapterTesting.toMarkdownlintCode(undefined)).toBeUndefined();

    expect(
      markdownAdapterTesting.toMarkdownlintMessage({
        ruleNames: ['MD041'],
        ruleDescription: 'First line heading',
        errorDetail: 'Missing heading',
        errorContext: '# Title',
      })
    ).toBe('First line heading: Missing heading: # Title');
    expect(markdownAdapterTesting.toMarkdownlintMessage({ ruleNames: ['MD041'] })).toBe(
      'markdownlint MD041'
    );
    expect(markdownAdapterTesting.toMarkdownlintMessage({})).toBe('markdownlint violation');

    const lineOffsets = markdownAdapterTesting.buildLineOffsets('a\nb\n');
    expect(lineOffsets).toEqual([0, 2, 4]);
    expect(markdownAdapterTesting.lineAndColumnToOffset(lineOffsets, 2, 1)).toBe(3);
    expect(markdownAdapterTesting.offsetToLineAndCharacter(lineOffsets, 3)).toEqual({
      line: 1,
      character: 1,
    });

    expect(markdownAdapterTesting.buildCleanedToSourceOffsets([0, 0, 1, 2], 2)).toEqual([0, 2, 3]);

    const diag = markdownAdapterTesting.toDiagnostic(
      {
        lineNumber: 2,
        ruleNames: ['MD041'],
        ruleDescription: 'First line heading',
        errorRange: [1, 1],
      },
      '# Title\n{{ x }}\n',
      markdownAdapterTesting.cleanMarkdownlintInput('# Title\n{{ x }}\n')
    );

    expect(diag).toMatchObject({
      source: 'markdownlint',
      code: 'MD041',
      severity: 2,
    });

    // Trigger nullish fallback branches in offset helpers.
    expect(markdownAdapterTesting.lineAndColumnToOffset([], 99, 1)).toBe(1);
    expect(markdownAdapterTesting.offsetToLineAndCharacter([], 3)).toEqual({
      line: 0,
      character: 3,
    });
    expect(markdownAdapterTesting.offsetToLineAndCharacter([0, undefined as never, 10], 4)).toEqual(
      {
        line: 1,
        character: 4,
      }
    );

    const sparseOffsets = [] as unknown as number[];
    sparseOffsets[2] = 1;
    expect(markdownAdapterTesting.buildCleanedToSourceOffsets(sparseOffsets, 2)).toEqual([0, 2, 2]);

    expect(
      markdownAdapterTesting.toDiagnostic(
        {},
        '# Title\n',
        markdownAdapterTesting.cleanMarkdownlintInput('# Title\n')
      )
    ).toMatchObject({ source: 'markdownlint', code: undefined });
  });

  it('parses markdownlint output from json and text fallback formats', () => {
    const jsonOut = JSON.stringify({
      '/tmp/file.md': [{ lineNumber: 4, ruleNames: ['MD012'], errorRange: [1, 2] }],
    });
    expect(markdownAdapterTesting.parseMarkdownlintDiagnostics(jsonOut, '/tmp/file.md')).toEqual([
      { lineNumber: 4, ruleNames: ['MD012'], errorRange: [1, 2] },
    ]);

    const textOut = '/tmp/file.md:3:5 MD041 First line should be a top-level heading';
    expect(markdownAdapterTesting.parseMarkdownlintDiagnostics(textOut, '/tmp/file.md')).toEqual([
      {
        lineNumber: 3,
        errorRange: [5, 1],
        ruleNames: 'MD041',
        errorDetail: 'First line should be a top-level heading',
      },
    ]);

    expect(
      markdownAdapterTesting.parseTextDiagnostics(
        ['   ', 'not-a-diagnostic-line', '/tmp/file.md:7 MD009 Trailing spaces'].join('\n')
      )
    ).toEqual([
      {
        lineNumber: 7,
        errorRange: [1, 1],
        ruleNames: 'MD009',
        errorDetail: 'Trailing spaces',
      },
    ]);

    expect(markdownAdapterTesting.parseMarkdownlintDiagnostics('', '/tmp/file.md')).toEqual([]);
  });

  it('extracts issues by exact path, basename, and flattened object values', () => {
    const issue = { lineNumber: 1, ruleNames: ['MD041'] };

    expect(markdownAdapterTesting.extractIssuesFromResult([issue], '/tmp/doc.md')).toEqual([issue]);
    expect(
      markdownAdapterTesting.extractIssuesFromResult({ '/tmp/doc.md': [issue] }, '/tmp/doc.md')
    ).toEqual([issue]);
    expect(
      markdownAdapterTesting.extractIssuesFromResult({ '/other/doc.md': [issue] }, '/tmp/doc.md')
    ).toEqual([issue]);
    expect(
      markdownAdapterTesting.extractIssuesFromResult(
        { '/other/another.md': [issue], bad: 'value' },
        '/tmp/doc.md'
      )
    ).toEqual([issue]);
    expect(markdownAdapterTesting.extractIssuesFromResult({ bad: 'value' }, '/tmp/doc.md')).toEqual(
      []
    );
    expect(markdownAdapterTesting.extractIssuesFromResult(0 as never, '/tmp/doc.md')).toEqual([]);
  });

  it('writes temp markdown files and cleans template content for markdownlint', async () => {
    const fileTemp = await markdownAdapterTesting.writeTempMarkdownFile(
      'file:///tmp/example.tmpl',
      '# Title\n{{ x }}\n'
    );
    expect(fileTemp.tempFilePath.endsWith('.md')).toBe(true);
    await fileTemp.cleanup();

    const nonFileTemp = await markdownAdapterTesting.writeTempMarkdownFile(
      'untitled:doc',
      '# Title'
    );
    expect(nonFileTemp.tempFilePath.endsWith('document.md')).toBe(true);
    await nonFileTemp.cleanup();

    const invalidFileTemp = await markdownAdapterTesting.writeTempMarkdownFile(
      'file://%zz',
      '# Title'
    );
    expect(invalidFileTemp.tempFilePath.endsWith('document.md')).toBe(true);
    await invalidFileTemp.cleanup();

    const rootFileTemp = await markdownAdapterTesting.writeTempMarkdownFile('file:///', '# Title');
    expect(rootFileTemp.tempFilePath.endsWith('document.md')).toBe(true);
    await rootFileTemp.cleanup();

    const cleaned = markdownAdapterTesting.cleanMarkdownlintInput(
      ['## Subtitle', '{% set x = 1 -%}', '{% for x in xs -%}', '', '{{ x }}', '', '```yaml'].join(
        '\n'
      )
    );
    expect(cleaned.cleaned.split('\n')).toEqual(['## Subtitle', '_', '', '```yaml']);
  });

  it('covers binary candidate and source-document fallback branches', () => {
    expect(
      markdownAdapterTesting.resolveMarkdownlintBinaryCandidates({
        initializationOptions: {
          adapterRuntimes: {
            'templjs-markdownlint-host': {
              state: 'enabled',
              reason: 'resolved-binary',
              binaryPath: ' custom-mdlint ',
            },
          },
        },
      } as never)
    ).toEqual(['custom-mdlint', 'markdownlint']);

    const context = {
      decodeEmbeddedDocumentUri: vi.fn(() => [URI.parse('file:///source.md.templ')]),
      language: {
        scripts: {
          get: vi.fn(() => ({
            id: URI.parse('file:///source.md.templ'),
            snapshot: {
              getText: () => '# from snapshot',
              getLength: () => '# from snapshot'.length,
            },
          })),
        },
      },
    };

    expect(markdownAdapterTesting.getSourceUri(context as never, 'embedded://doc')).toBe(
      'file:///source.md.templ'
    );

    expect(
      markdownAdapterTesting.getSourceDocumentText(
        context as never,
        {
          uri: 'embedded://doc',
          getText: () => '# from document',
        },
        'file:///source.md.templ'
      )
    ).toBe('# from snapshot');

    expect(
      markdownAdapterTesting.getSourceDocumentText(
        {
          decodeEmbeddedDocumentUri: vi.fn(() => undefined),
          language: { scripts: { get: vi.fn(() => undefined) } },
        } as never,
        {
          uri: 'file:///same.md',
          getText: () => '# from document',
        },
        'file:///same.md'
      )
    ).toBe('# from document');

    expect(
      markdownAdapterTesting.getSourceDocumentText(
        {
          decodeEmbeddedDocumentUri: vi.fn(() => undefined),
          language: {
            scripts: {
              get: vi
                .fn()
                .mockImplementationOnce(() => undefined)
                .mockImplementationOnce(() => ({
                  snapshot: {
                    getText: () => '# from source fallback',
                    getLength: () => '# from source fallback'.length,
                  },
                })),
            },
          },
        } as never,
        {
          uri: 'embedded://doc',
          getText: () => '# from document',
        },
        'file:///source-fallback.md'
      )
    ).toBe('# from source fallback');

    expect(
      markdownAdapterTesting.getSourceUri(
        {
          decodeEmbeddedDocumentUri: vi.fn(() => undefined),
          language: { scripts: { get: vi.fn(() => undefined) } },
        } as never,
        'file:///fallback.md'
      )
    ).toBe('file:///fallback.md');

    expect(
      markdownAdapterTesting.getSourceDocumentText(
        {
          decodeEmbeddedDocumentUri: vi.fn(() => undefined),
          language: { scripts: { get: vi.fn(() => ({})) } },
        } as never,
        {
          uri: 'embedded://doc',
          getText: () => '# no snapshot',
        },
        'file:///other.md'
      )
    ).toBe('# no snapshot');

    expect(
      markdownAdapterTesting.resolveMarkdownlintBinaryCandidates({
        initializationOptions: {
          adapterRuntimes: {
            'templjs-markdownlint-host': {
              state: 'enabled',
              reason: 'resolved-binary',
              binaryPath: '   ',
            },
          },
        },
      } as never)
    ).toEqual(['markdownlint']);
  });

  it('collects diagnostics for success, ENOENT, and stderr fallback paths', async () => {
    const options = {
      workspaceFolder: process.cwd(),
      initializationOptions: {},
    };

    execFileMock.mockImplementationOnce((...args: unknown[]) => {
      const callback = callbackFromArgs(args);
      callback(
        null,
        JSON.stringify([
          {
            lineNumber: 2,
            ruleNames: ['MD041'],
            ruleDescription: 'First line heading',
            errorRange: [1, 1],
          },
        ]),
        ''
      );
    });

    const sourceText = '# Title\n{{ x }}\n';
    const diagnostics = await markdownAdapterTesting.collectMarkdownlintDiagnostics(
      options as never,
      'untitled:doc',
      sourceText,
      markdownAdapterTesting.cleanMarkdownlintInput(sourceText)
    );

    expect(execFileMock).toHaveBeenCalledWith(
      'markdownlint',
      expect.any(Array),
      expect.objectContaining({ timeout: 10_000, killSignal: 'SIGKILL' }),
      expect.any(Function)
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      source: 'markdownlint',
      code: 'MD041',
      severity: 2,
    });

    const log = vi.fn();
    execFileMock.mockImplementationOnce((...args: unknown[]) => {
      const callback = callbackFromArgs(args);
      callback(Object.assign(new Error('missing'), { code: 'ENOENT' }), '', '');
    });

    const missingBinaryDiagnostics = await markdownAdapterTesting.collectMarkdownlintDiagnostics(
      { workspaceFolder: process.cwd(), initializationOptions: {}, log } as never,
      'untitled:doc',
      '# Title\n',
      markdownAdapterTesting.cleanMarkdownlintInput('# Title\n')
    );

    expect(missingBinaryDiagnostics).toEqual([]);
    expect(log).toHaveBeenCalledWith(
      '[templjs-runtime] markdownlint binary not found: markdownlint'
    );

    execFileMock.mockImplementationOnce((...args: unknown[]) => {
      const callback = callbackFromArgs(args);
      const err = Object.assign(new Error('non-zero'), {
        code: 1,
        stdout: '/tmp/doc.md:1:1 MD012 Too many blank lines',
        stderr: '',
      });
      callback(err, err.stdout, err.stderr);
    });

    const fallbackDiagnostics = await markdownAdapterTesting.collectMarkdownlintDiagnostics(
      { workspaceFolder: process.cwd(), initializationOptions: {} } as never,
      'untitled:doc',
      '# Title\n',
      markdownAdapterTesting.cleanMarkdownlintInput('# Title\n')
    );

    expect(fallbackDiagnostics).toHaveLength(1);
    expect(fallbackDiagnostics[0]).toMatchObject({ source: 'markdownlint', code: 'MD012' });

    const errorLog = vi.fn();
    execFileMock.mockImplementationOnce((...args: unknown[]) => {
      const callback = callbackFromArgs(args);
      callback(
        Object.assign(new Error('boom'), { stdout: undefined, stderr: undefined }),
        undefined,
        undefined
      );
    });

    const noOutputDiagnostics = await markdownAdapterTesting.collectMarkdownlintDiagnostics(
      { workspaceFolder: process.cwd(), initializationOptions: {}, log: errorLog } as never,
      'untitled:doc',
      '# Title\n',
      markdownAdapterTesting.cleanMarkdownlintInput('# Title\n')
    );

    expect(noOutputDiagnostics).toEqual([]);
    expect(errorLog).toHaveBeenCalled();

    const timeoutLog = vi.fn();
    execFileMock.mockImplementationOnce((...args: unknown[]) => {
      const callback = callbackFromArgs(args);
      callback(Object.assign(new Error('timed out'), { code: 'ETIMEDOUT', signal: 'SIGKILL' }));
    });

    const timedOutDiagnostics = await markdownAdapterTesting.collectMarkdownlintDiagnostics(
      { workspaceFolder: process.cwd(), initializationOptions: {}, log: timeoutLog } as never,
      'untitled:doc',
      '# Title\n',
      markdownAdapterTesting.cleanMarkdownlintInput('# Title\n')
    );

    expect(timedOutDiagnostics).toEqual([]);
    expect(timeoutLog).toHaveBeenCalledWith(
      '[templjs-runtime] markdownlint subprocess timed out command=markdownlint'
    );

    execFileMock.mockImplementationOnce((...args: unknown[]) => {
      const callback = callbackFromArgs(args);
      callback(null, undefined, undefined);
    });

    const emptyStdoutDiagnostics = await markdownAdapterTesting.collectMarkdownlintDiagnostics(
      { workspaceFolder: process.cwd(), initializationOptions: {} } as never,
      'untitled:doc',
      '# Title\n',
      markdownAdapterTesting.cleanMarkdownlintInput('# Title\n')
    );

    expect(emptyStdoutDiagnostics).toEqual([]);
  });

  it('creates markdown host plugins and maps diagnostics through markdownlint adapter', async () => {
    expect(
      createMarkdownHostDiagnosticsAdapter({
        initializationOptions: {
          adapterRuntimes: {
            'templjs-markdown-host': {
              state: 'unavailable',
              reason: 'unavailable-vscode-extension-markdown',
            },
          },
        },
      } as never)
    ).toBeUndefined();

    const markdownHostPlugin = createMarkdownHostDiagnosticsAdapter({} as never);
    expect(markdownHostPlugin?.name).toBe('templjs-markdown-host');

    expect(
      createMarkdownlintHostDiagnosticsAdapter({
        initializationOptions: {
          adapterRuntimes: {
            'templjs-markdownlint-host': {
              state: 'unavailable',
              reason: 'unavailable-binary-markdownlint',
            },
          },
        },
      } as never)
    ).toBeUndefined();

    execFileMock.mockImplementationOnce((...args: unknown[]) => {
      const callback = callbackFromArgs(args);
      callback(
        null,
        JSON.stringify([
          {
            lineNumber: 2,
            ruleNames: ['MD041'],
            ruleDescription: 'First line heading',
            errorRange: [1, 1],
          },
        ]),
        ''
      );
    });

    const plugin = createMarkdownlintHostDiagnosticsAdapter({
      workspaceFolder: process.cwd(),
      initializationOptions: {},
    } as never);

    expect(plugin?.name).toBe('templjs-markdownlint-host');

    const sourceText = '# Title\n{{ x }}\n';
    const diagnostics = await plugin
      ?.create({
        decodeEmbeddedDocumentUri: vi.fn(() => [URI.parse('file:///doc.md.templ')]),
        language: {
          scripts: {
            get: vi.fn(() => ({
              id: URI.parse('file:///doc.md.templ'),
              snapshot: {
                getText: () => sourceText,
                getLength: () => sourceText.length,
              },
            })),
          },
        },
      } as never)
      .provideDiagnostics?.({
        uri: 'embedded-content://doc',
        languageId: 'templjs-markdown',
        getText: () => sourceText,
      } as never);

    expect(execFileMock).toHaveBeenCalled();
    expect(diagnostics).toBeDefined();

    const nonMarkdown = await plugin
      ?.create({
        decodeEmbeddedDocumentUri: vi.fn(() => undefined),
        language: {
          scripts: { get: vi.fn() },
        },
      } as never)
      .provideDiagnostics?.({
        uri: 'file:///doc.txt',
        languageId: 'plaintext',
        getText: () => 'text',
      } as never);

    expect(nonMarkdown).toBeUndefined();
  });
});
