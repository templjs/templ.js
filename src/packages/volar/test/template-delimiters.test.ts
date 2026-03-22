import { describe, expect, it } from 'vitest';
import {
  buildBlockPattern,
  buildDelimiterPairPattern,
  buildTemplateBlockPattern,
  resolveDelimiters,
} from '../src/template-delimiters.js';

describe('template-delimiters', () => {
  it('rejects empty delimiter values', () => {
    expect(() =>
      resolveDelimiters({
        statementStart: '',
      })
    ).toThrow(/non-empty/i);
  });

  it('rejects duplicate delimiter values', () => {
    expect(() =>
      resolveDelimiters({
        statementStart: '<<',
        expressionStart: '<<',
      })
    ).toThrow(/distinct/i);
  });

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

  it('rejects end-delimiter prefix overlap', () => {
    expect(() =>
      resolveDelimiters({
        statementEnd: '>>',
        expressionEnd: '>',
      })
    ).toThrow(/end delimiters/i);
  });

  it('builds delimiter regex helpers for custom delimiters', () => {
    const delimiters = resolveDelimiters({
      statementStart: '<%',
      statementEnd: '%>',
      expressionStart: '<<',
      expressionEnd: '>>',
      commentStart: '<#',
      commentEnd: '#>',
    });

    const blockPattern = buildBlockPattern(delimiters.statementStart, delimiters.statementEnd);
    expect('<% if ok %>'.match(blockPattern)?.[0]).toBe('<% if ok %>');

    const pairPattern = buildDelimiterPairPattern(delimiters);
    expect('x << y >> z'.match(pairPattern)?.[0]).toBe('<<');

    const templatePattern = buildTemplateBlockPattern(delimiters);
    expect('a <% if x %> b'.match(templatePattern)?.[0]).toBe('<% if x %>');
  });
});
