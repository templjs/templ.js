import {
  DEFAULT_DELIMITERS,
  extractExpressionFilterReferences,
  extractExpressionVariableReferences,
  extractTemplateStatementExpression,
  extractTemplateBindings,
  getTemplateBindingsAtOffset,
  getBuiltinFilterNames,
  parseTemplateForHeader,
  resolveSemanticZone,
  type DelimiterConfig,
} from '@templjs/core';
import type {
  CandidateItem,
  DelimiterConfigInput,
  QueryIntent,
  ScopeBinding,
  SemanticContext,
  SemanticContextResolverInput,
  SemanticRegion,
  SemantifyServices,
  SymbolRef,
} from '../model/public-types.js';

function normalizeRange(
  startOffset: number,
  endOffset: number
): { startOffset: number; endOffset: number } {
  return endOffset >= startOffset
    ? { startOffset, endOffset }
    : { startOffset: endOffset, endOffset: startOffset };
}

function toCoreDelimiters(input?: DelimiterConfigInput): DelimiterConfig | undefined {
  if (!input) {
    return undefined;
  }

  const statementStart = input.statementStart ?? DEFAULT_DELIMITERS.statement_start;
  const statementEnd = input.statementEnd ?? DEFAULT_DELIMITERS.statement_end;
  const expressionStart = input.expressionStart ?? DEFAULT_DELIMITERS.expression_start;
  const expressionEnd = input.expressionEnd ?? DEFAULT_DELIMITERS.expression_end;
  const commentStart = input.commentStart ?? DEFAULT_DELIMITERS.comment_start;
  const commentEnd = input.commentEnd ?? DEFAULT_DELIMITERS.comment_end;

  return {
    statement_start: statementStart,
    statement_end: statementEnd,
    statement: [statementStart, statementEnd],
    expression_start: expressionStart,
    expression_end: expressionEnd,
    expression: [expressionStart, expressionEnd],
    comment_start: commentStart,
    comment_end: commentEnd,
    comment: [commentStart, commentEnd],
  };
}

function countOccurrences(text: string, token: string): number {
  if (!token) {
    return 0;
  }

  let count = 0;
  let cursor = 0;
  while (cursor <= text.length - token.length) {
    const next = text.indexOf(token, cursor);
    if (next < 0) {
      break;
    }
    count += 1;
    cursor = next + token.length;
  }

  return count;
}

function getExpressionDelimiters(input?: DelimiterConfigInput): { start: string; end: string } {
  return {
    start: input?.expressionStart ?? DEFAULT_DELIMITERS.expression_start,
    end: input?.expressionEnd ?? DEFAULT_DELIMITERS.expression_end,
  };
}

function repairDanglingExpressionDelimiters(
  text: string,
  delimiters?: DelimiterConfigInput
): string | undefined {
  const expressionDelimiters = getExpressionDelimiters(delimiters);
  const openCount = countOccurrences(text, expressionDelimiters.start);
  const closeCount = countOccurrences(text, expressionDelimiters.end);
  const missingClosers = openCount - closeCount;

  if (missingClosers <= 0) {
    return undefined;
  }

  return `${text}${expressionDelimiters.end.repeat(missingClosers)}`;
}

function extractBindingsWithRecovery(input: SemanticContextResolverInput) {
  const delimiters = toCoreDelimiters(input.delimiters);
  const bindings = extractTemplateBindings(input.text, {
    delimiters,
  });

  if (bindings.length > 0) {
    return bindings;
  }

  const repairedText = repairDanglingExpressionDelimiters(input.text, input.delimiters);
  if (!repairedText) {
    return bindings;
  }

  return extractTemplateBindings(repairedText, {
    delimiters,
  });
}

function mapBinding(binding: import('@templjs/core').TemplateBinding): ScopeBinding {
  const scopeRange = normalizeRange(binding.scopeStartOffset, binding.scopeEndOffset);
  const declarationStartOffset = binding.declarationStartOffset ?? binding.scopeStartOffset;
  const declarationEndOffset = binding.declarationEndOffset ?? binding.scopeEndOffset;
  const declarationRange = normalizeRange(declarationStartOffset, declarationEndOffset);

  return {
    kind: 'local',
    name: binding.name,
    scopeRange,
    declarationRange,
    sourcePath: binding.sourcePath,
    metadata: {
      bindingKind: binding.kind,
      sourceExpression: binding.sourceExpression,
    },
  };
}

