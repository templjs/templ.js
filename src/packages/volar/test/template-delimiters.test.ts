import { describe, expect, it } from 'vitest';
import { resolveDelimiters } from '../src/template-delimiters.js';

describe('template-delimiters', () => {
  it('rejects prefix-overlapping delimiter pairs', () => {
    expect(() =>
      resolveDelimiters({
        statementStart: '<',
        statementEnd: '>',
        expressionStart: '<<',
        expressionEnd: '>>',
      })
    ).toThrow(/overlap/i);
  });
});
