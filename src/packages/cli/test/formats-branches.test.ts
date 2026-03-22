import { describe, expect, it, vi } from 'vitest';

async function loadTomlParser(parseImpl: (content: string) => unknown) {
  vi.resetModules();
  vi.doMock('@iarna/toml', () => ({
    parse: vi.fn(parseImpl),
  }));

  const module = await import('../src/formats/toml-parser.js');
  return new module.TomlParser();
}

async function loadXmlParser(parseImpl: (content: string) => Promise<unknown>) {
  vi.resetModules();
  vi.doMock('xml2js', () => ({
    parseStringPromise: vi.fn(parseImpl),
  }));

  const module = await import('../src/formats/xml-parser.js');
  return new module.XmlParser();
}

describe('format parser fallback branches', () => {
  it('wraps TOML values that are not objects', async () => {
    const parser = await loadTomlParser(() => ['array-value']);

    expect(() => parser.parse('ignored')).toThrow(
      'Invalid TOML: Input data must be a TOML table (object)'
    );
  });

  it('stringifies non-Error TOML parser failures', async () => {
    const parser = await loadTomlParser(() => {
      throw 'toml panic';
    });

    expect(() => parser.parse('ignored')).toThrow('Invalid TOML: toml panic');
  });

  it('wraps XML values that are not objects', async () => {
    const parser = await loadXmlParser(async () => 'text-node');

    await expect(parser.parseAsync('ignored')).rejects.toThrow(
      'Invalid XML: Input data must be valid XML element'
    );
  });

  it('stringifies non-Error XML parser failures', async () => {
    const parser = await loadXmlParser(async () => {
      throw 'xml panic';
    });

    await expect(parser.parseAsync('ignored')).rejects.toThrow('Invalid XML: xml panic');
  });
});
