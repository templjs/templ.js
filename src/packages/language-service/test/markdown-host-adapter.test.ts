import { describe, expect, it, vi } from 'vitest';

const createMarkdownServiceMock = vi.hoisted(() => vi.fn());

vi.mock('volar-service-markdown', () => ({
  create: createMarkdownServiceMock,
}));

import { createMarkdownHostDiagnosticsAdapter } from '../src/markdown-adapter.ts';

describe('markdown host adapter', () => {
  it('provides default markdown diagnostics options to volar markdown service', async () => {
    createMarkdownServiceMock.mockImplementation(
      (options: { getDiagnosticOptions: () => unknown }) => ({
        name: 'base-markdown',
        create: () => ({
          getDiagnosticOptions: options.getDiagnosticOptions,
        }),
      })
    );

    const plugin = createMarkdownHostDiagnosticsAdapter({} as never);
    expect(plugin?.name).toBe('templjs-markdown-host');
    expect(createMarkdownServiceMock).toHaveBeenCalledTimes(1);

    const optionsFactory = createMarkdownServiceMock.mock.calls[0]?.[0]?.getDiagnosticOptions;
    expect(typeof optionsFactory).toBe('function');

    const options = await optionsFactory();
    expect(options).toMatchObject({
      validateReferences: 'warning',
      validateFragmentLinks: 'warning',
      validateFileLinks: 'warning',
      validateMarkdownFileLinkFragments: 'warning',
      validateUnusedLinkDefinitions: 'hint',
      validateDuplicateLinkDefinitions: 'warning',
      ignoreLinks: [],
    });
  });

  it('moves link.no-such-reference diagnostics onto the actual reference text', async () => {
    createMarkdownServiceMock.mockImplementation(() => ({
      name: 'base-markdown',
      create: () => ({
        provideDiagnostics: () => [
          {
            code: 'link.no-such-reference',
            data: { ref: 'foo' },
            range: {
              start: { line: 0, character: 1 },
              end: { line: 0, character: 4 },
            },
          },
        ],
      }),
    }));

    const plugin = createMarkdownHostDiagnosticsAdapter({} as never);
    const diagnostics = await plugin?.create({} as never).provideDiagnostics?.(
      {
        uri: 'file:///doc.md',
        languageId: 'markdown',
        getText: () => '[        foo ]',
      } as never,
      undefined as never
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics?.[0]?.range).toEqual({
      start: { line: 0, character: 9 },
      end: { line: 0, character: 12 },
    });
  });
});
