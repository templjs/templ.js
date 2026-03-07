import { describe, expect, it } from 'vitest';
import { detectFormat, getParser, parseData, parseDataAsync } from '../src/formats/index';
import { JsonParser } from '../src/formats/json-parser.js';
import { YamlParser } from '../src/formats/yaml-parser.js';
import { TomlParser } from '../src/formats/toml-parser.js';
import { SUPPORTED_EXTENSIONS } from '../src/formats/types.js';

describe('formats index', () => {
  it('exports supported extensions map', () => {
    expect(SUPPORTED_EXTENSIONS['.json']).toBe('json');
    expect(SUPPORTED_EXTENSIONS['.yaml']).toBe('yaml');
    expect(SUPPORTED_EXTENSIONS['.yml']).toBe('yaml');
    expect(SUPPORTED_EXTENSIONS['.toml']).toBe('toml');
    expect(SUPPORTED_EXTENSIONS['.xml']).toBe('xml');
  });

  it('detects format from extension', () => {
    expect(detectFormat('input.json')).toBe('json');
    expect(detectFormat('input.yaml')).toBe('yaml');
    expect(detectFormat('input.yml')).toBe('yaml');
    expect(detectFormat('input.toml')).toBe('toml');
    expect(detectFormat('input.xml')).toBe('xml');
    expect(detectFormat('input.txt')).toBeNull();
  });

  it('returns parser instances for each supported format', () => {
    expect(getParser('json')).toBeInstanceOf(JsonParser);
    expect(getParser('yaml')).toBeInstanceOf(YamlParser);
    expect(getParser('toml')).toBeInstanceOf(TomlParser);
    expect(() => getParser('xml')).toThrow(
      'XML parsing is only supported via parseDataAsync (async API).'
    );
  });

  it('throws for unsupported parser format', () => {
    expect(() => getParser('ini' as never)).toThrow('Unsupported format: ini');
  });

  it('parses JSON and YAML with parseData', () => {
    expect(parseData('{"name":"templjs"}', 'data.json')).toEqual({ name: 'templjs' });
    expect(parseData('name: templjs', 'data.yaml')).toEqual({ name: 'templjs' });
  });

  it('parses TOML with parseData', () => {
    expect(parseData('enabled = true\ncount = 3\nname = "templjs"', 'data.toml')).toEqual({
      enabled: true,
      count: 3,
      name: 'templjs',
    });
  });

  it('throws for undetectable file extension in parseData', () => {
    expect(() => parseData('name=templjs', 'data.unknown')).toThrow(
      'Unable to detect format from file path: data.unknown'
    );
  });

  it('parses xml asynchronously and defaults stdin to json in parseDataAsync', async () => {
    await expect(parseDataAsync('<root/>', 'data.xml')).resolves.toEqual({ root: '' });
    await expect(parseDataAsync('{"from":"stdin"}', '-')).resolves.toEqual({ from: 'stdin' });
  });

  it('throws for undetectable file extension in parseDataAsync', async () => {
    await expect(parseDataAsync('name=templjs', 'data.unknown')).rejects.toThrow(
      'Unable to detect format from file path: data.unknown'
    );
  });

  it('throws parser-specific validation errors', () => {
    expect(() => parseData('[1,2,3]', 'data.json')).toThrow('Input data must be a JSON object');
    expect(() => parseData('- item', 'data.yaml')).toThrow('Input data must be a YAML object');
    expect(() => parseData('not-an-assignment', 'data.toml')).toThrow('Invalid TOML');
    expect(() => parseData('plain-text', 'data.xml')).toThrow(
      'XML parsing is asynchronous. Use parseDataAsync(content, filePath) for .xml inputs.'
    );
  });
});
