import matter from 'gray-matter';

export interface FrontmatterRange {
  start: number;
  end: number;
}

export function detectFrontmatterRange(text: string): FrontmatterRange | undefined {
  if (!matter.test(text)) {
    return undefined;
  }

  try {
    const parsed = matter(text);
    const frontmatterLength = text.length - parsed.content.length;
    if (frontmatterLength <= 0) {
      return undefined;
    }

    return {
      start: 0,
      end: frontmatterLength,
    };
  } catch {
    return undefined;
  }
}

export function isOffsetInFrontmatter(
  text: string,
  offset: number,
  explicitRange?: FrontmatterRange
): boolean {
  const range = explicitRange ?? detectFrontmatterRange(text);
  if (!range) {
    return false;
  }

  return offset >= range.start && offset < range.end;
}