function getRegion(input: SemanticContextResolverInput): SemanticRegion {
  const zone = resolveSemanticZone(input.text, input.offset);
  return {
    kind: zone.legacyContextBlock === 'frontmatter' ? 'metadata' : 'plainText',
    range: {
      startOffset: 0,
      endOffset: input.text.length,
    },
    metadata: {
      semanticZoneKind: zone.kind,
      profileId: zone.profileId,
      legacyContextBlock: zone.legacyContextBlock,
    },
  };
}

function byStartOffset(left: CandidateItem, right: CandidateItem): number {
  const leftOffset = (left.metadata as { startOffset: number }).startOffset;
  const rightOffset = (right.metadata as { startOffset: number }).startOffset;
  return leftOffset - rightOffset;
}

function applyPrefix(items: CandidateItem[], prefix?: string): CandidateItem[] {
  const normalized = prefix?.trim().toLowerCase();
  if (!normalized) {
    return items;
  }

  return items.filter((item) => item.label.toLowerCase().startsWith(normalized));
}

function getBindingDetail(bindingKind: unknown): string {
  return bindingKind === 'set-variable' ? 'local template variable' : 'local loop alias';
}

function extractAlias(variablePath: string): string {
  return variablePath.split(/[.[]/, 1)[0] ?? variablePath;
}

function resolveAliasPath(intent: QueryIntent): string {
  const metadata = intent.metadata as { variablePath?: unknown } | undefined;
  if (typeof metadata?.variablePath === 'string') {
    return metadata.variablePath;
  }

  if (typeof intent.basePath === 'string') {
    return intent.basePath;
  }

  if (typeof intent.symbol?.rawPath === 'string') {
    return intent.symbol.rawPath;
  }

  return '';
}

function resolveLocalBindingReference(intent: QueryIntent, refs: SymbolRef[]): SymbolRef | null {
  const variablePath = resolveAliasPath(intent);
  const alias = extractAlias(variablePath);
  if (!alias) {
    return null;
  }

  const isAliasTokenOnly = /^[A-Za-z_][\w]*$/.test(variablePath);
  const exact = refs.find(
    (reference) => reference.kind === 'localBinding' && reference.rawPath === alias
  );
  if (exact) {
    return exact;
  }

  if (!isAliasTokenOnly) {
    return null;
  }

  const prefixMatches = refs.filter(
    (reference) => reference.kind === 'localBinding' && reference.rawPath.startsWith(alias)
  );
  return prefixMatches.length === 1 ? prefixMatches[0] : null;
}

function findEnclosingRange(
  text: string,
  offset: number,
  start: string,
  end: string,
  allowOpen: boolean
): { start: number; end: number } | null {
  const startIndex = text.lastIndexOf(start, offset);
  if (startIndex === -1) {
    return null;
  }

  const endIndex = text.indexOf(end, startIndex + start.length);
  if (endIndex === -1) {
    return allowOpen ? { start: startIndex, end: text.length } : null;
  }

  const rangeEnd = endIndex + end.length;
  if (offset > rangeEnd) {
    return null;
  }

  return { start: startIndex, end: rangeEnd };
}

function findEnclosingRangeNearOffset(
  text: string,
  offset: number,
  start: string,
  end: string,
  allowOpen: boolean
): { start: number; end: number } | null {
  const direct = findEnclosingRange(text, offset, start, end, allowOpen);
  if (direct) {
    return direct;
  }

  if (offset > 0) {
    return findEnclosingRange(text, offset - 1, start, end, allowOpen);
  }

  return null;
}

function normalizeExpression(
  text: string,
  delimiters: { expressionStart: string; expressionEnd: string }
): string {
  const trimmed = text.trim();
  if (
    trimmed.startsWith(delimiters.expressionStart) &&
    trimmed.endsWith(delimiters.expressionEnd)
  ) {
    return trimmed
      .slice(delimiters.expressionStart.length, -delimiters.expressionEnd.length)
      .trim();
  }

  return trimmed;
}

function splitPathSegments(path: string): string[] {
  if (!path) {
    return [];
  }

  const segments: string[] = [];
  let start = 0;
  let bracketDepth = 0;

  for (let index = 0; index < path.length; index += 1) {
    const char = path[index];
    if (char === '[') {
      bracketDepth += 1;
      continue;
    }

    if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    if (char === '.' && bracketDepth === 0) {
      segments.push(path.slice(start, index));
      start = index + 1;
    }
  }

  segments.push(path.slice(start));

  return segments.filter((segment) => segment.length > 0);
}

function resolveVariableReferenceAtOffset(
  expression: string,
  offsetInExpression: number,
  bindings: ScopeBinding[],
  options?: { preferRootAliasHover?: boolean }
): SymbolRef | null {
  const refs = extractExpressionVariableReferences(expression);
  const activeRef = refs.find(
    (reference) => offsetInExpression >= reference.start && offsetInExpression < reference.end
  );
  if (!activeRef) {
    return null;
  }

  const segments = splitPathSegments(activeRef.path);
  if (segments.length === 0) {
    return null;
  }

  let relativeOffset = Math.max(
    0,
    Math.min(offsetInExpression - activeRef.start, Math.max(0, activeRef.path.length - 1))
  );
  if (activeRef.path[relativeOffset] === '.' && relativeOffset > 0) {
    relativeOffset -= 1;
  }

  let cursor = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!;
    const segmentStart = cursor;
    const segmentEnd = segmentStart + segment.length;
    if (relativeOffset >= segmentStart && relativeOffset < segmentEnd) {
      const alias = segments[0]!;
      const binding = bindings.find((entry) => entry.name === alias);
      const isTokenOnlyPath = segments.length === 1;
      const prefersRootHover = options?.preferRootAliasHover === true && index === 0;
      const shouldUseLocalBinding = !!binding && (isTokenOnlyPath || prefersRootHover);
      const kind = shouldUseLocalBinding ? 'localBinding' : 'schemaPath';
      const schemaPath = prefersRootHover ? alias : activeRef.path;
      return {
        kind,
        rawPath: kind === 'localBinding' ? alias : schemaPath,
        resolvedPath: kind === 'localBinding' ? binding?.sourcePath : undefined,
        rootIdentifier: alias,
        range: {
          startOffset: activeRef.start + segmentStart,
          endOffset: activeRef.start + segmentEnd,
        },
        metadata:
          kind === 'localBinding'
            ? {
                ...(binding?.metadata ?? {}),
                sourcePath: binding?.sourcePath,
                hoverDetail: prefersRootHover ? 'local template variable' : undefined,
              }
            : {
                fullPath: activeRef.path,
              },
      };
    }

    cursor = segmentEnd + 1;
  }

  return {
    kind: 'schemaPath',
    rawPath: activeRef.path,
    rootIdentifier: segments[0],
    range: {
      startOffset: activeRef.start,
      endOffset: activeRef.end,
    },
    metadata: {
      fullPath: activeRef.path,
    },
  };
}

