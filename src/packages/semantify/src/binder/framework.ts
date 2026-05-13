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

function mapBinding(binding: import('@templjs/core').TemplateBinding): ScopeBinding {
  const scopeRange = normalizeRange(binding.scopeStartOffset, binding.scopeEndOffset);
  const declarationRange =
    binding.declarationStartOffset !== undefined && binding.declarationEndOffset !== undefined
      ? normalizeRange(binding.declarationStartOffset, binding.declarationEndOffset)
      : undefined;

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
  const leftOffset = (left.metadata?.startOffset as number | undefined) ?? Number.MAX_SAFE_INTEGER;
  const rightOffset =
    (right.metadata?.startOffset as number | undefined) ?? Number.MAX_SAFE_INTEGER;
  return leftOffset - rightOffset;
}

function applyPrefix(items: CandidateItem[], prefix?: string): CandidateItem[] {
  const normalized = prefix?.trim().toLowerCase();
  if (!normalized) {
    return items;
  }

  return items.filter((item) => item.label.toLowerCase().startsWith(normalized));
}

class CoreBackedSemantifyServices implements SemantifyServices {
  resolveContext(input: SemanticContextResolverInput): SemanticContext {
    const allBindings = extractTemplateBindings(input.text, {
      delimiters: toCoreDelimiters(input.delimiters),
    });
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
        range: binding.declarationRange ?? binding.scopeRange,
        metadata: binding.metadata,
      }))
      .sort((left, right) => left.range.startOffset - right.range.startOffset);
  }

  planCandidates(intent: QueryIntent, input: SemanticContextResolverInput): CandidateItem[] {
    const context = this.resolveContext(input);

    if (intent.type === 'filterCandidates') {
      const filterItems = getBuiltinFilterNames().map((name) => ({
        label: name,
        kind: 'filter',
      }));
      return applyPrefix(filterItems, intent.typedPrefix);
    }

    const symbolItems = context.bindings.map((binding) => ({
      label: binding.name,
      kind: 'variable',
      detail:
        binding.metadata?.bindingKind === 'set-variable'
          ? 'local template variable'
          : 'local loop alias',
      metadata: {
        startOffset: binding.scopeRange.startOffset,
      },
    }));

    return applyPrefix(symbolItems, intent.typedPrefix).sort(byStartOffset);
  }
}

export function createSemantifyServices(): SemantifyServices {
  return new CoreBackedSemantifyServices();
}

export const semantifyTesting = {
  normalizeRange,
  toCoreDelimiters,
};
