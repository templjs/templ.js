import { describe, it, expect } from 'vitest';
import {
  PositionMapper,
  LineColumnMapper,
  RangeMapper,
  generatePositionMappings,
  type PositionMapping,
} from './position-mapping';

describe('PositionMapper', () => {
  it('should map single position from original to cleaned', () => {
    const mappings: PositionMapping[] = [
      { originalOffset: 0, cleanedOffset: 0, length: 5 },
      { originalOffset: 10, cleanedOffset: 5, length: 5 },
    ];
    const mapper = new PositionMapper(mappings);
    expect(mapper.originalToCleaned(2)).toBe(2);
    expect(mapper.originalToCleaned(12)).toBe(7);
  });

  it('should map position from cleaned to original', () => {
    const mappings: PositionMapping[] = [
      { originalOffset: 0, cleanedOffset: 0, length: 5 },
      { originalOffset: 10, cleanedOffset: 5, length: 5 },
    ];
    const mapper = new PositionMapper(mappings);
    expect(mapper.cleanedToOriginal(2)).toBe(2);
    expect(mapper.cleanedToOriginal(7)).toBe(12);
  });

  it('should handle roundtrip conversion', () => {
    const mappings: PositionMapping[] = [
      { originalOffset: 0, cleanedOffset: 0, length: 10 },
      { originalOffset: 20, cleanedOffset: 10, length: 10 },
    ];
    const mapper = new PositionMapper(mappings);
    for (let i = 0; i < 20; i++) {
      if (i < 10 || i >= 20) {
        const cleaned = mapper.originalToCleaned(i);
        const original = mapper.cleanedToOriginal(cleaned);
        expect(original).toBe(i);
      }
    }
  });

  it('should handle empty mappings', () => {
    const mapper = new PositionMapper([]);
    expect(mapper.originalToCleaned(0)).toBe(0);
    expect(mapper.cleanedToOriginal(0)).toBe(0);
  });
});

describe('LineColumnMapper', () => {
  it('should convert offset to line/col', () => {
    const code = 'hello\nworld\ntest';
    const mapper = new LineColumnMapper(code);

    expect(mapper.offsetToLineCol(0)).toEqual({ line: 0, column: 0 });
    expect(mapper.offsetToLineCol(5)).toEqual({ line: 0, column: 5 });
    expect(mapper.offsetToLineCol(6)).toEqual({ line: 1, column: 0 });
    expect(mapper.offsetToLineCol(11)).toEqual({ line: 1, column: 5 });
    expect(mapper.offsetToLineCol(12)).toEqual({ line: 2, column: 0 });
  });

  it('should convert line/col to offset', () => {
    const code = 'hello\nworld\ntest';
    const mapper = new LineColumnMapper(code);

    expect(mapper.lineColToOffset(0, 0)).toBe(0);
    expect(mapper.lineColToOffset(0, 5)).toBe(5);
    expect(mapper.lineColToOffset(1, 0)).toBe(6);
    expect(mapper.lineColToOffset(1, 5)).toBe(11);
    expect(mapper.lineColToOffset(2, 0)).toBe(12);
  });

  it('should handle CRLF line endings', () => {
    const code = 'hello\r\nworld';
    const mapper = new LineColumnMapper(code);

    expect(mapper.offsetToLineCol(0)).toEqual({ line: 0, column: 0 });
    expect(mapper.offsetToLineCol(7)).toEqual({ line: 1, column: 0 });
  });

  it('should count lines correctly', () => {
    expect(new LineColumnMapper('hello').getLineCount()).toBe(1);
    expect(new LineColumnMapper('hello\n').getLineCount()).toBe(2);
    expect(new LineColumnMapper('hello\nworld\ntest').getLineCount()).toBe(3);
  });

  it('should handle empty code', () => {
    const mapper = new LineColumnMapper('');
    expect(mapper.getLineCount()).toBe(1);
    expect(mapper.offsetToLineCol(0)).toEqual({ line: 0, column: 0 });
  });
});

