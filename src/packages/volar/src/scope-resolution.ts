import {
  buildBlockPattern,
  resolveDelimiters,
  type DelimiterConfig,
} from './template-delimiters.js';

export interface ForScope {
  alias: string;
  iterablePath: string;
  aliasStart: number;
  aliasEnd: number;
  bodyStart: number;
  bodyEnd: number;
}

interface BlockMatch {
  start: number;
  end: number;
  content: string;
}

function extractBlocks(text: string, start: string, end: string): BlockMatch[] {
  const blocks: BlockMatch[] = [];
  const regex = buildBlockPattern(start, end);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[0],
    });
  }

  return blocks;
}

export function buildForScopesInText(
  text: string,
  delimiters?: Partial<DelimiterConfig>,
  commentBlocks?: BlockMatch[],
  statementBlocks?: BlockMatch[]
): ForScope[] {
  const resolvedDelimiters = resolveDelimiters(delimiters);
  statementBlocks =
    statementBlocks ??
    extractBlocks(text, resolvedDelimiters.statementStart, resolvedDelimiters.statementEnd);
  commentBlocks =
    commentBlocks ??
    extractBlocks(text, resolvedDelimiters.commentStart, resolvedDelimiters.commentEnd);

  const scopes: ForScope[] = [];
  const activeScopes: Array<Omit<ForScope, 'bodyEnd'>> = [];
  let commentIndex = 0;

  for (const block of statementBlocks) {
    while (commentIndex < commentBlocks.length && commentBlocks[commentIndex].end <= block.start) {
      commentIndex += 1;
    }

    if (
      commentIndex < commentBlocks.length &&
      block.start >= commentBlocks[commentIndex].start &&
      block.start < commentBlocks[commentIndex].end
    ) {
      continue;
    }

    const rawInner = block.content.slice(
      resolvedDelimiters.statementStart.length,
      block.content.length - resolvedDelimiters.statementEnd.length
    );
    const trimmed = rawInner.trim();
    const tag = trimmed.split(/\s+/)[0] ?? '';

    if (tag === 'for') {
      const match = rawInner.match(/^\s*for\s+([A-Za-z_][\w]*)\s+in\s+([\s\S]+)$/);
      if (match) {
        const alias = match[1];
        const iterablePath = match[2].trim();

        if (!iterablePath) {
          continue;
        }

        const aliasIndexInInner = rawInner.indexOf(alias, match.index ?? 0);
        const aliasStart =
          block.start + resolvedDelimiters.statementStart.length + Math.max(0, aliasIndexInInner);

        activeScopes.push({
          alias,
          iterablePath,
          aliasStart,
          aliasEnd: aliasStart + alias.length,
          bodyStart: block.end,
        });
      }
      continue;
    }

    if (tag === 'endfor') {
      const scope = activeScopes.pop();
      if (scope) {
        scopes.push({
          ...scope,
          bodyEnd: block.start,
        });
      }
    }
  }

  for (const scope of activeScopes) {
    scopes.push({
      ...scope,
      bodyEnd: Number.POSITIVE_INFINITY,
    });
  }

  return scopes;
}

function getMatchingScopesAtOffset(offset: number, scopes: ForScope[]): ForScope[] {
  return scopes
    .filter((scope) => offset >= scope.bodyStart && offset < scope.bodyEnd)
    .sort((left, right) => right.bodyStart - left.bodyStart);
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
        const iterableBase = scope.iterablePath.endsWith(']')
          ? scope.iterablePath
          : `${scope.iterablePath}[0]`;
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
