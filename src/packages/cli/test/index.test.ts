import { describe, expect, it } from 'vitest';
import { version as packageVersion } from '../package.json';
import cli from '../src/index.js';
import { processTemplate, validateTemplate, version } from '../src/index.js';

describe('cli-index', () => {
  it('exposes stable version and default export', () => {
    expect(version).toBe(packageVersion);
    expect(cli.version).toBe(version);
  });

  it('processes template with data', () => {
    const result = processTemplate('Hello {{name}}!', { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('validates template syntax', () => {
    expect(validateTemplate('Hello {{name}}!')).toBe(true);
    expect(validateTemplate('{{unclosed')).toBe(false);
  });
});
