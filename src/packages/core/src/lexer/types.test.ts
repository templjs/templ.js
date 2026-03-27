import { describe, expect, it } from 'vitest';
import { DEFAULT_DELIMITERS, buildDefaultDelimiters, mergeDelimiterConfig } from './types.js';

describe('lexer/types delimiter helpers', () => {
  it('buildDefaultDelimiters derives tuple fields from boundaries', () => {
    const built = buildDefaultDelimiters({
      statement_start: '<%',
      statement_end: '%>',
      expression_start: '[[',
      expression_end: ']]',
      comment_start: '<#',
      comment_end: '#>',
    });

    expect(built).toEqual({
      statement_start: '<%',
      statement_end: '%>',
      statement: ['<%', '%>'],
      expression_start: '[[',
      expression_end: ']]',
      expression: ['[[', ']]'],
      comment_start: '<#',
      comment_end: '#>',
      comment: ['<#', '#>'],
    });
  });

  it('mergeDelimiterConfig returns defaults when config is empty', () => {
    expect(mergeDelimiterConfig({})).toEqual(DEFAULT_DELIMITERS);
  });

  it('mergeDelimiterConfig prefers tuple delimiters over scalar fields', () => {
    const merged = mergeDelimiterConfig({
      statement_start: '{?',
      statement_end: '?}',
      statement: ['<<', '>>'],
      expression_start: '{{?',
      expression_end: '?}}',
      expression: ['[[', ']]'],
      comment_start: '{##',
      comment_end: '##}',
      comment: ['/*', '*/'],
    });

    expect(merged.statement_start).toBe('<<');
    expect(merged.statement_end).toBe('>>');
    expect(merged.statement).toEqual(['<<', '>>']);

    expect(merged.expression_start).toBe('[[');
    expect(merged.expression_end).toBe(']]');
    expect(merged.expression).toEqual(['[[', ']]']);

    expect(merged.comment_start).toBe('/*');
    expect(merged.comment_end).toBe('*/');
    expect(merged.comment).toEqual(['/*', '*/']);
  });

  it('mergeDelimiterConfig uses scalar fallback when tuples are missing', () => {
    const merged = mergeDelimiterConfig({
      statement_start: '<%',
      statement_end: '%>',
      expression_start: '<{',
      expression_end: '}>',
      comment_start: '<!',
      comment_end: '!>',
    });

    expect(merged.statement).toEqual(['<%', '%>']);
    expect(merged.expression).toEqual(['<{', '}>']);
    expect(merged.comment).toEqual(['<!', '!>']);
  });
});
