import {
  DEFAULT_DELIMITERS,
  extractTemplateBindings,
  getTemplateBindingsAtOffset,
  getBuiltinFilterNames,
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
