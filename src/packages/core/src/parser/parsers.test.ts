import { describe, expect, it } from 'vitest';
import {
  createCharContextIterator,
  isWrappedByOutermostParens,
  splitByOperatorFromLeft,
  splitByOperatorFromRight,
} from './parsers.js';

describe('isWrappedByOutermostParens', () => {
  it('returns true for simple wrapped expressions', () => {
    expect(isWrappedByOutermostParens('(x)')).toBe(true);
    expect(isWrappedByOutermostParens('(x + y)')).toBe(true);
  });

  it('returns false for expressions not wrapped by outermost parens', () => {
    expect(isWrappedByOutermostParens('(a) + (b)')).toBe(false);
    expect(isWrappedByOutermostParens('x(y)')).toBe(false);
  });

  it('returns false for empty or whitespace-padded inputs', () => {
    expect(isWrappedByOutermostParens('')).toBe(false);
    expect(isWrappedByOutermostParens('  ')).toBe(false);
    expect(isWrappedByOutermostParens(' (x) ')).toBe(false);
  });

  it('returns true for empty parentheses and nested wrapped expressions', () => {
    expect(isWrappedByOutermostParens('()')).toBe(true);
    expect(isWrappedByOutermostParens('((x))')).toBe(true);
    expect(isWrappedByOutermostParens('(((a + b)))')).toBe(true);
  });

  it('returns false for malformed or unbalanced parentheses', () => {
    expect(isWrappedByOutermostParens('(x')).toBe(false);
    expect(isWrappedByOutermostParens('x)')).toBe(false);
    expect(isWrappedByOutermostParens(')x(')).toBe(false);
  });

  it('handles wrapped expressions containing comment text', () => {
    expect(isWrappedByOutermostParens('(/* comment */ x)')).toBe(true);
  });

  it('handles wrapped string literal content correctly', () => {
    expect(isWrappedByOutermostParens('("(")')).toBe(true);
    expect(isWrappedByOutermostParens("('(')")).toBe(true);
  });

  it('handles wrapped template literals correctly', () => {
    expect(isWrappedByOutermostParens('(`${x}`)')).toBe(true);
  });

  it('handles nested template literal expressions correctly', () => {
    expect(isWrappedByOutermostParens('(`${`nested`}`)')).toBe(true);
  });
});

describe('splitByOperatorFromLeft', () => {
  it('splits correctly for a basic single operator expression', () => {
    expect(splitByOperatorFromLeft('a + b', '+')).toEqual({
      left: 'a ',
      right: ' b',
    });
  });

  it('returns null when the operator is absent', () => {
    expect(splitByOperatorFromLeft('a b c', '+')).toBeNull();
  });

  it('ignores operators inside parentheses and splits on the outer operator', () => {
    expect(splitByOperatorFromLeft('(a + b) + c', '+')).toEqual({
      left: '(a + b) ',
      right: ' c',
    });
  });

  it('supports different operator parameters', () => {
    expect(splitByOperatorFromLeft('a - b - c', '-')).toEqual({
      left: 'a ',
      right: ' b - c',
    });
    expect(splitByOperatorFromLeft('a * b * c', '*')).toEqual({
      left: 'a ',
      right: ' b * c',
    });
  });

  it('supports multi-character operators', () => {
    expect(splitByOperatorFromLeft('a && b && c', '&&')).toEqual({
      left: 'a ',
      right: ' b && c',
    });
    expect(splitByOperatorFromLeft('a || b || c', '||')).toEqual({
      left: 'a ',
      right: ' b || c',
    });
    expect(splitByOperatorFromLeft('a === b === c', '===')).toEqual({
      left: 'a ',
      right: ' b === c',
    });
  });

  it('handles empty input and operator-at-boundary edge cases', () => {
    expect(splitByOperatorFromLeft('', '+')).toBeNull();
    expect(splitByOperatorFromLeft('+a', '+')).toEqual({ left: '', right: 'a' });
    expect(splitByOperatorFromLeft('a+', '+')).toEqual({ left: 'a', right: '' });
  });

  it('ignores operators inside template literals and splits on outer operator', () => {
    expect(splitByOperatorFromLeft('`a + b` + c', '+')).toEqual({
      left: '`a + b` ',
      right: ' c',
    });
  });

  it('ignores operators inside quoted string literals', () => {
    expect(splitByOperatorFromLeft("'a + b' + c", '+')).toEqual({
      left: "'a + b' ",
      right: ' c',
    });
    expect(splitByOperatorFromLeft("'a\\'b + c' + d", '+')).toEqual({
      left: "'a\\'b + c' ",
      right: ' d',
    });
    expect(splitByOperatorFromLeft('"a\\"b + c" + d', '+')).toEqual({
      left: '"a\\"b + c" ',
      right: ' d',
    });
    expect(splitByOperatorFromLeft("'a\\'b + c' + d + e", '+')).toEqual({
      left: "'a\\'b + c' ",
      right: ' d + e',
    });
    expect(splitByOperatorFromLeft("'a + b'", '+')).toBeNull();
  });

  it('ignores operators inside line comments and block comments', () => {
    expect(splitByOperatorFromLeft('a // comment + x\n + b', '+')).toEqual({
      left: 'a // comment + x\n ',
      right: ' b',
    });
    expect(splitByOperatorFromLeft('a /* comment + x */ + b', '+')).toEqual({
      left: 'a /* comment + x */ ',
      right: ' b',
    });
  });

  it('returns null when operator appears only inside comments', () => {
    expect(splitByOperatorFromLeft('a // comment + x', '+')).toBeNull();
    expect(splitByOperatorFromLeft('a /* comment + x */', '+')).toBeNull();
  });

  it('does not split when operator exists only inside template literal', () => {
    expect(splitByOperatorFromLeft('`${x + y}`', '+')).toBeNull();
  });

  it('ignores braces inside quoted strings within template expressions', () => {
    expect(splitByOperatorFromLeft('`${"}"} + x` + y', '+')).toEqual({
      left: '`${"}"} + x` ',
      right: ' y',
    });
  });
});

