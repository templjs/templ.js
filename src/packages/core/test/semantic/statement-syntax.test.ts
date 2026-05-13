import { describe, expect, it } from 'vitest';
import {
  extractTemplateStatementExpression,
  parseTemplateForHeader,
  validateTemplateStatementSyntax,
} from '../../src/index.js';

describe('validateTemplateStatementSyntax', () => {
  it('accepts valid for statements', () => {
    expect(validateTemplateStatementSyntax('for', 'for item in items')).toEqual({ valid: true });
  });

  it('rejects malformed for statements with whitespace-control markers', () => {
    expect(validateTemplateStatementSyntax('for', 'for item in -')).toEqual({
      valid: false,
      message: 'Invalid for statement: expected "for <name> in <expression>"',
      suggestion: 'Use `{% for item in items %}`',
    });
  });

  it('accepts valid set statements', () => {
    expect(validateTemplateStatementSyntax('set', 'set title = page.title')).toEqual({
      valid: true,
    });
  });

  it('rejects malformed default statements', () => {
    expect(validateTemplateStatementSyntax('default', 'default extra')).toEqual({
      valid: false,
      message: 'Invalid default statement: expected "default" with no arguments',
      suggestion: 'Use `{% default %}`',
    });
  });

  it('treats unknown statement tags as valid for syntax-shape purposes', () => {
    expect(validateTemplateStatementSyntax('include', 'include "partial"')).toEqual({
      valid: true,
    });
  });

  it('parses for-header alias and iterable offsets from core', () => {
    expect(parseTemplateForHeader('- for item in users[activeIndex + 1]')).toEqual({
      aliasName: 'item',
      aliasStart: 6,
      aliasEnd: 10,
      iterableExpression: 'users[activeIndex + 1]',
      iterableStart: 14,
    });
  });

  it('returns null for malformed for-headers', () => {
    expect(parseTemplateForHeader('for item %')).toBeNull();
  });

  it('extracts generic statement expressions with start offsets', () => {
    expect(extractTemplateStatementExpression('if user.name | upper')).toEqual({
      expression: 'user.name | upper',
      startOffset: 3,
    });
  });

  it('extracts for iterable expressions with start offsets', () => {
    expect(extractTemplateStatementExpression('- for item in users')).toEqual({
      expression: 'users',
      startOffset: 14,
    });
  });
});
