import { tokenize } from '../lexer/lexer.js';
import { parse } from '../parser/parser.js';
import type {
  ASTNode,
  ExpressionNode,
  ForNode,
  PathSegment,
  TemplateNode,
} from '../parser/types.js';

export interface TemplateScopeBinding {
  alias: string;
  iterablePath: string;
  scopeStartOffset: number;
  scopeEndOffset: number;
  declarationStartOffset?: number;
  declarationEndOffset?: number;
}

function positionToOffset(text: string, line: number, column: number): number {
  if (line <= 1) {
    return Math.max(0, column);
  }

  let currentLine = 1;
  let currentOffset = 0;

  while (currentLine < line && currentOffset < text.length) {
    const newlineIndex = text.indexOf('\n', currentOffset);
    if (newlineIndex === -1) {
      return text.length;
    }

    currentOffset = newlineIndex + 1;
    currentLine += 1;
  }

  return Math.min(text.length, currentOffset + Math.max(0, column));
}

function pathSegmentToString(segment: PathSegment): string {
  if (segment.type === 'property') {
    return `.${String(segment.value)}`;
  }

  if (typeof segment.value === 'string') {
    return `[${segment.value}]`;
  }

  if (segment.value.type === 'literal') {
    return `[${String(segment.value.value)}]`;
  }

  return '[0]';
}

function expressionToPath(node: ExpressionNode): string | null {
  switch (node.type) {
    case 'variable':
      return `${node.name}${node.path.map((segment) => pathSegmentToString(segment)).join('')}`;
    case 'filter':
      return expressionToPath(node.source);
    case 'paren':
      return expressionToPath(node.value);
    default:
      return null;
  }
}

function getDeclarationOffsets(
  template: string,
  node: ForNode
): { start: number; end: number } | undefined {
  const nodeStart = positionToOffset(template, node.start.line, node.start.column);
  const openingTagEnd = template.indexOf('%}', nodeStart);
  if (openingTagEnd === -1) {
    return undefined;
  }

  const openingTag = template.slice(nodeStart, openingTagEnd + 2);
  const match = openingTag.match(/\bfor\s+([A-Za-z_][\w]*)\s+in\b/);
  if (!match || typeof match.index !== 'number') {
    return undefined;
  }

  const alias = match[1];
  const aliasStart = openingTag.indexOf(alias, match.index);
  if (aliasStart === -1) {
    return undefined;
  }

  return {
    start: nodeStart + aliasStart,
    end: nodeStart + aliasStart + alias.length,
  };
}

function collectBindings(template: string, node: ASTNode, bindings: TemplateScopeBinding[]): void {
  switch (node.type) {
    case 'template':
      for (const child of node.children) {
        collectBindings(template, child, bindings);
      }
      return;
    case 'for': {
      const iterablePath = expressionToPath(node.iterable);
      if (iterablePath) {
        const declaration = getDeclarationOffsets(template, node);
        const scopeStartOffset =
          node.body.length > 0
            ? positionToOffset(template, node.body[0].start.line, node.body[0].start.column)
            : (declaration?.end ?? positionToOffset(template, node.start.line, node.start.column));

        bindings.push({
          alias: node.iterator,
          iterablePath,
          scopeStartOffset,
          scopeEndOffset: positionToOffset(template, node.end.line, node.end.column),
          declarationStartOffset: declaration?.start,
          declarationEndOffset: declaration?.end,
        });
      }

      for (const child of node.body) {
        collectBindings(template, child, bindings);
      }
      return;
    }
    case 'if':
      for (const child of node.body) {
        collectBindings(template, child, bindings);
      }
      for (const child of node.elseBody ?? []) {
        collectBindings(template, child, bindings);
      }
      return;
    case 'block':
      for (const child of node.body) {
        collectBindings(template, child, bindings);
      }
      return;
    default:
      return;
  }
}

export function extractTemplateScopeBindings(template: string): TemplateScopeBinding[] {
  try {
    const parseResult = parse(tokenize(template));
    const ast = parseResult.ast as TemplateNode | null;
    if (!ast) {
      return [];
    }

    const bindings: TemplateScopeBinding[] = [];
    collectBindings(template, ast, bindings);
    return bindings.sort((left, right) => left.scopeStartOffset - right.scopeStartOffset);
  } catch {
    return [];
  }
}
