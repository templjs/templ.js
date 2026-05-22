import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockHandles = vi.hoisted(() => {
  const delegatedFormattingEdits = vi.fn(async () => [
    {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 1 },
      },
      newText: 'formatted',
    },
  ]);

  const createPrettierServicePluginMock = vi.fn(() => ({
    create: () => ({
      provideDocumentFormattingEdits: delegatedFormattingEdits,
    }),
  }));

  return {
    delegatedFormattingEdits,
    createPrettierServicePluginMock,
  };
});

vi.mock('volar-service-prettier', () => ({
  create: mockHandles.createPrettierServicePluginMock,
}));

vi.mock('prettier', () => ({
  default: {},
}));

import { createPrettierHostAdapter, planPrettierAdapterRuntime } from '../src/prettier-adapter.ts';

describe('prettier-host-formatting-orchestration', () => {
  beforeEach(() => {
    mockHandles.delegatedFormattingEdits.mockClear();
    mockHandles.createPrettierServicePluginMock.mockClear();
  });

  it('emits deterministic orchestration payload when delegated formatting runs', async () => {
    const onFormattingOrchestration = vi.fn();
    const plugin = createPrettierHostAdapter({
      initializationOptions: {
        formattingHostLanguages: [' markdown ', 'json'],
        prettierHostLanguages: ['yaml'],
      },
      onFormattingOrchestration,
    } as never);

    expect(plugin).toBeDefined();

    const instance = plugin!.create({} as never) as {
      provideDocumentFormattingEdits?: (...args: unknown[]) => Promise<unknown>;
    };

    const edits = (await instance.provideDocumentFormattingEdits?.(
      { uri: 'file:///workspace/sample.md.templ', languageId: 'markdown' },
      undefined,
      { insertSpaces: true, tabSize: 2 },
      undefined,
      undefined
    )) as Array<{ newText: string }>;

    expect(edits[0]?.newText).toBe('formatted');
    expect(mockHandles.delegatedFormattingEdits).toHaveBeenCalledTimes(1);
    expect(mockHandles.createPrettierServicePluginMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ documentSelector: ['markdown', 'json'] })
    );
    expect(onFormattingOrchestration).toHaveBeenCalledWith({
      helperExtensionId: 'templjs.authoring.formatting',
      consumesSemanticKinds: ['templjs.binding', 'templjs.schema-path', 'templjs.semantic-zone'],
      source: 'manifest',
      adapterId: 'templjs-prettier-host',
      documentUri: 'file:///workspace/sample.md.templ',
      delegatedLanguageId: 'markdown',
      configuredHostLanguages: ['markdown', 'json'],
    });
  });

  it('keeps workspace formatter language selection authoritative', () => {
    const plan = planPrettierAdapterRuntime({
      initializationOptions: {
        formattingHostLanguages: ['html'],
        prettierHostLanguages: ['yaml'],
      },
    } as never);

    expect(plan).toEqual({
      enabled: true,
      languages: ['html'],
      reason: 'configured-languages',
    });
  });
});
