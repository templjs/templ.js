import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  statSync: vi.fn(() => ({ size: 0 })),
  createReadStream: vi.fn(),
}));

// Mock @templjs/core
vi.mock('@templjs/core', () => ({
  renderTemplate: vi.fn(),
}));

import { readFileSync, statSync } from 'fs';
import { renderTemplate } from '@templjs/core';
import { renderCommand } from '../src/commands/render.js';
import {
  detectFormat,
  getParser,
  parseData,
  parseDataAsync,
  JsonParser,
  YamlParser,
  TomlParser,
  XmlParser,
  SUPPORTED_EXTENSIONS,
} from '../src/formats';

describe('Format Detection', () => {
  describe('detectFormat', () => {
    it('detects JSON format from .json extension', () => {
      expect(detectFormat('data.json')).toBe('json');
    });

    it('detects YAML format from .yaml extension', () => {
      expect(detectFormat('data.yaml')).toBe('yaml');
    });

    it('detects YAML format from .yml extension', () => {
      expect(detectFormat('data.yml')).toBe('yaml');
    });

    it('detects TOML format from .toml extension', () => {
      expect(detectFormat('config.toml')).toBe('toml');
    });

    it('detects XML format from .xml extension', () => {
      expect(detectFormat('data.xml')).toBe('xml');
    });

    it('returns null for unknown extensions', () => {
      expect(detectFormat('data.txt')).toBeNull();
    });

    it('is case-insensitive for extensions', () => {
      expect(detectFormat('data.JSON')).toBe('json');
      expect(detectFormat('config.YAML')).toBe('yaml');
    });
  });

  describe('SUPPORTED_EXTENSIONS', () => {
    it('maps all supported extensions', () => {
      expect(SUPPORTED_EXTENSIONS['.json']).toBe('json');
      expect(SUPPORTED_EXTENSIONS['.yaml']).toBe('yaml');
      expect(SUPPORTED_EXTENSIONS['.yml']).toBe('yaml');
      expect(SUPPORTED_EXTENSIONS['.toml']).toBe('toml');
      expect(SUPPORTED_EXTENSIONS['.xml']).toBe('xml');
    });
  });
});

describe('Parser Factory', () => {
  describe('getParser', () => {
    it('returns JsonParser for json format', () => {
      const parser = getParser('json');
      expect(parser).toBeInstanceOf(JsonParser);
    });

    it('returns YamlParser for yaml format', () => {
      const parser = getParser('yaml');
      expect(parser).toBeInstanceOf(YamlParser);
    });

    it('returns TomlParser for toml format', () => {
      const parser = getParser('toml');
      expect(parser).toBeInstanceOf(TomlParser);
    });

    it('throws for xml format in sync parser factory', () => {
      expect(() => getParser('xml')).toThrow(
        'XML parsing is only supported via parseDataAsync (async API).'
      );
    });

    it('throws for unsupported format', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => getParser('unsupported' as any)).toThrow('Unsupported format');
    });
  });
});

describe('JSON Parser', () => {
  const parser = new JsonParser();

  it('parses valid JSON object', () => {
    const result = parser.parse('{"name":"John","age":30}');
    expect(result).toEqual({ name: 'John', age: 30 });
  });

  it('parses JSON with nested objects', () => {
    const result = parser.parse('{"person":{"name":"Jane","tags":["a","b"]}}');
    expect(result).toEqual({
      person: { name: 'Jane', tags: ['a', 'b'] },
    });
  });

  it('throws error for invalid JSON', () => {
    expect(() => parser.parse('{"invalid": json}')).toThrow('Invalid JSON:');
  });

  it('throws error for JSON array', () => {
    expect(() => parser.parse('["a","b"]')).toThrow('must be a JSON object');
  });

  it('throws error for JSON null', () => {
    expect(() => parser.parse('null')).toThrow('must be a JSON object');
  });

  it('throws error for JSON string', () => {
    expect(() => parser.parse('"string"')).toThrow('must be a JSON object');
  });

  it('throws error for JSON number', () => {
    expect(() => parser.parse('42')).toThrow('must be a JSON object');
  });
});

describe('YAML Parser', () => {
  const parser = new YamlParser();

  it('parses valid YAML object', () => {
    const yaml = `
name: John
age: 30
`;
    const result = parser.parse(yaml);
    expect(result).toEqual({ name: 'John', age: 30 });
  });

  it('parses YAML with nested objects', () => {
    const yaml = `
person:
  name: Jane
  tags:
    - a
    - b
`;
    const result = parser.parse(yaml);
    expect(result).toEqual({
      person: {
        name: 'Jane',
        tags: ['a', 'b'],
      },
    });
  });

  it('throws error for invalid YAML', () => {
    expect(() => parser.parse('{ invalid yaml [')).toThrow('Invalid YAML:');
  });

  it('throws error for YAML array', () => {
    expect(() =>
      parser.parse(`
- a
- b
`)
    ).toThrow('must be a YAML object');
  });

  it('throws error for YAML scalar', () => {
    expect(() => parser.parse('just a string')).toThrow('must be a YAML object');
  });

  it('has correct formatName', () => {
    expect(parser.formatName).toBe('YAML');
  });
});