function resolveFilterReferenceAtOffset(
  expression: string,
  offsetInExpression: number
): SymbolRef | null {
  const refs = extractExpressionFilterReferences(expression);
  const activeRef = refs.find(
    (reference) => offsetInExpression >= reference.start && offsetInExpression < reference.end
  );
  if (!activeRef && refs.length === 1) {
    const ref = refs[0]!;
    if (offsetInExpression >= ref.start && offsetInExpression <= ref.end + 1) {
      return {
        kind: 'filterName',
        rawPath: ref.name,
        rootIdentifier: ref.name,
        range: {
          startOffset: ref.start,
          endOffset: ref.end,
        },
      };
    }
  }

  if (!activeRef) {
    return null;
  }

  return {
    kind: 'filterName',
    rawPath: activeRef.name,
    rootIdentifier: activeRef.name,
    range: {
      startOffset: activeRef.start,
      endOffset: activeRef.end,
    },
  };
}

function resolveExpressionSymbolAtOffset(
  expression: string,
  offsetInExpression: number,
  bindings: ScopeBinding[],
  options?: { preferRootAliasHover?: boolean }
): SymbolRef | null {
  return (
    resolveVariableReferenceAtOffset(expression, offsetInExpression, bindings, options) ??
    resolveFilterReferenceAtOffset(expression, offsetInExpression)
  );
}