describe('splitByOperatorFromRight', () => {
  it('splits on the rightmost operator for repeated operators', () => {
    expect(splitByOperatorFromRight('a + b + c', '+')).toEqual({
      left: 'a + b ',
      right: ' c',
    });
  });

  it('splits correctly when expression has a single operator', () => {
    expect(splitByOperatorFromRight('a + b', '+')).toEqual({
      left: 'a ',
      right: ' b',
    });
  });

  it('supports multi-character operators', () => {
    expect(splitByOperatorFromRight('a && b && c', '&&')).toEqual({
      left: 'a && b ',
      right: ' c',
    });
    expect(splitByOperatorFromRight('a || b || c', '||')).toEqual({
      left: 'a || b ',
      right: ' c',
    });
    expect(splitByOperatorFromRight('a === b === c', '===')).toEqual({
      left: 'a === b ',
      right: ' c',
    });
  });

  it('ignores operators inside parentheses and splits on outer operator', () => {
    expect(splitByOperatorFromRight('a + (b + c)', '+')).toEqual({
      left: 'a ',
      right: ' (b + c)',
    });
  });

  it('returns null when the operator is not present', () => {
    expect(splitByOperatorFromRight('a b c', '+')).toBeNull();
  });

  it('handles empty input and operator-at-boundary edge cases', () => {
    expect(splitByOperatorFromRight('', '+')).toBeNull();
    expect(splitByOperatorFromRight('+a', '+')).toEqual({ left: '', right: 'a' });
    expect(splitByOperatorFromRight('a+', '+')).toEqual({ left: 'a', right: '' });
  });

  it('ignores operators inside template literals and returns rightmost outer split', () => {
    expect(splitByOperatorFromRight('a + `${x + y}` + c', '+')).toEqual({
      left: 'a + `${x + y}` ',
      right: ' c',
    });
  });

  it('ignores operators inside quoted string literals', () => {
    expect(splitByOperatorFromRight("a + 'b + c'", '+')).toEqual({
      left: 'a ',
      right: " 'b + c'",
    });
  });

  it('ignores operators inside line comments and block comments', () => {
    expect(splitByOperatorFromRight('a // comment + x\n + b', '+')).toEqual({
      left: 'a // comment + x\n ',
      right: ' b',
    });
    expect(splitByOperatorFromRight('a + /* comment + x */ + b', '+')).toEqual({
      left: 'a + /* comment + x */ ',
      right: ' b',
    });
  });

  it('returns null when operator appears only inside comments', () => {
    expect(splitByOperatorFromRight('a // comment + x', '+')).toBeNull();
    expect(splitByOperatorFromRight('a /* comment + x */', '+')).toBeNull();
  });

  it('does not split when operator exists only inside nested template literals', () => {
    expect(splitByOperatorFromRight('`${`x + y`}`', '+')).toBeNull();
  });

  it('ignores braces inside quoted strings within template expressions', () => {
    expect(splitByOperatorFromRight('a + `${"{"} + x` + b', '+')).toEqual({
      left: 'a + `${"{"} + x` ',
      right: ' b',
    });
  });
});

