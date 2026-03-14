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

function isInsideBlocks(offset: number, blocks: BlockMatch[]): boolean {
  return blocks.some((block) => offset >= block.start && offset < block.end);
}

export function buildForScopesInText(
  text: string,
  delimiters?: Partial<DelimiterConfig>
): ForScope[] {
  const resolvedDelimiters = resolveDelimiters(delimiters);
  const statementBlocks = extractBlocks(
    text,
    resolvedDelimiters.statementStart,
    resolvedDelimiters.statementEnd
  );
  const commentBlocks = extractBlocks(
    text,
    resolvedDelimiters.commentStart,
    resolvedDelimiters.commentEnd
  );

  const scopes: ForScope[] = [];
  const activeScopes: Array<Omit<ForScope, 'bodyEnd'>> = [];

  for (const block of statementBlocks) {
    if (isInsideBlocks(block.start, commentBlocks)) {
      continue;
    }

    const rawInner = block.content.slice(
      resolvedDelimiters.statementStart.length,
      block.content.length - resolvedDelimiters.statementEnd.length
    );
    const trimmed = rawInner.trim();
    const tag = trimmed.split(/\s+/)[0] ?? '';

    if (tag === 'for') {
      const match = rawInner.match(/^\s*for\s+([A-Za-z_][\w]*)\s+in\s+([^\s%}]+)/);
      if (match) {
        const alias = match[1];
        const aliasIndexInInner = rawInner.indexOf(alias, match.index ?? 0);
        const aliasStart =
          block.start + resolvedDelimiters.statementStart.length + Math.max(0, aliasIndexInInner);

        activeScopes.push({
          alias,
          iterablePath: match[2],
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

  for (const scope of matchingScopes) {
    if (
      path === scope.alias ||
      path.startsWith(`${scope.alias}.`) ||
      path.startsWith(`${scope.alias}[`)
    ) {
      const iterableBase = scope.iterablePath.endsWith(']')
        ? scope.iterablePath
        : `${scope.iterablePath}[0]`;
      return `${iterableBase}${path.slice(scope.alias.length)}`;
    }
  }

  return path;
}

export function resolveScopedPathInText(
  text: string,
  path: string,
  offset: number,
  delimiters?: Partial<DelimiterConfig>
): string {
  const scopes = buildForScopesInText(text, delimiters);
  return resolveScopedPath(path, offset, scopes);
}

export function findLocalAliasDefinitionInText(
  text: string,
  path: string,
  offset: number,
  delimiters?: Partial<DelimiterConfig>
): { start: number; end: number } | null {
  const scopes = buildForScopesInText(text, delimiters);
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
