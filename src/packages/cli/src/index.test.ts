import { describe, expect, it } from 'vitest';
import cli from './index';
import { processTemplate, validateTemplate, version } from './index';

describe('cli-index', () => {
  it('exposes stable version and default export', () => {
    expect(version).toBe('0.1.0');
    expect(cli.version).toBe(version);
  });

  it('returns placeholder response for processTemplate', () => {
    expect(processTemplate('template.templ', 'data.json')).toBe(
      'Template processing not yet implemented'
    );
  });

  it('returns success placeholder for validateTemplate', () => {
    expect(validateTemplate('template.templ')).toBe(true);
  });
});