describe('TOML Parser', () => {
  const parser = new TomlParser();

  it('parses valid TOML document', () => {
    const toml = `
name = "John"
age = 30
`;
    const result = parser.parse(toml);
    expect(result).toEqual({ name: 'John', age: 30 });
  });

  it('parses TOML with nested tables', () => {
    const toml = `
[person]
name = "Jane"
tags = ["a", "b"]
`;
    const result = parser.parse(toml);
    expect(result.person).toEqual({
      name: 'Jane',
      tags: ['a', 'b'],
    });
  });

  it('throws error for invalid TOML', () => {
    expect(() => parser.parse('invalid = ')).toThrow('Invalid TOML:');
  });

  it('has correct formatName', () => {
    expect(parser.formatName).toBe('TOML');
  });
});

describe('XML Parser', () => {
  const parser = new XmlParser();

  it('throws for synchronous parse method', () => {
    expect(() => parser.parse('<root />')).toThrow('XML parsing requires async method');
  });

  it('parses valid XML asynchronously', async () => {
    const xml = `
<?xml version="1.0"?>
<root>
  <name>John</name>
  <age>30</age>
</root>
`;
    const result = await parser.parseAsync(xml);
    expect(result).toBeDefined();
    expect(result.root).toBeDefined();
  });

  it('throws error for invalid XML', async () => {
    const invalidXml = `
<root>
  <name>John
</root>
`;
    await expect(parser.parseAsync(invalidXml)).rejects.toThrow('Invalid XML:');
  });

  it('has correct formatName', () => {
    expect(parser.formatName).toBe('XML');
  });
});

describe('parseData', () => {
  it('parses JSON file by extension detection', () => {
    const result = parseData('{"name":"John"}', 'data.json');
    expect(result).toEqual({ name: 'John' });
  });

  it('parses YAML file by extension detection', () => {
    const result = parseData('name: John\nage: 30', 'data.yaml');
    expect(result).toEqual({ name: 'John', age: 30 });
  });

  it('throws error for unknown extension', () => {
    expect(() => parseData('{}', 'data.unknown')).toThrow('Unable to detect format from file path');
  });
});

describe('parseDataAsync', () => {
  it('handles JSON asynchronously', async () => {
    const result = await parseDataAsync('{"name":"John"}', 'data.json');
    expect(result).toEqual({ name: 'John' });
  });

  it('handles YAML asynchronously', async () => {
    const result = await parseDataAsync('name: John\nage: 30', 'data.yaml');
    expect(result).toEqual({ name: 'John', age: 30 });
  });

  it('handles XML asynchronously', async () => {
    const xml = `<?xml version="1.0"?><root><name>John</name></root>`;
    const result = await parseDataAsync(xml, 'data.xml');
    expect(result).toBeDefined();
  });

  it('throws error for unknown extension', async () => {
    await expect(parseDataAsync('{}', 'data.unknown')).rejects.toThrow(
      'Unable to detect format from file path'
    );
  });
});

describe('renderCommand with multiple formats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders template with JSON data', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockImplementation((value) => {
      if (value === 'template.tmpl') {
        return 'Hello {{ name }}';
      }
      return '{"name":"World"}';
    });
    vi.mocked(renderTemplate).mockReturnValue('Hello World');

    const output = await renderCommand('template.tmpl', 'data.json');

    expect(output).toBe('Hello World');
    expect(renderTemplate).toHaveBeenCalledWith('Hello {{ name }}', { name: 'World' });
  });

  it('renders template with YAML data', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockImplementation((value) => {
      if (value === 'template.tmpl') {
        return 'Hello {{ name }}';
      }
      return 'name: World';
    });
    vi.mocked(renderTemplate).mockReturnValue('Hello World');

    const output = await renderCommand('template.tmpl', 'data.yaml');

    expect(output).toBe('Hello World');
    expect(renderTemplate).toHaveBeenCalledWith('Hello {{ name }}', { name: 'World' });
  });

  it('renders template with TOML data', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockImplementation((value) => {
      if (value === 'template.tmpl') {
        return 'Hello {{ name }}';
      }
      return 'name = "World"';
    });
    vi.mocked(renderTemplate).mockReturnValue('Hello World');

    const output = await renderCommand('template.tmpl', 'data.toml');

    expect(output).toBe('Hello World');
    expect(renderTemplate).toHaveBeenCalledWith('Hello {{ name }}', { name: 'World' });
  });

  it('fails with clear error for invalid JSON', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockReturnValue('{ invalid json }');

    await expect(renderCommand('template.tmpl', 'data.json')).rejects.toThrow(
      /Render failed.*Invalid JSON/
    );
  });

  it('fails with clear error for invalid YAML', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockReturnValue('{ invalid: yaml: [');

    await expect(renderCommand('template.tmpl', 'data.yaml')).rejects.toThrow(
      /Render failed.*Invalid YAML/
    );
  });

  it('fails with clear error for invalid TOML', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockReturnValue('invalid =');

    await expect(renderCommand('template.tmpl', 'config.toml')).rejects.toThrow(
      /Render failed.*Invalid TOML/
    );
  });

  it('fails with clear error for unsupported format', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof statSync>);
    vi.mocked(readFileSync).mockReturnValue('{}');

    await expect(renderCommand('template.tmpl', 'data.txt')).rejects.toThrow(
      /Render failed.*Unable to detect input format/
    );
  });
});
