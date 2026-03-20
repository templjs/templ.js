import { describe, expect, it, vi } from 'vitest';

vi.mock('gray-matter', () => {
  const matter = ((text: string) => {
    if (text.includes('throw-parse')) {
      throw new Error('parse failure');
    }
    if (text.includes('no-frontmatter-content')) {
      return { content: text };
    }
    return { content: '# body' };
  }) as unknown as ((text: string) => { content: string }) & {
    test: (text: string) => boolean;
  };

  matter.test = (text: string) => !text.includes('not-frontmatter');

  return {
    default: matter,
  };
});

describe('frontmatter-zone error paths', () => {
  it('returns undefined when frontmatter detector says false', async () => {
    const mod = await import('../src/frontmatter-zone.js');
    expect(mod.detectFrontmatterRange('not-frontmatter')).toBeUndefined();
  });

  it('returns undefined when parsed content length does not reduce text length', async () => {
    const mod = await import('../src/frontmatter-zone.js');
    expect(mod.detectFrontmatterRange('no-frontmatter-content')).toBeUndefined();
  });

  it('returns undefined when parser throws', async () => {
    const mod = await import('../src/frontmatter-zone.js');
    expect(mod.detectFrontmatterRange('throw-parse')).toBeUndefined();
  });

  it('isOffsetInFrontmatter returns false when no range is available', async () => {
    const mod = await import('../src/frontmatter-zone.js');
    expect(mod.isOffsetInFrontmatter('not-frontmatter', 0)).toBe(false);
  });
});
