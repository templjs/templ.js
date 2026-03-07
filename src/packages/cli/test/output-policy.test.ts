import { describe, expect, it } from 'vitest';
import { resolveOutputModeFromArgv } from '../src/output-policy.js';

describe('resolveOutputModeFromArgv', () => {
  it('parses grouped short flags and keeps quiet mode dominant', () => {
    expect(resolveOutputModeFromArgv(['node', 'cli.js', '-qv'])).toEqual({
      quiet: true,
      verbose: false,
      json: false,
    });

    expect(resolveOutputModeFromArgv(['node', 'cli.js', '-vq'])).toEqual({
      quiet: true,
      verbose: false,
      json: false,
    });
  });

  it('parses long flags and standalone short flags', () => {
    expect(resolveOutputModeFromArgv(['node', 'cli.js', '-v', '--json'])).toEqual({
      quiet: false,
      verbose: true,
      json: true,
    });
  });

  it('stops parsing flags after end-of-options marker', () => {
    expect(resolveOutputModeFromArgv(['node', 'cli.js', '--', '-q', '--json'])).toEqual({
      quiet: false,
      verbose: false,
      json: false,
    });
  });
});
