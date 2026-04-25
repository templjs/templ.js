import { describe, expect, it } from 'vitest';
import { createServicePlugins } from '../src/service-plugins';
describe('createServicePlugins', () => {
  it('returns only the templjs intellisense service plugin', () => {
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
    });

    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.name).toBe('templjs-intellisense');
  });
});
