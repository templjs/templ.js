import { resolveDelimiters, type DelimiterConfig } from './template-delimiters.js';
import { extractExpressionVariableReferences } from './expression-analysis.js';
import { extractTemplateBindings } from '@templjs/core';
import type { LexerOptions } from '@templjs/core';
import type { TemplateBinding, TemplateBindingKind } from '@templjs/core';

export interface ForScope {
  alias: string;
  iterablePath: string;
  /**
   * Full iterable expression text from the parser-backed analysis.
   * This is the authoritative source for the full expression (e.g.
   * `users[activeIndex + 1]`), whereas `iterablePath` holds only the
   * normalised dot-path root (e.g. `users`).
   */
  iterableExpression?: string;
  aliasStart?: number;
  aliasEnd?: number;
  bodyStart: number;
  bodyEnd: number;
}

export interface InScopeTemplateBinding {
  name: string;
  kind: TemplateBindingKind;
  sourceExpression?: string;
  inferredPaths?: string[];
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

function getTemplateBindingsForScopeResolution(
  text: string,
  lexerOptions?: LexerOptions,
  delimiters?: Partial<DelimiterConfig>
): TemplateBinding[] {
  const bindings = extractTemplateBindings(text, lexerOptions);
  if (bindings.length > 0) {
    return bindings;
  }

  const resolvedDelimiters = resolveDelimiters(delimiters);
  const lastExpressionStart = text.lastIndexOf(resolvedDelimiters.expressionStart);
  if (lastExpressionStart === -1) {
    return bindings;
  }

  const lastExpressionEnd = text.lastIndexOf(resolvedDelimiters.expressionEnd);
  if (lastExpressionStart <= lastExpressionEnd) {
    return bindings;
  }

  const repairedText = `${text}${resolvedDelimiters.expressionEnd}`;
  const repairedBindings = extractTemplateBindings(repairedText, lexerOptions);
  if (repairedBindings.length === 0) {
    return bindings;
  }

  const originalLength = text.length;
  return repairedBindings.map((binding) => ({
    ...binding,
    scopeEndOffset: Math.min(binding.scopeEndOffset, originalLength),
  }));
}

export function buildForScopesInText(
  text: string,
  delimiters?: Partial<DelimiterConfig>
): ForScope[] {
  const lexerOptions = volarDelimitersToLexerOptions(delimiters);
  return getTemplateBindingsForScopeResolution(text, lexerOptions, delimiters)
    .filter((binding) => binding.kind === 'for-alias' || binding.kind === 'for-value-alias')
    .filter((binding) => Boolean(binding.sourcePath))
    .map((binding) => ({
      alias: binding.name,
      iterablePath: binding.sourcePath!,
      iterableExpression: binding.sourceExpression,
      aliasStart: binding.declarationStartOffset,
      aliasEnd: binding.declarationEndOffset,
      bodyStart: binding.scopeStartOffset,
      bodyEnd: binding.scopeEndOffset,
    }));
}

export function getInScopeTemplateBindings(
  text: string,
  offset: number,
  delimiters?: Partial<DelimiterConfig>
): InScopeTemplateBinding[] {
  const lexerOptions = volarDelimitersToLexerOptions(delimiters);
  const bindings = getTemplateBindingsForScopeResolution(text, lexerOptions, delimiters)
    .filter((binding) => offset >= binding.scopeStartOffset && offset < binding.scopeEndOffset)
    .sort((left, right) => right.scopeStartOffset - left.scopeStartOffset);

  const unique = new Map<string, InScopeTemplateBinding>();
  for (const binding of bindings) {
    if (
      binding.kind !== 'for-alias' &&
      binding.kind !== 'for-value-alias' &&
      binding.kind !== 'set-variable'
    ) {
      continue;
    }

    if (unique.has(binding.name)) {
      continue;
    }

    unique.set(binding.name, {
      name: binding.name,
      kind: binding.kind,
      sourceExpression: binding.sourceExpression,
      inferredPaths: binding.inferredPaths,
    });
  }

  return [...unique.values()];
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

function matchesAliasPath(path: string, alias: string): boolean {
  return path === alias || path.startsWith(`${alias}.`) || path.startsWith(`${alias}[`);
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
      if (matchesAliasPath(current, scope.alias)) {
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

function splitPathByDot(path: string): string[] {
  return path
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const bracketIndex = segment.indexOf('[');
      return bracketIndex === -1 ? segment : segment.slice(0, bracketIndex);
    })
    .filter((segment) => segment.length > 0);
}

/* c8 ignore start */
function inferObjectMembersFromBinding(
  binding: InScopeTemplateBinding,
  memberPath: string[]
): string[] {
  const inferredPaths = binding.inferredPaths;
  if (!inferredPaths || inferredPaths.length === 0) {
    return [];
  }

  const prefix = memberPath.join('.');
  const childSegments = new Set<string>();

  for (const path of inferredPaths) {
    if (!path) {
      continue;
    }

    if (!prefix) {
      const [segment] = path.split('.');
      if (segment) {
        childSegments.add(segment);
      }
      continue;
    }

    if (!path.startsWith(`${prefix}.`)) {
      continue;
    }

    const remainder = path.slice(prefix.length + 1);
    const [segment] = remainder.split('.');
    if (segment) {
      childSegments.add(segment);
    }
  }

  return [...childSegments].sort((left, right) => left.localeCompare(right));
}

export function getInferredLocalPropertyCompletions(
  text: string,
  offset: number,
  basePath: string,
  delimiters?: Partial<DelimiterConfig>
): string[] {
  const segments = splitPathByDot(basePath);
  if (segments.length === 0) {
    return [];
  }

  const [root, ...memberPath] = segments;
  const bindings = getInScopeTemplateBindings(text, offset, delimiters);
  const binding = bindings.find(
    (entry) =>
      entry.name === root &&
      (entry.kind === 'set-variable' ||
        ((entry.kind === 'for-alias' || entry.kind === 'for-value-alias') &&
          Boolean(entry.inferredPaths?.length)))
  );
  if (!binding) {
    return [];
  }

  return inferObjectMembersFromBinding(binding, memberPath);
}
/* c8 ignore stop */
