import { describe, expect, it, vi } from 'vitest';

const createYamlServiceMock = vi.hoisted(() => vi.fn());

vi.mock('volar-service-yaml', () => ({
  create: createYamlServiceMock,
}));

import { createYamlHostDiagnosticsAdapter } from '../src/yaml-adapter.ts';

describe('yaml-adapter', () => {
  it('guards yaml host feature providers against upstream schema-service exceptions', async () => {
    const boom = new Error('errorMessage.toLowerCase is not a function');

    createYamlServiceMock.mockImplementation(() => ({
      name: 'base-yaml',
      capabilities: {},
      create: () => ({
        provideDiagnostics: async () => {
          throw boom;
        },
        provideHover: async () => {
          throw boom;
        },
        provideCompletionItems: async () => {
          throw boom;
        },
        provideDefinition: async () => {
          throw boom;
        },
      }),
    }));

    const log = vi.fn();
    const plugin = createYamlHostDiagnosticsAdapter({ log } as never);
    expect(plugin).toBeDefined();

    const instance = plugin!.create({} as never);
    const document = {
      uri: 'file:///doc.yaml.templ',
      languageId: 'yaml',
      getText: () => 'key: value\n',
    };

    await expect(instance.provideDiagnostics?.(document as never, {} as never)).resolves.toEqual([]);
    await expect(
      instance.provideHover?.(document as never, { line: 0, character: 0 }, {} as never)
    ).resolves.toBeUndefined();
    await expect(
      instance.provideCompletionItems?.(
        document as never,
        { line: 0, character: 0 },
        { triggerKind: 1 } as never,
        {} as never
      )
    ).resolves.toBeUndefined();
    await expect(
      instance.provideDefinition?.(document as never, { line: 0, character: 0 }, {} as never)
    ).resolves.toBeUndefined();

    expect(log).toHaveBeenCalled();
  });

  it('retries diagnostics against cleaned text after an initial host failure', async () => {
    const mockProvideDiagnostics = vi
      .fn()
      .mockImplementationOnce(async () => {
        throw new Error("Cannot read properties of undefined (reading 'toLowerCase')");
      })
      .mockImplementationOnce(async (document: { getText(): string }) => {
        const content = document.getText();
        if (content.includes('{%') || content.includes('{{')) {
          throw new Error('expected cleaned content on retry');
        }

        return [
          {
            message: 'Property id is not allowed',
            severity: 1,
            range: {
              start: { line: 2, character: 0 },
              end: { line: 2, character: 2 },
            },
          },
        ];
      });

    createYamlServiceMock.mockImplementation(() => ({
      name: 'base-yaml',
      capabilities: {},
      create: () => ({
        provideDiagnostics: mockProvideDiagnostics,
      }),
    }));

    const plugin = createYamlHostDiagnosticsAdapter({ log: vi.fn() } as never);
    expect(plugin).toBeDefined();

    const instance = plugin!.create({} as never);
    const diagnostics = await instance.provideDiagnostics?.(
      {
        uri: 'file:///doc.yaml.templ',
        languageId: 'yaml',
        getText: () =>
          [
            '# yaml-language-server: $schema=./example.schema.json',
            'title: yaml block',
            'id: {% set id = "yaml-block" %}"{{ id }}"',
          ].join('\n'),
      } as never,
      {} as never
    );

    expect(mockProvideDiagnostics).toHaveBeenCalledTimes(2);
    expect(diagnostics).toEqual([
      {
        message: 'Property id is not allowed',
        severity: 1,
        range: {
          start: { line: 2, character: 0 },
          end: { line: 2, character: 2 },
        },
      },
    ]);
  });
});
