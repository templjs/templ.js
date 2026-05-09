import { describe, expect, it } from 'vitest';
import {
  detectMarkdownFencedCodeRanges,
  isMarkdownTempljsLanguage,
  isOffsetInRanges,
  maskRangesForTemplateSemantics,
} from '../src/markdown-templjs-adapter.ts';

describe('markdown-templjs-adapter', () => {
  it('recognizes templjs markdown language id only', () => {
    expect(isMarkdownTempljsLanguage('templjs-markdown')).toBe(true);
    expect(isMarkdownTempljsLanguage('markdown')).toBe(false);
    expect(isMarkdownTempljsLanguage(undefined)).toBe(false);
  });

  it('detects closed and unclosed fenced ranges with backticks and tildes', () => {
    const text = ['# Title', '```yaml', 'key: value', '```', '~~~json', '{"ok":true}'].join('\n');

    const ranges = detectMarkdownFencedCodeRanges(text);

    expect(ranges).toHaveLength(2);
    expect(text.slice(ranges[0].start, ranges[0].end).startsWith('```yaml')).toBe(true);
    expect(text.slice(ranges[1].start, ranges[1].end).startsWith('~~~json')).toBe(true);
  });

  it('checks offsets against fenced ranges and masks fenced content', () => {
    const text = [
      'before',
      '```md',
      '{{ value }}',
      '```',
      'middle',
      '~~~json',
      '{"ok":true}',
      '~~~',
      'after',
    ].join('\n');
    const ranges = detectMarkdownFencedCodeRanges(text);

    expect(isOffsetInRanges(0, ranges)).toBe(false);
    expect(isOffsetInRanges(text.indexOf('```md'), ranges)).toBe(true);

    const masked = maskRangesForTemplateSemantics(text, ranges);

    expect(masked.slice(0, 'before'.length)).toBe('before');
    expect(masked.includes('{{ value }}')).toBe(false);
    expect(masked.length).toBe(text.length);
    expect(maskRangesForTemplateSemantics('plain', [])).toBe('plain');
  });

  it('ignores oversized fences to keep close-pattern matching bounded', () => {
    const hugeFence = '`'.repeat(101);
    const text = [hugeFence, '{{ hidden }}', hugeFence].join('\n');

    const ranges = detectMarkdownFencedCodeRanges(text);

    expect(ranges).toEqual([]);
  });
});