describe('generatePositionMappings', () => {
  it('should handle simple template removal', () => {
    const original = 'hello {{ name }} world';
    const { cleaned, mappings } = generatePositionMappings(original, /\{\{[\s\S]*?\}\}/g);

    // Verify: original length maintained, plain text preserved, no template delimiters
    expect(cleaned.length).toBe(original.length);
    expect(cleaned).toMatch(/hello.*world/);
    expect(cleaned).not.toContain('{{');
    expect(cleaned).not.toContain('}}');
    expect(mappings.length).toBeGreaterThan(0);
  });

  it('should preserve line count', () => {
    const original = 'hello\n{% for x in y %}\nworld\n{% endfor %}';
    const { cleaned } = generatePositionMappings(original, /\{%[\s\S]*?%\}/g);

    const originalLines = original.split('\n').length;
    const cleanedLines = cleaned.split('\n').length;
    expect(cleanedLines).toBe(originalLines);
  });

  it('should handle multiline directives', () => {
    const original = 'before\n{% if\n  condition\n%}\nafter';
    const { cleaned } = generatePositionMappings(original, /\{%[\s\S]*?%\}/g);

    expect(cleaned.split('\n').length).toBe(original.split('\n').length);
    expect(cleaned.includes('before')).toBe(true);
    expect(cleaned.includes('after')).toBe(true);
  });

  it('should handle multiple templates on same line', () => {
    const original = '{{ var1 }} and {{ var2 }}';
    const { cleaned } = generatePositionMappings(original, /\{\{[\s\S]*?\}\}/g);

    // Verify: original length maintained, plain text preserved, no template delimiters
    expect(cleaned.length).toBe(original.length);
    expect(cleaned).toContain('and');
    expect(cleaned).not.toContain('{{');
    expect(cleaned).not.toContain('}}');
  });

  it('should handle nested patterns', () => {
    const original = '{% for user in users %}{{ user.name }}{% endfor %}';
    const { cleaned } = generatePositionMappings(original, /\{[%{#][\s\S]*?[%}#]\}/g);

    expect(cleaned.length).toBe(original.length);
  });

  it('should handle comments', () => {
    const original = 'before {# comment #} after';
    const { cleaned } = generatePositionMappings(original, /\{#[\s\S]*?#\}/g);

    expect(cleaned).toBe('before               after');
  });

  it('should handle no templates', () => {
    const original = 'just plain text';
    const { cleaned } = generatePositionMappings(original, /\{\{[\s\S]*?\}\}/g);

    expect(cleaned).toBe(original);
  });
});

describe('RangeMapper', () => {
  it('should map ranges from original to cleaned', () => {
    const original = 'hello {{ name }} world';
    const { cleaned, mappings } = generatePositionMappings(original, /\{\{[\s\S]*?\}\}/g);

    const rangeMapper = new RangeMapper(original, cleaned, mappings);
    const result = rangeMapper.originalRangeToCleaned(0, 0, 0, 5);

    expect(result.startLine).toBe(0);
    expect(result.startCol).toBe(0);
    expect(result.endLine).toBe(0);
    expect(result.endCol).toBe(5);
  });

  it('should map ranges from cleaned to original', () => {
    const original = 'hello\n{{ name }}\nworld';
    const { cleaned, mappings } = generatePositionMappings(original, /\{\{[\s\S]*?\}\}/g);

    const rangeMapper = new RangeMapper(original, cleaned, mappings);
    const result = rangeMapper.cleanedRangeToOriginal(0, 0, 0, 5);

    expect(result.startLine).toBe(0);
    expect(result.startCol).toBe(0);
    expect(result.endLine).toBe(0);
    expect(result.endCol).toBe(5);
  });

  it('should handle multiline ranges', () => {
    const original = 'line1\n{{ var }}\nline2\n{{ var2 }}\nline3';
    const { cleaned, mappings } = generatePositionMappings(original, /\{\{[\s\S]*?\}\}/g);

    const rangeMapper = new RangeMapper(original, cleaned, mappings);
    const result = rangeMapper.originalRangeToCleaned(0, 0, 4, 5);

    expect(result.startLine).toBe(0);
    expect(result.endLine).toBeGreaterThanOrEqual(0);
  });
});

describe('Edge cases', () => {
  it('should handle consecutive templates', () => {
    const original = '{{ a }}{{ b }}{{ c }}';
    const { cleaned } = generatePositionMappings(original, /\{\{[\s\S]*?\}\}/g);

    // All text is templates, so cleaned should be all spaces
    expect(cleaned.length).toBe(original.length);
    expect(cleaned.trim().length).toBe(0);
  });

  it('should handle templates at boundaries', () => {
    const original = '{{ start }}middle{{ end }}';
    const { cleaned } = generatePositionMappings(original, /\{\{[\s\S]*?\}\}/g);

    expect(cleaned.length).toBe(original.length);
    expect(cleaned).toContain('middle');
  });

  it('should handle Windows line endings (CRLF)', () => {
    const original = 'line1\r\n{{ var }}\r\nline2';
    const { cleaned } = generatePositionMappings(original, /\{\{[\s\S]*?\}\}/g);

    const originalLines = original.split('\r\n').length;
    const cleanedNewlines = (cleaned.match(/\r/g) || []).length;
    expect(cleanedNewlines).toBe(originalLines - 1);
  });

  it('should handle mixed content', () => {
    const original = 'Start\n{% if foo %}\nContent\n{% endif %}\n{{ bar }}\nEnd';
    const { cleaned, mappings } = generatePositionMappings(original, /\{[%{#][\s\S]*?[%}#]\}/g);

    expect(cleaned.split('\n').length).toBe(original.split('\n').length);
    expect(mappings.length).toBeGreaterThan(0);
  });

  it('should maintain letter preservation', () => {
    const original = 'a{{ x }}b{{ y }}c{{ z }}d';
    const { cleaned } = generatePositionMappings(original, /\{\{[\s\S]*?\}\}/g);

    // Check that non-template characters are preserved
    expect(cleaned).toContain('a');
    expect(cleaned).toContain('b');
    expect(cleaned).toContain('c');
    expect(cleaned).toContain('d');
    expect(cleaned.length).toBe(original.length);
  });
});
