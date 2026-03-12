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

  it('identifies offsets inside frontmatter and body correctly', () => {
    const text = '---\ntitle: test\n---\n# Heading\n{{ content.title }}';
    const range = detectFrontmatterRange(text);
    expect(range).toBeDefined();

    expect(isOffsetInFrontmatter(text, 5, range)).toBe(true);
    expect(isOffsetInFrontmatter(text, range!.end - 1, range)).toBe(true);
    expect(isOffsetInFrontmatter(text, range!.end, range)).toBe(false);
    expect(isOffsetInFrontmatter(text, text.length - 1, range)).toBe(false);
  });
});
