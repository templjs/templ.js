import {
  DEFAULT_DELIMITERS,
  parse,
  tokenize,
  extractTemplateBindings,
  getTemplateBindingsAtOffset,
  getBuiltinFilterNames,
  resolveSemanticZone,
  type DelimiterConfig,
  type ASTNode,
  type ExpressionNode,
  type ExpressionStatementNode,
  type VariableNode,
} from '@templjs/core';
import type {
  CandidateItem,
  BindingTypeLookup,
  DelimiterConfigInput,
  QueryIntent,
  ScopeBinding,
  SemanticContext,
  SemanticContextResolverInput,
  SemanticRegion,
  SemantifyServiceOptions,
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

function isExpressionStatement(node: ASTNode): node is ExpressionStatementNode {
  return node.type === 'expression_statement';
}

function createLookupBinding(name: string, offset: number): ScopeBinding {
  return {
    kind: 'custom',
    name,
    scopeRange: { startOffset: offset, endOffset: offset },
    declarationRange: { startOffset: offset, endOffset: offset },
  };
}

function normalizeTypeLabel(typeLabel: string | undefined): string | undefined {
  if (!typeLabel) {
    return undefined;
  }

  const trimmed = typeLabel.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getArrayElementType(typeLabel: string | undefined): string | undefined {
  const normalized = normalizeTypeLabel(typeLabel);
  if (!normalized) {
    return undefined;
  }

  if (normalized.endsWith('[]')) {
    return normalized.slice(0, -2).trim();
  }

  const genericMatch = normalized.match(/^array<(.+)>$/i);
  if (genericMatch) {
    return genericMatch[1]?.trim();
  }

  if (normalized === 'string') {
    return 'char';
  }

  if (normalized === 'array') {
    return undefined;
  }

  return undefined;
}

function inferExpressionTypeLabel(
  expression: string,
  bindings: import('@templjs/core').TemplateBinding[],
  input: SemanticContextResolverInput,
  lookupType: BindingTypeLookup | undefined,
  scopeOffset: number,
  cache: Map<string, string | undefined>,
  visiting: Set<string>
): string | undefined {
  const parseResult = parse(tokenize(`{{ ${expression} }}`));
  const expressionStatement = parseResult.ast?.children.find(isExpressionStatement);
  const node = expressionStatement?.value;
  if (!node) {
    return normalizeTypeLabel(
      lookupType?.({
        expression,
        binding: createLookupBinding(expression, scopeOffset),
        context: input,
      })
    );
  }

  const resolveLocalBinding = (name: string): import('@templjs/core').TemplateBinding | undefined =>
    getTemplateBindingsAtOffset(bindings, scopeOffset).find((binding) => binding.name === name);

  const serializeVariablePathSuffix = (node: VariableNode): string | undefined => {
    if (node.path.length === 0) {
      return '';
    }

    let suffix = '';
    for (const segment of node.path) {
      if (segment.type === 'property') {
        if (typeof segment.value !== 'string' || segment.value.length === 0) {
          return undefined;
        }
        suffix += `.${segment.value}`;
        continue;
      }

      if (segment.type === 'index') {
        if (typeof segment.value === 'string') {
          suffix += `[${segment.value}]`;
          continue;
        }

        if (segment.value.type === 'literal') {
          suffix += `[${String(segment.value.value)}]`;
          continue;
        }

        return undefined;
      }
    }

    return suffix;
  };

  const inferNode = (currentNode: ExpressionNode): string | undefined => {
    if (currentNode.type === 'literal') {
      return currentNode.valueType;
    }

    if (currentNode.type === 'array') {
      const elementTypes = currentNode.elements.map((element) => inferNode(element));
      const commonType = elementTypes.find(
        (typeLabel) => typeLabel && elementTypes.every((candidate) => candidate === typeLabel)
      );
      return `array<${normalizeTypeLabel(commonType) ?? 'unknown'}>`;
    }

    if (currentNode.type === 'object') {
      return 'object';
    }

    if (currentNode.type === 'paren') {
      return inferNode(currentNode.value);
    }

    if (currentNode.type === 'ternary') {
      const trueType = inferNode(currentNode.trueValue);
      const falseType = inferNode(currentNode.falseValue);
      return trueType && trueType === falseType ? trueType : undefined;
    }

    if (currentNode.type === 'unary_op') {
      return inferNode(currentNode.operand);
    }

    if (currentNode.type === 'filter') {
      return inferNode(currentNode.source);
    }

    if (currentNode.type === 'variable') {
      const localBinding = resolveLocalBinding(currentNode.name);
      const rootType =
        (localBinding
          ? resolveBindingTypeLabel(localBinding, bindings, input, lookupType, cache, visiting)
          : undefined) ??
        normalizeTypeLabel(
          lookupType?.({
            expression: currentNode.name,
            binding: createLookupBinding(currentNode.name, scopeOffset),
            context: input,
          })
        );
      if (rootType) {
        if (currentNode.path.length === 0) {
          return rootType;
        }

        if (localBinding?.sourcePath) {
          const suffix = serializeVariablePathSuffix(currentNode);
          if (suffix !== undefined) {
            const sourceBase =
              localBinding.kind === 'for-alias' || localBinding.kind === 'for-value-alias'
                ? `${localBinding.sourcePath}[0]`
                : localBinding.sourcePath;
            const resolvedPathType = normalizeTypeLabel(
              lookupType?.({
                expression: `${sourceBase}${suffix}`,
                binding: mapBinding(localBinding),
                context: input,
                resolvedType: rootType,
              })
            );
            if (resolvedPathType) {
              return resolvedPathType;
            }
          }
        }

        const pathType = normalizeTypeLabel(
          lookupType?.({
            expression,
            binding: createLookupBinding(expression, scopeOffset),
            context: input,
            resolvedType: rootType,
          })
        );
        if (pathType) {
          return pathType;
        }

        const indexType = currentNode.path.some((segment) => segment.type === 'index')
          ? getArrayElementType(rootType)
          : undefined;
        if (indexType) {
          return indexType;
        }

        return undefined;
      }

      if (currentNode.path.length > 0) {
        const pathType = normalizeTypeLabel(
          lookupType?.({
            expression,
            binding: createLookupBinding(expression, scopeOffset),
            context: input,
          })
        );
        if (pathType) {
          return pathType;
        }
      }
    }

    return normalizeTypeLabel(
      lookupType?.({
        expression,
        binding: createLookupBinding(expression, scopeOffset),
        context: input,
      })
    );
  };

  return inferNode(node);
}

function resolveBindingTypeLabel(
  binding: import('@templjs/core').TemplateBinding,
  bindings: import('@templjs/core').TemplateBinding[],
  input: SemanticContextResolverInput,
  lookupType: BindingTypeLookup | undefined,
  cache: Map<string, string | undefined>,
  visiting: Set<string>
): string | undefined {
  const bindingKey = `${binding.name}:${binding.declarationStartOffset ?? binding.scopeStartOffset}:${
    binding.declarationEndOffset ?? binding.scopeEndOffset
  }`;
  if (cache.has(bindingKey)) {
    return cache.get(bindingKey);
  }

  if (visiting.has(bindingKey)) {
    return undefined;
  }

  visiting.add(bindingKey);

  const bindingKind = binding.kind;
  const sourceExpression = binding.sourceExpression?.trim();
  const scopeOffset = binding.declarationStartOffset ?? binding.scopeStartOffset;

  let resolvedType = sourceExpression
    ? inferExpressionTypeLabel(
        sourceExpression,
        bindings,
        input,
        lookupType,
        scopeOffset,
        cache,
        visiting
      )
    : undefined;

  if (bindingKind === 'for-alias' || bindingKind === 'for-value-alias') {
    const elementType = getArrayElementType(resolvedType);
    if (elementType) {
      resolvedType = elementType;
    } else if (resolvedType === 'string') {
      resolvedType = 'char';
    } else {
      resolvedType =
        normalizeTypeLabel(
          lookupType?.({
            expression: `${sourceExpression ?? binding.sourcePath ?? binding.name}[0]`,
            binding: mapBinding(binding),
            context: input,
            resolvedType,
          })
        ) ?? resolvedType;
    }
  }

  if (!resolvedType && lookupType) {
    resolvedType = normalizeTypeLabel(
      lookupType({
        expression: sourceExpression ?? binding.sourcePath ?? binding.name,
        binding: mapBinding(binding),
        context: input,
        resolvedType,
      })
    );
  }

  const normalized = normalizeTypeLabel(resolvedType);
  cache.set(bindingKey, normalized);
  visiting.delete(bindingKey);
  return normalized;
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

class CoreBackedSemantifyServices implements SemantifyServices {
  constructor(private readonly options: SemantifyServiceOptions = {}) {}

  resolveContext(input: SemanticContextResolverInput): SemanticContext {
    const allBindings = extractBindingsWithRecovery(input);
    const inScope = getTemplateBindingsAtOffset(allBindings, input.offset);
    const region = getRegion(input);
    const cache = new Map<string, string | undefined>();
    const visiting = new Set<string>();
    const lookupType = input.typeLookup ?? this.options.typeLookup;

    const typedBindings = inScope.map((binding) => {
      const mapped = mapBinding(binding);
      return {
        ...mapped,
        typeLabel: resolveBindingTypeLabel(
          binding,
          allBindings,
          input,
          lookupType,
          cache,
          visiting
        ),
      };
    });

    return {
      regions: [region],
      activeRegion:
        input.offset >= region.range.startOffset && input.offset <= region.range.endOffset
          ? region
          : undefined,
      bindings: typedBindings,
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

    if (intent.type !== 'symbolCandidates') {
      return [];
    }

    const context = this.resolveContext(input);

    const symbolItems = context.bindings.map((binding) => {
      return {
        label: binding.name,
        kind: 'variable',
        detail: binding.typeLabel,
        metadata: {
          startOffset: binding.scopeRange.startOffset,
        },
      };
    });

    return applyPrefix(symbolItems, intent.typedPrefix).sort(byStartOffset);
  }
}

export function createSemantifyServices(options?: SemantifyServiceOptions): SemantifyServices {
  return new CoreBackedSemantifyServices(options);
}

export const semantifyTesting = {
  mapBinding,
  normalizeRange,
  toCoreDelimiters,
};
