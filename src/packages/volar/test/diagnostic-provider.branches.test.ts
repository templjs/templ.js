import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('DiagnosticProvider branch coverage', () => {
  it('falls back to default source when diagnostic-provider helper is not declared', async () => {
    vi.doMock('@templjs/semantify', () => ({
      createTempljsAuthoringProfile: () => ({
        helperExtensions: [],
      }),
    }));

    const { collectDiagnostics } = await import('../src/diagnostic-provider.js');
    const diagnostics = collectDiagnostics('{{ unknown.value }}', {
      schema: {
        type: 'object',
        properties: {},
      },
    });

    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0]?.source).toBe('templjs.authoring.diagnostic-provider');
  });
});
