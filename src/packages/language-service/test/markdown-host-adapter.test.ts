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
});