describe('createCharContextIterator', () => {
  it('tracks unterminated and terminated single-quoted string state', () => {
    const unterminated = createCharContextIterator("'unterminated", () => {});
    const terminated = createCharContextIterator("'it\\'s done'", () => {});

    expect(unterminated.inSingleQuote).toBe(true);
    expect(unterminated.inDoubleQuote).toBe(false);
    expect(terminated.inSingleQuote).toBe(false);
    expect(terminated.inDoubleQuote).toBe(false);
  });

  it('tracks unterminated and terminated double-quoted string state', () => {
    const unterminated = createCharContextIterator('"unterminated', () => {});
    const terminated = createCharContextIterator('"quoted"', () => {});

    expect(unterminated.inDoubleQuote).toBe(true);
    expect(unterminated.inSingleQuote).toBe(false);
    expect(terminated.inDoubleQuote).toBe(false);
    expect(terminated.inSingleQuote).toBe(false);
  });

  it('keeps structural depth unchanged for delimiters inside strings', () => {
    const summary = createCharContextIterator('("x)")', () => {});

    expect(summary.depth).toBe(0);
    expect(summary.inDoubleQuote).toBe(false);
  });

  it('tracks template literal and interpolation context transitions', () => {
    const closed = createCharContextIterator('`${`nested`}`', () => {});
    const unterminated = createCharContextIterator('`value ${count + 1', () => {});

    expect(closed.templateLiteralDepth).toBe(0);
    expect(closed.templateExprDepth).toBe(0);
    expect(closed.templateContextDepth).toBe(0);

    expect(unterminated.templateLiteralDepth).toBe(1);
    expect(unterminated.templateExprDepth).toBe(1);
    expect(unterminated.templateContextDepth).toBe(2);
  });

  it('handles escaped template literal delimiters without leaving template state', () => {
    const summary = createCharContextIterator('`value \\`still template`', () => {});

    expect(summary.templateLiteralDepth).toBe(0);
    expect(summary.templateExprDepth).toBe(0);
    expect(summary.templateContextDepth).toBe(0);
  });

  it('tracks balanced and unbalanced nesting depth', () => {
    const balanced = createCharContextIterator('(a + [b * { c: d }])', () => {});
    const unbalanced = createCharContextIterator('(a + [b * { c: d }]', () => {});

    expect(balanced.depth).toBe(0);
    expect(unbalanced.depth).toBe(1);
  });

  it('reports unterminated line comments in summary state', () => {
    const summary = createCharContextIterator('value // unterminated', () => {});

    expect(summary.inLineComment).toBe(true);
    expect(summary.inBlockComment).toBe(false);
  });

  it('reports unterminated block comments in summary state', () => {
    const summary = createCharContextIterator('value /* unterminated', () => {});

    expect(summary.inBlockComment).toBe(true);
    expect(summary.inLineComment).toBe(false);
  });

  it('clears comment flags when comments are closed before input end', () => {
    const lineSummary = createCharContextIterator('value // done\nnext', () => {});
    const blockSummary = createCharContextIterator('value /* done */ next', () => {});

    expect(lineSummary.inLineComment).toBe(false);
    expect(lineSummary.inBlockComment).toBe(false);
    expect(blockSummary.inLineComment).toBe(false);
    expect(blockSummary.inBlockComment).toBe(false);
  });

  it('reports correct frame depthBefore and depthAfter for opening/closing brackets', () => {
    const frames: Array<{ ch: string; depthBefore: number; depthAfter: number }> = [];

    createCharContextIterator('(a[b])', (frame) => {
      frames.push({ ch: frame.ch, depthBefore: frame.depthBefore, depthAfter: frame.depthAfter });
    });

    const open1 = frames.find((f) => f.ch === '(')!;
    expect(open1.depthBefore).toBe(0);
    expect(open1.depthAfter).toBe(1);

    const close1 = frames.at(-1)!;
    expect(close1.ch).toBe(')');
    expect(close1.depthBefore).toBe(1);
    expect(close1.depthAfter).toBe(0);
  });

  it('reports inTemplateExpr=false and inTemplateBody=false for plain expressions', () => {
    const frames: Array<{ inTemplateBody: boolean; inTemplateExpr: boolean }> = [];

    createCharContextIterator('a + b', (frame) => {
      frames.push({ inTemplateBody: frame.inTemplateBody, inTemplateExpr: frame.inTemplateExpr });
    });

    expect(frames.every((f) => !f.inTemplateBody && !f.inTemplateExpr)).toBe(true);
  });

  it('never emits inTemplateBody=true because template literal body characters are skipped', () => {
    const visitedChars: string[] = [];

    createCharContextIterator('`body chars`', (frame) => {
      visitedChars.push(frame.ch);
    });

    // The backtick and body characters are consumed as template state — no frames emitted
    expect(visitedChars).toHaveLength(0);
  });

  it('does not visit structural characters inside ${...} with allowStructuralInTemplateExpr=false (default)', () => {
    const visitedChars: string[] = [];

    createCharContextIterator('`${x + y}`', (frame) => {
      visitedChars.push(frame.ch);
    });

    // With default (false), structural chars inside template expr are not visited
    expect(visitedChars).toHaveLength(0);
  });

  it('visits structural characters inside ${...} when allowStructuralInTemplateExpr=true', () => {
    const visitedChars: string[] = [];

    createCharContextIterator(
      '`${x + y}`',
      (frame) => {
        visitedChars.push(frame.ch);
      },
      { allowStructuralInTemplateExpr: true }
    );

    // With allowStructuralInTemplateExpr=true, chars inside ${} reach the visitor
    expect(visitedChars.length).toBeGreaterThan(0);
    expect(visitedChars).toContain('+');
  });

  it('handles deeply nested template literal: outer ${`inner ${x}`}', () => {
    // `outer ${`inner ${x}`}` — two levels of template nesting
    const expr = '`outer ${`inner ${x}`}`';
    const summary = createCharContextIterator(expr, () => {});

    expect(summary.templateLiteralDepth).toBe(0);
    expect(summary.templateExprDepth).toBe(0);
    expect(summary.templateContextDepth).toBe(0);
    expect(summary.depth).toBe(0);
  });

  it('reports partial summary for deeply nested template literal that is unclosed', () => {
    // Missing closing backtick/braces
    const expr = '`outer ${`inner ${x}';
    const summary = createCharContextIterator(expr, () => {});

    expect(summary.templateLiteralDepth).toBeGreaterThan(0);
    expect(summary.templateContextDepth).toBeGreaterThan(0);
  });

  it('visitor can stop iteration early by returning false', () => {
    const visitedChars: string[] = [];

    createCharContextIterator('a + b + c', (frame) => {
      if (frame.ch === '+') {
        return false;
      }
      visitedChars.push(frame.ch);
    });

    // Should stop at first '+', so only 'a', ' ' are visited before it
    expect(visitedChars).not.toContain('b');
    expect(visitedChars).not.toContain('c');
  });

  it('tracks nextCh correctly for the frame before a closing delimiter', () => {
    let frameBeforeClose: { ch: string; nextCh: string | undefined } | undefined;

    createCharContextIterator('a)', (frame) => {
      if (frame.ch === 'a') {
        frameBeforeClose = { ch: frame.ch, nextCh: frame.nextCh };
      }
    });

    expect(frameBeforeClose?.nextCh).toBe(')');
  });

  it('returns undefined nextCh for the last character', () => {
    let lastFrame: { ch: string; nextCh: string | undefined } | undefined;

    createCharContextIterator('ab', (frame) => {
      lastFrame = { ch: frame.ch, nextCh: frame.nextCh };
    });

    expect(lastFrame?.ch).toBe('b');
    expect(lastFrame?.nextCh).toBeUndefined();
  });

  it('does not increment depth for braces inside string literals', () => {
    const frames: Array<{ ch: string; depthAfter: number }> = [];

    createCharContextIterator('"{" + x', (frame) => {
      frames.push({ ch: frame.ch, depthAfter: frame.depthAfter });
    });

    // The + and x are at depth 0; no depth change from the quoted brace
    const plus = frames.find((f) => f.ch === '+');
    expect(plus?.depthAfter).toBe(0);
  });

  it('allowStructuralInTemplateExpr=true visits nested parens inside template expr and tracks depth', () => {
    const depths: number[] = [];

    createCharContextIterator(
      '`${(a)}`',
      (frame) => {
        depths.push(frame.depthAfter);
      },
      { allowStructuralInTemplateExpr: true }
    );

    expect(depths).toContain(1); // inside parens
    expect(depths).toContain(0); // after closing paren
  });
});
