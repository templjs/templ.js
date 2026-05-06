import { describe, expect, it, vi } from 'vitest';

const createTempljsLanguagePlugin = vi.fn((options?: unknown) => ({
  name: 'templjs-plugin',
  options,
}));

vi.mock('@templjs/volar', () => ({
  createTempljsLanguagePlugin,
}));

describe('createTempljsLanguagePlugins', () => {
  it('delegates plugin construction to @templjs/volar', async () => {
    const { createTempljsLanguagePlugins } = await import('../src/index');

    const options = { schemaUri: 'file:///workspace/schema.json' };
    const plugins = createTempljsLanguagePlugins(options);

    expect(createTempljsLanguagePlugin).toHaveBeenCalledWith(options);
    expect(plugins).toEqual([{ name: 'templjs-plugin', options }]);
  });
});
