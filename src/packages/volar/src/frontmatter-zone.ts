import matter from 'gray-matter';

export interface FrontmatterRange {
  start: number;
  end: number;
}

function readLine(text: string, start: number): { end: number; line: string } {
  let index = start;
  while (index < text.length && text[index] !== '\n') {
    index += 1;
  }

  if (index < text.length && text[index] === '\n') {
    index += 1;
  }

  return {
    end: index,
    line: text.slice(start, index),
  };
}

function stripLineEnding(line: string): string {
  if (line.endsWith('\r\n')) {
    return line.slice(0, -2);
  }

  if (line.endsWith('\n')) {
    return line.slice(0, -1);
  }

  return line;
}

function detectYamlFenceFrontmatterRange(text: string): FrontmatterRange | undefined {
  if (text.length === 0) {
    return undefined;
  }

  const firstLine = readLine(text, 0);
  const firstLineContent = stripLineEnding(firstLine.line).replace(/^\uFEFF/, '');
  if (!/^---[ \t]*$/.test(firstLineContent)) {
    return undefined;
  }

  let offset = firstLine.end;
  while (offset <= text.length) {
    const nextLine = readLine(text, offset);
    const content = stripLineEnding(nextLine.line);
    if (/^(---|\.\.\.)[ \t]*$/.test(content)) {
      return {
        start: 0,
        end: nextLine.end,
      };
    }

    if (nextLine.end === offset) {
      break;
    }
    offset = nextLine.end;
  }

  return undefined;
}

export function detectFrontmatterRange(text: string): FrontmatterRange | undefined {
  // Prefer delimiter detection so malformed YAML still gets a frontmatter range
  // and can be validated by downstream YAML diagnostics.
  const fencedRange = detectYamlFenceFrontmatterRange(text);
  if (fencedRange) {
    return fencedRange;
  }

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
