import { describe, expect, it } from 'vitest';
import {
  extractExpressionFilterReferences,
  extractExpressionVariableReferences,
} from '../../src/semantic/expression-references.js';

describe('expression-references', () => {
  it('extracts variable references from ternary and unary expressions', () => {
    const refs = extractExpressionVariableReferences(
      '!user.active ? user.name : fallback.name'
    ).map((ref) => ref.path);

    expect(refs).toEqual(['user.active', 'user.name', 'fallback.name']);
  });

  it('extracts filter references in source order', () => {
    const refs = extractExpressionFilterReferences('user.name | lower | truncate(10)').map(
      (ref) => ref.name
    );

    expect(refs).toEqual(['lower', 'truncate']);
  });

  it('tracks repeated variable references at their original offsets', () => {
    const refs = extractExpressionVariableReferences('user.name == user.name');

    expect(refs).toEqual([
      { path: 'user.name', start: 0, end: 'user.name'.length },
      {
        path: 'user.name',
        start: 'user.name == '.length,
        end: 'user.name == '.length + 'user.name'.length,
      },
    ]);
  });

  it('tracks quoted string-index references at original offsets', () => {
    const expression = 'user["full name"] && user["full name"]';
    const refs = extractExpressionVariableReferences(expression);

    const firstPath = 'user["full name"]';
    const secondStart = firstPath.length + ' && '.length;
    expect(refs).toEqual([
      { path: 'user[full name]', start: 0, end: firstPath.length },
      {
        path: 'user[full name]',
        start: secondStart,
        end: secondStart + firstPath.length,
      },
    ]);
  });

  it('does not match variable-like paths inside string literals', () => {
    const refs = extractExpressionVariableReferences('"user.name" == user.name');

    expect(refs).toEqual([
      {
        path: 'user.name',
        start: '"user.name" == '.length,
        end: '"user.name" == '.length + 'user.name'.length,
      },
    ]);
  });

  it('returns empty references when the expression cannot be parsed', () => {
    expect(extractExpressionVariableReferences('user.')).toEqual([]);
    expect(extractExpressionFilterReferences('user.name |')).toEqual([]);
  });
});
