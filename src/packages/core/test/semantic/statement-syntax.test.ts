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

  it('rejects for statements with a mismatched leading keyword', () => {
    expect(validateTemplateStatementSyntax('for', 'if item in items')).toEqual({
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

  it('accepts valid if/while/switch/case/default/block statements', () => {
    expect(validateTemplateStatementSyntax('if', 'if user.isAdmin')).toEqual({ valid: true });
    expect(validateTemplateStatementSyntax('while', 'while hasMore')).toEqual({ valid: true });
    expect(validateTemplateStatementSyntax('switch', 'switch status')).toEqual({ valid: true });
    expect(validateTemplateStatementSyntax('case', 'case "active"')).toEqual({ valid: true });
    expect(validateTemplateStatementSyntax('default', 'default')).toEqual({ valid: true });
    expect(validateTemplateStatementSyntax('block', 'block main-content')).toEqual({ valid: true });
  });

  it('rejects invalid if/while/switch/case statements missing expressions', () => {
    expect(validateTemplateStatementSyntax('if', 'if')).toEqual({
      valid: false,
      message: 'Invalid if statement: expected "if <expression>"',
      suggestion: 'Use `{% if condition %}`',
    });

    expect(validateTemplateStatementSyntax('while', 'while')).toEqual({
      valid: false,
      message: 'Invalid while statement: expected "while <expression>"',
      suggestion: 'Use `{% while condition %}`',
    });

    expect(validateTemplateStatementSyntax('switch', 'switch')).toEqual({
      valid: false,
      message: 'Invalid switch statement: expected "switch <expression>"',
      suggestion: 'Use `{% switch value %}`',
    });

    expect(validateTemplateStatementSyntax('case', 'case')).toEqual({
      valid: false,
      message: 'Invalid case statement: expected "case <value>"',
      suggestion: 'Use `{% case value %}`',
    });
  });

  it('rejects invalid block names', () => {
    expect(validateTemplateStatementSyntax('block', 'block 123')).toEqual({
      valid: false,
      message: 'Invalid block statement: expected "block <name>"',
      suggestion: 'Use `{% block content %}`',
    });

    expect(validateTemplateStatementSyntax('block', 'block main content')).toEqual({
      valid: false,
      message: 'Invalid block statement: expected "block <name>"',
      suggestion: 'Use `{% block content %}`',
    });
  });

  it('validates set statement assignment shape', () => {
    expect(validateTemplateStatementSyntax('set', 'set title')).toEqual({ valid: true });

    expect(validateTemplateStatementSyntax('set', 'set')).toEqual({
      valid: false,
      message: 'Invalid set statement: expected "set <name>" or "set <name> = <expression>"',
      suggestion: 'Use `{% set var = value %}` or `{% set var %}`',
    });

    expect(validateTemplateStatementSyntax('set', 'set title value')).toEqual({
      valid: false,
      message: 'Invalid set statement: expected "set <name>" or "set <name> = <expression>"',
      suggestion: 'Use `{% set var = value %}` or `{% set var %}`',
    });

    expect(validateTemplateStatementSyntax('set', 'set title =')).toEqual({
      valid: false,
      message: 'Invalid set statement: expected "set <name>" or "set <name> = <expression>"',
      suggestion: 'Use `{% set var = value %}` or `{% set var %}`',
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

  it('returns null for malformed for-headers with invalid alias names', () => {
    expect(parseTemplateForHeader('for 9item in users')).toBeNull();
  });

  it('parses for-headers without trim markers', () => {
    expect(parseTemplateForHeader('for entry in collection.items')).toEqual({
      aliasName: 'entry',
      aliasStart: 4,
      aliasEnd: 9,
      iterableExpression: 'collection.items',
      iterableStart: 13,
    });
  });

  it('parses for-headers with right-trim markers', () => {
    expect(parseTemplateForHeader('for item in users -')).toEqual({
      aliasName: 'item',
      aliasStart: 4,
      aliasEnd: 8,
      iterableExpression: 'users',
      iterableStart: 12,
    });
  });

  it('extracts generic statement expressions with start offsets', () => {
    expect(extractTemplateStatementExpression('if user.name | upper')).toEqual({
      expression: 'user.name | upper',
      startOffset: 3,
    });

    expect(extractTemplateStatementExpression('if\tuser.name')).toEqual({
      expression: 'user.name',
      startOffset: 3,
    });
  });

  it('extracts for iterable expressions with start offsets', () => {
    expect(extractTemplateStatementExpression('- for item in users')).toEqual({
      expression: 'users',
      startOffset: 14,
    });
  });

  it('returns null for malformed or empty statement expressions', () => {
    expect(extractTemplateStatementExpression('')).toBeNull();
    expect(extractTemplateStatementExpression('include')).toBeNull();
    expect(extractTemplateStatementExpression('for item %')).toBeNull();
    expect(extractTemplateStatementExpression('for item in -')).toBeNull();
    expect(extractTemplateStatementExpression('9if user')).toBeNull();
  });
});
