/**
 * Markdown-specific utilities extracted from service-plugins.ts
 * These utilities handle markdown fencing and templating logic specific to markdown templates.
 */

export function isMarkdownTempljsLanguage(languageId: string | undefined): boolean {
  return languageId === 'templjs-markdown';
}

export type FencedRange = { start: number; end: number };

/**
 * Detects markdown fenced code ranges (``` or ~~~) in the provided text.
 * Returns an array of ranges representing code blocks to be masked for template processing.
 */
export function detectMarkdownFencedCodeRanges(text: string): FencedRange[] {
  const ranges: FencedRange[] = [];
  const lines = text.split(/\r?\n/);
  let offset = 0;

  let openFence:
    | {
        marker: '`' | '~';
        size: number;
        startOffset: number;
      }
    | undefined;

  for (const line of lines) {
    const startOffset = offset;
    const endOffset = startOffset + line.length;
    const lineBreakLength = text.startsWith('\r\n', endOffset) ? 2 : 1;
    offset = Math.min(text.length, endOffset + lineBreakLength);

    if (!openFence) {
      const openMatch = line.match(/^\s{0,3}(`{3,}|~{3,})[^`~]*$/);
      if (!openMatch) {
        continue;
      }

      const marker = openMatch[1][0] as '`' | '~';
      openFence = {
        marker,
        size: openMatch[1].length,
        startOffset,
      };
      continue;
    }

    const closePattern = new RegExp(`^\\s{0,3}${openFence.marker}{${openFence.size},}\\s*$`);
    if (!closePattern.test(line)) {
      continue;
    }

    ranges.push({
      start: openFence.startOffset,
      end: offset,
    });
    openFence = undefined;
  }

  if (openFence) {
    ranges.push({
      start: openFence.startOffset,
      end: text.length,
    });
  }

  return ranges;
}

export function isOffsetInRanges(offset: number, ranges: FencedRange[]): boolean {
  return ranges.some((range) => offset >= range.start && offset < range.end);
}

/**
 * Masks fenced code ranges to spaces to preserve offsets while protecting code block content
 * from template semantic analysis.
 */
export function maskRangesForTemplateSemantics(text: string, ranges: FencedRange[]): string {
  if (ranges.length === 0) {
    return text;
  }

  let masked = text;

  // Sort ranges in reverse order to avoid offset shifts when replacing
  for (const range of [...ranges].sort((a, b) => b.start - a.start)) {
    const before = masked.slice(0, range.start);
    const rangeContent = masked.slice(range.start, range.end);
    const after = masked.slice(range.end);

    // Replace code block content with spaces to preserve offsets
    const maskedRange = rangeContent
      .split('\n')
      .map((line) => ' '.repeat(line.length))
      .join('\n');
    masked = before + maskedRange + after;
  }

  return masked;
}
