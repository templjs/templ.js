import { describe, expect, it } from 'vitest';
import cli from '../src/index.js';
import { processTemplate, validateTemplate, version } from '../src/index.js';

describe('cli-index', () => {
  it('exposes stable version and default export', () => {
    expect(version).toBe('0.1.0');
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
