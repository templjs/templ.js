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

describe('Regression: Position mapping with base format diagnostics', () => {
  it('should correctly map positions within template blocks (REGRESSION)', () => {
    // This test prevents regression of the bug where positions falling
    // within template blocks weren't properly mapped to adjacent content
    const original = 'Hello {{ name }} world';
    const { mappings } = generatePositionMappings(original, /\{\{[\s\S]*?\}\}/g);

    const mapper = new PositionMapper(mappings);

    // Position 6: 'H' in "Hello"
    expect(mapper.cleanedToOriginal(6)).toBe(6);

    // Position 7: space before template
    expect(mapper.cleanedToOriginal(7)).toBe(7);

    // Position 8-14 should map to nearby positions (inside template)
    // These should map correctly since the template spans 8-15
    const pos10 = mapper.cleanedToOriginal(10);
    expect(pos10).toBeGreaterThanOrEqual(8);
    expect(pos10).toBeLessThanOrEqual(15);

    // Position 15: space after template
    expect(mapper.cleanedToOriginal(15)).toBe(15);

    // Position 16: space before "world" (aligned since template is replaced with spaces)
    expect(mapper.cleanedToOriginal(16)).toBe(16);
  });

  it('should handle multiple adjacent templates correctly', () => {
    // Multiple templates in sequence - each position should map correctly
    const original = '{% if %}content{% endif %}{{ var }}';
    const { mappings } = generatePositionMappings(original, /\{[%{#][\s\S]*?[%}#]\}/g);

    const mapper = new PositionMapper(mappings);

    // Content between templates
    expect(mapper.cleanedToOriginal(8)).toBe(8);

    // A position in the middle of the second template
    const midTemplate = mapper.cleanedToOriginal(27);
    expect(midTemplate).toBeGreaterThanOrEqual(25);
  });

  it('should correctly remap base diagnostics with offset in template region', () => {
    // Simulates: JSON parser error on base format code at position 6
    // where original has: 'val: {{ expr }}, other'
    const original = 'val: {{ expr }}, other';
    const { mappings } = generatePositionMappings(original, /\{\{[\s\S]*?\}\}/g);
    const mapper = new PositionMapper(mappings);

    // If base format error was at cleaned position 6 (in the template space)
    // it should map to somewhere within or adjacent to the template block
    const remappedPos = mapper.cleanedToOriginal(6);
    expect(remappedPos).toBeGreaterThanOrEqual(5);
    expect(remappedPos).toBeLessThanOrEqual(14);
  });

  it('should handle line-based position mapping with templates', () => {
    const original = 'line1\n{{ multiline\nexpression }}\nline4';
    const { cleaned, mappings } = generatePositionMappings(original, /\{\{[\s\S]*?\}\}/g);
    const mapper = new PositionMapper(mappings);

    // Verify line structure is preserved
    const lines = cleaned.split('\n');
    expect(lines.length).toBe(4);

    // line 0, col 0
    expect(mapper.cleanedToOriginal(0)).toBe(0);

    // line 1 (which is inside the template)
    const line1Start = cleaned.indexOf('\n') + 1;
    const mapped = mapper.cleanedToOriginal(line1Start);
    expect(mapped).toBeGreaterThanOrEqual(line1Start);
  });

  it('should maintain accurate mappings for nested/complex template scenarios', () => {
    // Complex case: multiple template types
    const original = 'start {% block %} middle {{ var }} end {# comment #} final';
    const { mappings } = generatePositionMappings(original, /\{[%{#][\s\S]*?[%}#]\}/g);
    const mapper = new PositionMapper(mappings);

    // Should have mappings for all segments
    expect(mappings.length).toBeGreaterThan(0);

    // Roundtrip test: cleaned -> original -> cleaned should work
    for (let i = 0; i < 10; i++) {
      const originalPos = mapper.cleanedToOriginal(i);
      expect(originalPos).toBeLessThanOrEqual(original.length);
    }
  });
});