function resolveActiveSymbolReference(
  input: SemanticContextResolverInput,
  bindings: ScopeBinding[]
): SymbolRef | null {
  const expressionStart = input.delimiters?.expressionStart ?? DEFAULT_DELIMITERS.expression_start;
  const expressionEnd = input.delimiters?.expressionEnd ?? DEFAULT_DELIMITERS.expression_end;
  const statementStart = input.delimiters?.statementStart ?? DEFAULT_DELIMITERS.statement_start;
  const statementEnd = input.delimiters?.statementEnd ?? DEFAULT_DELIMITERS.statement_end;

  const expressionRange = findEnclosingRangeNearOffset(
    input.text,
    input.offset,
    expressionStart,
    expressionEnd,
    false
  );

  if (expressionRange) {
    const expressionText = input.text.slice(expressionRange.start, expressionRange.end);
    const content = normalizeExpression(expressionText, {
      expressionStart,
      expressionEnd,
    });
    const contentStart = expressionText.indexOf(content);
    const relativeOffset = input.offset - expressionRange.start - contentStart;
    const symbol = resolveExpressionSymbolAtOffset(content, Math.max(0, relativeOffset), bindings);
    if (!symbol) {
      return null;
    }

    return {
      ...symbol,
      range: {
        startOffset: expressionRange.start + contentStart + symbol.range.startOffset,
        endOffset: expressionRange.start + contentStart + symbol.range.endOffset,
      },
    };
  }

  const statementRange = findEnclosingRangeNearOffset(
    input.text,
    input.offset,
    statementStart,
    statementEnd,
    false
  );
  if (!statementRange) {
    return null;
  }

  const rawInner = input.text
    .slice(statementRange.start, statementRange.end)
    .slice(statementStart.length, -statementEnd.length);
  const statementContent = rawInner.trim();
  if (!statementContent) {
    return null;
  }

  const statementOffset =
    statementRange.start +
    statementStart.length +
    (rawInner.indexOf(statementContent) >= 0 ? rawInner.indexOf(statementContent) : 0);
  const cursorInStatement = input.offset - statementOffset;

  const forHeader = parseTemplateForHeader(statementContent);
  if (forHeader) {
    if (cursorInStatement < forHeader.aliasStart) {
      // Cursor is on the "for" keyword — no symbol reference.
      return null;
    }

    if (cursorInStatement >= forHeader.aliasStart && cursorInStatement < forHeader.aliasEnd) {
      const binding = bindings.find((entry) => entry.name === forHeader.aliasName);
      return {
        kind: 'localBinding',
        rawPath: forHeader.aliasName,
        resolvedPath: binding?.sourcePath,
        rootIdentifier: forHeader.aliasName,
        range: {
          startOffset: statementOffset + forHeader.aliasStart,
          endOffset: statementOffset + forHeader.aliasEnd,
        },
        metadata: {
          ...(binding?.metadata ?? {}),
          sourcePath: binding?.sourcePath,
        },
      };
    }

    if (cursorInStatement < forHeader.iterableStart) {
      // Cursor is on the "in" keyword — no symbol reference.
      return null;
    }

    const cursorInIterable = cursorInStatement - forHeader.iterableStart;
    if (cursorInIterable >= 0) {
      const symbol = resolveExpressionSymbolAtOffset(
        forHeader.iterableExpression,
        Math.max(0, cursorInIterable),
        bindings,
        { preferRootAliasHover: true }
      );
      if (symbol) {
        return {
          ...symbol,
          range: {
            startOffset: statementOffset + forHeader.iterableStart + symbol.range.startOffset,
            endOffset: statementOffset + forHeader.iterableStart + symbol.range.endOffset,
          },
        };
      }
    }
    return null;
  }

  const statementExpression = extractTemplateStatementExpression(statementContent);
  if (!statementExpression) {
    return null;
  }

  const relativeOffset = input.offset - statementOffset - statementExpression.startOffset;
  if (relativeOffset < 0) {
    // Cursor is on a keyword before the expression (e.g. "if" in "{% if cond %}").
    return null;
  }
  const symbol = resolveExpressionSymbolAtOffset(
    statementExpression.expression,
    Math.max(0, relativeOffset),
    bindings
  );
  if (!symbol) {
    return null;
  }

  return {
    ...symbol,
    range: {
      startOffset: statementOffset + statementExpression.startOffset + symbol.range.startOffset,
      endOffset: statementOffset + statementExpression.startOffset + symbol.range.endOffset,
    },
  };
}

class CoreBackedSemantifyServices implements SemantifyServices {
  resolveContext(input: SemanticContextResolverInput): SemanticContext {
    const allBindings = extractBindingsWithRecovery(input);
    const inScope = getTemplateBindingsAtOffset(allBindings, input.offset).map(mapBinding);
    const region = getRegion(input);

    return {
      regions: [region],
      activeRegion:
        input.offset >= region.range.startOffset && input.offset <= region.range.endOffset
          ? region
          : undefined,
      bindings: inScope,
    };
  }

