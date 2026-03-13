import { parse, tokenize } from '@templjs/core';
import type { ExpressionNode, ASTNode, PathSegment } from '@templjs/core';

export interface ExpressionVariableReference {
  path: string;
  start: number;
  end: number;
}

export interface ExpressionFilterReference {
  name: string;
  start: number;
  end: number;
}

function pathSegmentToString(segment: PathSegment): string {
  if (segment.type === 'property') {
    return `.${String(segment.value)}`;
  }

  if (typeof segment.value === 'string') {
    return `[${segment.value}]`;
  }

  const segmentType = segment.value.type;

  if (segmentType === 'literal') {
    return `[${String(segment.value.value)}]`;
  }

  console.debug('[templjs/volar] dynamic path index segment', {
    segmentValue: segment.value,
    segmentType,
  });

  const serializedValue =
    typeof segment.value === 'object' && segment.value !== null
      ? JSON.stringify(segment.value)
      : String(segment.value);

  return `[${segmentType}:${serializedValue}]`;
}

function variableNodeToPath(node: ExpressionNode): string | null {
  if (node.type !== 'variable') {
    return null;
  }

  return `${node.name}${node.path.map((segment) => pathSegmentToString(segment)).join('')}`;
}

function collectExpressionReferences(
  node: ExpressionNode,
  variables: string[],
  filters: string[]
): void {
  switch (node.type) {
    case 'variable': {
      const path = variableNodeToPath(node);
      if (path) {
        variables.push(path);
      }
      return;
    }
    case 'filter': {
      collectExpressionReferences(node.source, variables, filters);
      for (const filterCall of node.filters) {
        filters.push(filterCall.name);
        for (const arg of filterCall.args) {
          collectExpressionReferences(arg, variables, filters);
        }
      }
      return;
    }
    case 'function_call': {
      if (node.object) {
        collectExpressionReferences(node.object, variables, filters);
      }
      for (const arg of node.args) {
        collectExpressionReferences(arg, variables, filters);
      }
      return;
    }
    case 'binary_op':
      collectExpressionReferences(node.left, variables, filters);
      collectExpressionReferences(node.right, variables, filters);
      return;
    case 'unary_op':
      collectExpressionReferences(node.operand, variables, filters);
      return;
    case 'array':
      for (const element of node.elements) {
        collectExpressionReferences(element, variables, filters);
      }
      return;
    case 'object':
      for (const property of node.properties) {
        collectExpressionReferences(property.value, variables, filters);
      }
      return;
    case 'paren':
      collectExpressionReferences(node.value, variables, filters);
      return;
    case 'ternary':
      collectExpressionReferences(node.condition, variables, filters);
      collectExpressionReferences(node.trueValue, variables, filters);
      collectExpressionReferences(node.falseValue, variables, filters);
      return;
    default:
      return;
  }
}

function parseExpressionNode(content: string): ExpressionNode | null {
  try {
    const tokens = tokenize(`{{ ${content} }}`);
    const parseResult = parse(tokens);
    if (!parseResult.ast) {
      return null;
    }

    const expressionNode = parseResult.ast.children.find(
      (child: ASTNode) => child.type === 'expression_statement'
    );
    if (!expressionNode || expressionNode.type !== 'expression_statement') {
      return null;
    }

    return expressionNode.value;
  } catch {
    return null;
  }
}

function isPathBoundaryChar(char: string | undefined): boolean {
  if (!char) {
    return true;
  }

  return !/[A-Za-z0-9_.$[\]]/.test(char);
}

function findPathOccurrences(content: string, path: string): number[] {
  const indices: number[] = [];
  let from = 0;

  while (from <= content.length - path.length) {
    const index = content.indexOf(path, from);
    if (index === -1) {
      break;
    }

    const before = index > 0 ? content[index - 1] : undefined;
    const after = index + path.length < content.length ? content[index + path.length] : undefined;

    if (isPathBoundaryChar(before) && isPathBoundaryChar(after)) {
      indices.push(index);
    }

    from = index + path.length;
  }

  return indices;
}

function findFilterOccurrences(content: string, name: string): number[] {
  const indices: number[] = [];
  let from = 0;

  while (from < content.length) {
    const pipeIndex = content.indexOf('|', from);
    if (pipeIndex === -1) {
      break;
    }

    let cursor = pipeIndex + 1;
    while (cursor < content.length && /\s/.test(content[cursor])) {
      cursor += 1;
    }

    if (content.slice(cursor, cursor + name.length) === name) {
      const after = content[cursor + name.length];
      if (isPathBoundaryChar(after)) {
        indices.push(cursor);
      }
    }

    from = pipeIndex + 1;
  }

  return indices;
}

function assignVariableReferences(
  content: string,
  pathsInOrder: string[]
): ExpressionVariableReference[] {
  const uniquePaths = Array.from(new Set(pathsInOrder));
  const pathOccurrences = new Map<string, number[]>();
  const pathCursor = new Map<string, number>();

  for (const path of uniquePaths) {
    pathOccurrences.set(path, findPathOccurrences(content, path));
    pathCursor.set(path, 0);
  }

  const refs: ExpressionVariableReference[] = [];
  for (const path of pathsInOrder) {
    const occurrences = pathOccurrences.get(path) ?? [];
    const cursor = pathCursor.get(path) ?? 0;
    if (occurrences.length === 0) {
      continue;
    }

    const index = occurrences[Math.min(cursor, occurrences.length - 1)];
    pathCursor.set(path, cursor + 1);

    refs.push({
      path,
      start: index,
      end: index + path.length,
    });
  }

  return refs;
}

function assignFilterReferences(
  content: string,
  namesInOrder: string[]
): ExpressionFilterReference[] {
  const uniqueNames = Array.from(new Set(namesInOrder));
  const nameOccurrences = new Map<string, number[]>();
  const nameCursor = new Map<string, number>();

  for (const name of uniqueNames) {
    nameOccurrences.set(name, findFilterOccurrences(content, name));
    nameCursor.set(name, 0);
  }

  const refs: ExpressionFilterReference[] = [];
  for (const name of namesInOrder) {
    const occurrences = nameOccurrences.get(name) ?? [];
    const cursor = nameCursor.get(name) ?? 0;
    if (occurrences.length === 0) {
      continue;
    }

    const index = occurrences[Math.min(cursor, occurrences.length - 1)];
    nameCursor.set(name, cursor + 1);

    refs.push({
      name,
      start: index,
      end: index + name.length,
    });
  }

  return refs;
}

export function extractExpressionVariableReferences(
  content: string
): ExpressionVariableReference[] {
  const expression = parseExpressionNode(content);
  if (!expression) {
    return [];
  }

  const variables: string[] = [];
  const filters: string[] = [];
  collectExpressionReferences(expression, variables, filters);
  return assignVariableReferences(content, variables);
}

export function extractExpressionFilterReferences(content: string): ExpressionFilterReference[] {
  const expression = parseExpressionNode(content);
  if (!expression) {
    return [];
  }

  const variables: string[] = [];
  const filters: string[] = [];
  collectExpressionReferences(expression, variables, filters);
  return assignFilterReferences(content, filters);
}
