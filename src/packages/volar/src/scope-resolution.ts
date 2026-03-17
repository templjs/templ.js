import { resolveDelimiters, type DelimiterConfig } from './template-delimiters.js';
import { extractExpressionVariableReferences } from './expression-analysis.js';
import { extractTemplateScopeBindings } from '@templjs/core';
import type { LexerOptions } from '@templjs/core';

export interface ForScope {
  alias: string;
  iterablePath: string;
  aliasStart: number;
  aliasEnd: number;
  bodyStart: number;
  bodyEnd: number;
}

function volarDelimitersToLexerOptions(
  delimiters?: Partial<DelimiterConfig>
): LexerOptions | undefined {
  if (!delimiters) return undefined;
  const resolved = resolveDelimiters(delimiters);
  return {
    delimiters: {
      statement_start: resolved.statementStart,
      statement_end: resolved.statementEnd,
      expression_start: resolved.expressionStart,
      expression_end: resolved.expressionEnd,
      comment_start: resolved.commentStart,
      comment_end: resolved.commentEnd,
    },
  };
}

export function buildForScopesInText(
  text: string,
  delimiters?: Partial<DelimiterConfig>
): ForScope[] {
  const lexerOptions = volarDelimitersToLexerOptions(delimiters);
  return extractTemplateScopeBindings(text, lexerOptions).map((binding) => ({
    alias: binding.alias,
    iterablePath: binding.iterablePath,
    aliasStart: binding.declarationStartOffset ?? 0,
    aliasEnd: binding.declarationEndOffset ?? 0,
    bodyStart: binding.scopeStartOffset,
    bodyEnd: binding.scopeEndOffset,
  }));
}

function getMatchingScopesAtOffset(offset: number, scopes: ForScope[]): ForScope[] {
  return scopes
    .filter((scope) => offset >= scope.bodyStart && offset < scope.bodyEnd)
    .sort((left, right) => right.bodyStart - left.bodyStart);
}

function getIterableBasePath(iterableExpression: string): string {
  const refs = extractExpressionVariableReferences(iterableExpression);
  return refs[0]?.path ?? iterableExpression;
}

export function resolveScopedPath(path: string, offset: number, scopes: ForScope[]): string {
  const matchingScopes = getMatchingScopesAtOffset(offset, scopes);
  if (matchingScopes.length === 0) {
    return path;
  }

  // Iteratively resolve through matching scopes (innermost first).
  // After each substitution, continue resolving the new path against the
  // remaining outer scopes so that aliases embedded in iterablePath are
  // also fully expanded (e.g. nested loops where the inner iterablePath
  // still references an outer alias).
  let current = path;
  let remaining = matchingScopes;

  while (remaining.length > 0) {
    let matched = false;
    for (let i = 0; i < remaining.length; i++) {
      const scope = remaining[i];
      if (
        current === scope.alias ||
        current.startsWith(`${scope.alias}.`) ||
        current.startsWith(`${scope.alias}[`)
      ) {
        const suffix = current.slice(scope.alias.length);
        const iterableBasePath = getIterableBasePath(scope.iterablePath);
        const iterableBase = iterableBasePath.endsWith(']')
          ? iterableBasePath
          : `${iterableBasePath}[0]`;
        current = `${iterableBase}${suffix}`;
        remaining = remaining.slice(i + 1);
        matched = true;
        break;
      }
    }
    if (!matched) {
      break;
    }
  }

  return current;
}

export function resolveScopedPathInText(
  text: string,
  path: string,
  offset: number,
  delimiters?: Partial<DelimiterConfig>,
  precomputedScopes?: ForScope[]
): string {
  const scopes = precomputedScopes ?? buildForScopesInText(text, delimiters);
  return resolveScopedPath(path, offset, scopes);
}

export function findLocalAliasDefinitionInText(
  text: string,
  path: string,
  offset: number,
  delimiters?: Partial<DelimiterConfig>,
  precomputedScopes?: ForScope[]
): { start: number; end: number } | null {
  const scopes = precomputedScopes ?? buildForScopesInText(text, delimiters);
  const matchingScopes = getMatchingScopesAtOffset(offset, scopes);

  for (const scope of matchingScopes) {
    if (
      path === scope.alias ||
      path.startsWith(`${scope.alias}.`) ||
      path.startsWith(`${scope.alias}[`)
    ) {
      return {
        start: scope.aliasStart,
        end: scope.aliasEnd,
      };
    }
  }

  return null;
}