  resolveReferences(input: SemanticContextResolverInput): SymbolRef[] {
    const context = this.resolveContext(input);
    return context.bindings
      .map((binding) => ({
        kind: 'localBinding' as const,
        rawPath: binding.name,
        resolvedPath: binding.sourcePath,
        rootIdentifier: binding.name,
        range: binding.declarationRange,
        metadata: binding.metadata,
      }))
      .sort((left, right) => left.range.startOffset - right.range.startOffset);
  }

  planCandidates(intent: QueryIntent, input: SemanticContextResolverInput): CandidateItem[] {
    if (intent.type === 'filterCandidates') {
      const filterItems = getBuiltinFilterNames().map((name) => ({
        label: name,
        kind: 'filter',
      }));
      return applyPrefix(filterItems, intent.typedPrefix);
    }

    if (intent.type === 'hoverPayload') {
      const variablePath = resolveAliasPath(intent);
      if (!variablePath) {
        const context = this.resolveContext(input);
        const activeRef = resolveActiveSymbolReference(input, context.bindings);
        if (!activeRef) {
          return [];
        }

        if (activeRef.kind === 'filterName') {
          return [
            {
              label: activeRef.rawPath,
              kind: 'filter',
              metadata: {
                symbolKind: activeRef.kind,
                rawPath: activeRef.rawPath,
                rangeStartOffset: activeRef.range.startOffset,
                rangeEndOffset: activeRef.range.endOffset,
              },
            },
          ];
        }

        if (activeRef.kind === 'localBinding') {
          const bindingKind = (activeRef.metadata as { bindingKind?: unknown } | undefined)
            ?.bindingKind;
          const hoverDetail = (activeRef.metadata as { hoverDetail?: unknown } | undefined)
            ?.hoverDetail;
          return [
            {
              label: activeRef.rawPath,
              kind: 'variable',
              detail: typeof hoverDetail === 'string' ? hoverDetail : getBindingDetail(bindingKind),
              metadata: {
                symbolKind: activeRef.kind,
                rawPath: activeRef.rawPath,
                resolvedPath: activeRef.resolvedPath,
                alias: activeRef.rawPath,
                isAliasTokenOnly: true,
                rangeStartOffset: activeRef.range.startOffset,
                rangeEndOffset: activeRef.range.endOffset,
                declarationStartOffset: activeRef.range.startOffset,
                declarationEndOffset: activeRef.range.endOffset,
              },
            },
          ];
        }

        return [
          {
            label: activeRef.rawPath,
            kind: 'variable',
            metadata: {
              symbolKind: activeRef.kind,
              rawPath: activeRef.rawPath,
              resolvedPath: activeRef.resolvedPath,
              rangeStartOffset: activeRef.range.startOffset,
              rangeEndOffset: activeRef.range.endOffset,
            },
          },
        ];
      }
    }

    if (intent.type === 'definitionTarget' || intent.type === 'hoverPayload') {
      const refs = this.resolveReferences(input);
      const localBinding = resolveLocalBindingReference(intent, refs);
      if (!localBinding) {
        return [];
      }

      const variablePath = resolveAliasPath(intent);
      const alias = extractAlias(variablePath);
      const isAliasTokenOnly = /^[A-Za-z_][\w]*$/.test(variablePath);
      const bindingKind = (localBinding.metadata as { bindingKind?: unknown } | undefined)
        ?.bindingKind;

      return [
        {
          label: localBinding.rawPath,
          kind: 'variable',
          detail: getBindingDetail(bindingKind),
          metadata: {
            alias,
            isAliasTokenOnly,
            declarationStartOffset: localBinding.range.startOffset,
            declarationEndOffset: localBinding.range.endOffset,
          },
        },
      ];
    }

    if (intent.type !== 'symbolCandidates') {
      return [];
    }

    const context = this.resolveContext(input);

    const symbolItems = context.bindings.map((binding) => {
      const bindingKind = (binding.metadata as { bindingKind?: unknown } | undefined)?.bindingKind;
      return {
        label: binding.name,
        kind: 'variable',
        detail: getBindingDetail(bindingKind),
        metadata: {
          startOffset: binding.scopeRange.startOffset,
        },
      };
    });

    return applyPrefix(symbolItems, intent.typedPrefix).sort(byStartOffset);
  }
}

export function createSemantifyServices(): SemantifyServices {
  return new CoreBackedSemantifyServices();
}

export const semantifyTesting = {
  mapBinding,
  normalizeRange,
  toCoreDelimiters,
};
