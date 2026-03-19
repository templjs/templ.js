import { describe, expect, it } from 'vitest';
import { detectFrontmatterRange, isOffsetInFrontmatter } from '../src/frontmatter-zone.js';

describe('frontmatter-zone', () => {
  it('detects frontmatter range for LF documents', () => {
    const text = '---\ntitle: test\n---\n# Heading\nBody';
    const range = detectFrontmatterRange(text);

    expect(range).toEqual({ start: 0, end: '---\ntitle: test\n---\n'.length });
  });

  it('detects frontmatter range for CRLF documents', () => {
    const text = '---\r\ntitle: test\r\n---\r\n# Heading\r\nBody';
    const range = detectFrontmatterRange(text);

    expect(range).toEqual({ start: 0, end: '---\r\ntitle: test\r\n---\r\n'.length });
  });

  it('detects empty frontmatter blocks', () => {
    const text = '---\n---\n# Body';
    const range = detectFrontmatterRange(text);

    expect(range).toEqual({ start: 0, end: '---\n---\n'.length });
  });

  it('returns undefined when no frontmatter exists', () => {
    const text = '# Heading\nBody';
    const range = detectFrontmatterRange(text);

    expect(range).toBeUndefined();
  });

  it('returns undefined for unclosed frontmatter fences', () => {
    const text = '---\ntitle: test\n# Heading\nBody';
    const range = detectFrontmatterRange(text);

    expect(range).toBeUndefined();
  });

  it('detects frontmatter range with unicode and punctuation content', () => {
    const text =
      '---\ntitle: Caf\u00e9 \ud83d\ude80!\ndescription: "a:b,c;[]{}()!?@#&*"\n---\n# Body';
    const range = detectFrontmatterRange(text);
    const expectedBlock =
      '---\ntitle: Caf\u00e9 \ud83d\ude80!\ndescription: "a:b,c;[]{}()!?@#&*"\n---\n';

    expect(range).toEqual({ start: 0, end: expectedBlock.length });
    expect(text.slice(0, range!.end)).toBe(expectedBlock);

    const unicodeOffset = text.indexOf('\ud83d\ude80');
    const punctuationOffset = text.indexOf('?@#&*');
    expect(unicodeOffset).toBeGreaterThanOrEqual(0);
    expect(punctuationOffset).toBeGreaterThanOrEqual(0);
    expect(isOffsetInFrontmatter(text, unicodeOffset, range)).toBe(true);
    expect(isOffsetInFrontmatter(text, punctuationOffset, range)).toBe(true);
  });

  it('handles frontmatter boundary offsets correctly', () => {
    const text = '---\ntitle: test\n---\n# Heading\n{{ content.title }}';
    const range = detectFrontmatterRange(text);
    expect(range).toBeDefined();

    expect(isOffsetInFrontmatter(text, 0, range)).toBe(true);
    expect(isOffsetInFrontmatter(text, 5, range)).toBe(true);
    expect(isOffsetInFrontmatter(text, range!.end - 1, range)).toBe(true);
    expect(isOffsetInFrontmatter(text, range!.end, range)).toBe(false);
    expect(isOffsetInFrontmatter(text, text.length - 1, range)).toBe(false);
  });
});
