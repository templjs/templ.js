/**
 * Expression parsing module with priority-based rule dispatch
 *
 * This module implements the core logic for parsing template expressions into AST nodes.
 * It uses a priority-ordered rule list to dispatch expression parsing to the most
 * appropriate parser based on the expression type.
 *
 * Key features:
 * - Priority-based parsing: Rules are evaluated in order of priority (lower number = higher priority)
 * - Binary operator: Operators are matched with proper precedence (e.g., && before ||, * before +)
 * - Quote-aware splitting: Operator detection respects string literal boundaries
 * - Unary and ternary support: Handles unary operators, ternary conditionals
 * - Error handling: Creates error expressions for malformed input
 *
 * @module parser/parsers
 *
 * @example
 * ```ts
 * const expr = 'x && y || z';
 * const result = parseExpressionWithPriorityList(expr, context);
 * // Returns: logical_op { operator: '||', left: 'x && y', right: 'z' }
 * ```
 */

import type {
  ExpressionNode,
  LiteralNode,
  FilterNode,
  VariableNode,
  FunctionCallNode,
} from './types.js';

/**
 * Result of binary operator matching with left and right operands
 */
export interface BinaryMatch {
  /** The matched operator (e.g., '+', '&&', '||') */
  operator: string;
  /** Left operand string */
  left: string;
  /** Right operand string */
  right: string;
}

/**
 * Context object passed to expression parser rules and helper functions
 * Provides access to parsing functions and utilities
 */
export interface ExpressionParserContext {
  /** Parse a general expression string into an AST node */
  parseExpression: (expr: string) => ExpressionNode;
  /** Parse a literal value (string, number, boolean, null) */
  parseLiteral: (expr: string) => LiteralNode | null;
  /** Parse a filter expression (e.g., user | upper) */
  parseFilterExpression: (expr: string) => FilterNode;
  /** Parse a variable reference or function call */
  parseVariable: (expr: string) => VariableNode | FunctionCallNode;
  /** Parse object literal properties */
  parseObjectProperties: (inner: string) => Array<{ key: string; value: ExpressionNode }>;
  /** Split a string by delimiter respecting nesting */
  splitTopLevel: (str: string, delimiter: string) => string[];
  /** Check if a character can start a variable name */
  isVariableStart: (char: string) => boolean;
  /** Create an error expression node */
  createErrorExpression: (message: string) => ExpressionNode;
}

/**
 * Rule definition for expression parsing with priority dispatch
 */
interface ExpressionParserRule {
  /** Unique name identifying the rule type */
  name: string;
  /** Priority for rule evaluation (lower number = higher priority) */
  priority: number;
  /** Parser function that returns an AST node or null if rule doesn't match */
  parse: (expr: string, context: ExpressionParserContext) => ExpressionNode | null;
}

function isWrappedByOutermostParens(expr: string): boolean {
  if (!(expr.startsWith('(') && expr.endsWith(')'))) {
    return false;
  }

  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = inSingleQuote || inDoubleQuote;
      continue;
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (inSingleQuote || inDoubleQuote) {
      continue;
    }

    if (ch === '(') {
      depth++;
      continue;
    }

    if (ch === ')') {
      depth--;
      if (depth < 0) {
        return false;
      }

      if (depth === 0 && i < expr.length - 1) {
        return false;
      }
    }
  }

  return depth === 0;
}

/**
 * Priority-ordered expression parser rules
 * Rules are evaluated in order of priority, and the first match wins
 * Lower priority numbers are evaluated first
 */
const expressionParserRules: ExpressionParserRule[] = [
  {
    name: 'ternary',
    priority: 10,
    parse: (expr, context) => {
      const ternaryMatch = expr.match(/^(.+?)\s*\?\s*(.+?)\s*:\s*(.+?)$/);
      if (!ternaryMatch) return null;

      return {
        type: 'ternary',
        condition: context.parseExpression(ternaryMatch[1]),
        trueValue: context.parseExpression(ternaryMatch[2]),
        falseValue: context.parseExpression(ternaryMatch[3]),
        start: { line: 1, column: 0 },
        end: { line: 1, column: expr.length },
      };
    },
  },
  {
    name: 'unary',
    priority: 20,
    parse: (expr, context) => {
      const unaryMatch =
        expr.match(/^(!)\s*(.+)$/) ||
        expr.match(/^([-+])\s+(.+)$/) ||
        expr.match(/^(-)([^-].*)$/) ||
        expr.match(/^(\+)([^+].*)$/);
      if (!unaryMatch) return null;

      const operator = unaryMatch[1];
      const operand = (unaryMatch[2] ?? unaryMatch[3] ?? '').trim();
      if (!operand) {
        return context.createErrorExpression('Invalid or missing expression type');
      }

      return {
        type: 'unary_op',
        operator,
        operand: context.parseExpression(operand),
        start: { line: 1, column: 0 },
        end: { line: 1, column: expr.length },
      };
    },
  },
  {
    name: 'binary',
    priority: 30,
    parse: (expr, context) => {
      const binaryMatch = matchBinaryOpWithPrecedence(expr);
      if (!binaryMatch) return null;

      return {
        type: 'binary_op',
        operator: binaryMatch.operator,
        left: context.parseExpression(binaryMatch.left),
        right: context.parseExpression(binaryMatch.right),
        start: { line: 1, column: 0 },
        end: { line: 1, column: expr.length },
      };
    },
  },
  {
    name: 'paren',
    priority: 40,
    parse: (expr, context) => {
      if (!isWrappedByOutermostParens(expr)) return null;
      const inner = expr.substring(1, expr.length - 1);
      return {
        type: 'paren',
        value: context.parseExpression(inner),
        start: { line: 1, column: 0 },
        end: { line: 1, column: expr.length },
      };
    },
  },
  {
    name: 'array',
    priority: 50,
    parse: (expr, context) => {
      if (!(expr.startsWith('[') && expr.endsWith(']'))) return null;
      const inner = expr.substring(1, expr.length - 1);
      const elements =
        inner.length === 0
          ? []
          : context.splitTopLevel(inner, ',').map((e) => context.parseExpression(e));

      return {
        type: 'array',
        elements,
        start: { line: 1, column: 0 },
        end: { line: 1, column: expr.length },
      };
    },
  },
  {
    name: 'object',
    priority: 60,
    parse: (expr, context) => {
      if (!(expr.startsWith('{') && expr.endsWith('}'))) return null;
      const inner = expr.substring(1, expr.length - 1);
      const properties = context.parseObjectProperties(inner);

      return {
        type: 'object',
        properties,
        start: { line: 1, column: 0 },
        end: { line: 1, column: expr.length },
      };
    },
  },
  {
    name: 'literal',
    priority: 70,
    parse: (expr, context) => context.parseLiteral(expr),
  },
  {
    name: 'filter',
    priority: 80,
    parse: (expr, context) =>
      context.splitTopLevel(expr, '|').length > 1 ? context.parseFilterExpression(expr) : null,
  },
  {
    name: 'variable',
    priority: 90,
    parse: (expr, context) =>
      context.isVariableStart(expr.charAt(0)) ? context.parseVariable(expr) : null,
  },
];

const sortedExpressionParserRules = [...expressionParserRules].sort(
  (a, b) => a.priority - b.priority
);

/**
 * Parse an expression string into an AST node using priority-based rule dispatch
 *
 * Evaluates registered expression parser rules in order of priority until one matches.
 * Falls back to error expression if no rule matches the input.
 *
 * @param expr - The expression string to parse
 * @param context - Parser context providing helper functions and callbacks
 * @returns Parsed expression AST node
 *
 * @example
 * ```ts
 * const node = parseExpressionWithPriorityList('x + 1', context);
 * // Returns: { type: 'binary_op', operator: '+', ... }
 * ```
 */
export function parseExpressionWithPriorityList(
  expr: string,
  context: ExpressionParserContext
): ExpressionNode {
  for (const rule of sortedExpressionParserRules) {
    const parsed = rule.parse(expr, context);
    if (parsed) {
      return parsed;
    }
  }

  return context.createErrorExpression('Invalid or missing expression type');
}

/**
 * Match a binary operator in an expression with proper precedence handling
 *
 * Scans for binary operators in order of precedence (lowest to highest),
 * respecting string literal boundaries and nested structures.
 * Stops at the lowest-precedence operator found.
 *
 * Precedence levels (from lowest to highest priority):
 * - 15: || (logical or)
 * - 14: && (logical and)
 * - 12: | (filter)
 * - 11: in, not in
 * - 9: ===, !==, ==, !=
 * - 10: <=, >=, <, >
 * - 11: +, -
 * - 12: *, /, %
 *
 * @param expr - The expression string to scan
 * @returns {@link BinaryMatch} with operator and operands, or null if no match found
 *
 * @example
 * ```ts
 * const match = matchBinaryOpWithPrecedence('x && y || z');
 * // Returns: { operator: '||', left: 'x && y', right: 'z' }
 * ```
 */
export function matchBinaryOpWithPrecedence(expr: string): BinaryMatch | null {
  const precedenceLevels = [
    {
      precedence: 15,
      operators: ['||'],
      rightAssoc: true,
    },
    {
      precedence: 14,
      operators: ['&&'],
      rightAssoc: true,
    },
    {
      precedence: 9,
      operators: ['===', '!==', '==', '!='],
      rightAssoc: false,
    },
    {
      precedence: 10,
      operators: ['<=', '>=', '<', '>'],
      rightAssoc: false,
    },
    {
      precedence: 12,
      operators: ['+', '-'],
      rightAssoc: false,
    },
    {
      precedence: 13,
      operators: ['*', '/', '%'],
      rightAssoc: false,
    },
  ];

  for (const level of precedenceLevels) {
    for (const op of level.operators) {
      const parts = level.rightAssoc
        ? splitByOperatorFromRight(expr, op)
        : splitByOperatorFromLeft(expr, op);

      if (parts && parts.left.trim() && parts.right.trim()) {
        const left = parts.left.trim();
        if (['+', '-', '!'].includes(left)) {
          continue;
        }
        return { operator: op, left: parts.left, right: parts.right };
      }
    }
  }

  return null;
}

/**
 * Split an expression at an operator, scanning from left to right (left-associative)
 *
 * Finds the first occurrence of the operator at depth 0 (outside of nested structures
 * and string literals), splitting the expression into left and right operands.
 *
 * Key features:
 * - Quote-aware: Ignores operators inside single or double quoted strings
 * - Escape-aware: Handles escaped characters (e.g., \\" in strings)
 * - Depth-aware: Ignores operators inside parentheses, brackets, or braces
 * - Left-associative: Returns the leftmost operator match
 *
 * @param expr - The expression string to split
 * @param op - The operator to split on
 * @returns Split result with left and right operands, or null if operator not found
 *
 * @example
 * ```ts
 * splitByOperatorFromLeft('x + y + z', '+');
 * // Returns: { left: 'x ', right: ' y + z' }
 * splitByOperatorFromLeft('add("x+y") + z', '+');
 * // Returns: { left: 'add("x+y") ', right: ' z' }
 * ```
 */
export function splitByOperatorFromLeft(
  expr: string,
  op: string
): { left: string; right: string } | null {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];

    if ((inSingleQuote || inDoubleQuote) && ch === '\\' && !escaped) {
      escaped = true;
      continue;
    }

    if (!escaped && ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (!escaped && ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if (inSingleQuote || inDoubleQuote) {
      continue;
    }

    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth--;

    if (depth === 0 && expr.substring(i, i + op.length) === op) {
      return {
        left: expr.substring(0, i),
        right: expr.substring(i + op.length),
      };
    }
  }

  return null;
}

/**
 * Split an expression at an operator, scanning from left to right but returning rightmost match
 * (right-associative)
 *
 * Finds the rightmost occurrence of the operator at depth 0 (outside of nested structures
 * and string literals), splitting the expression into left and right operands.
 *
 * Key features:
 * - Quote-aware: Ignores operators inside single or double quoted strings
 * - Escape-aware: Handles escaped characters (e.g., \\" in strings)
 * - Depth-aware: Ignores operators inside parentheses, brackets, or braces
 * - Right-associative: Returns the rightmost operator match
 *
 * @param expr - The expression string to split
 * @param op - The operator to split on
 * @returns Split result with left and right operands, or null if operator not found
 *
 * @example
 * ```ts
 * splitByOperatorFromRight('x + y + z', '+');
 * // Returns: { left: 'x + y ', right: ' z' }
 * splitByOperatorFromRight('add("x+y") + z', '+');
 * // Returns: { left: 'add("x+y") ', right: ' z' }
 * ```
 */
export function splitByOperatorFromRight(
  expr: string,
  op: string
): { left: string; right: string } | null {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;
  let splitIndex = -1;

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];

    if ((inSingleQuote || inDoubleQuote) && ch === '\\' && !escaped) {
      escaped = true;
      continue;
    }

    if (!escaped && ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (!escaped && ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if (inSingleQuote || inDoubleQuote) {
      continue;
    }

    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth--;

    if (depth === 0 && expr.substring(i, i + op.length) === op) {
      splitIndex = i;
    }
  }

  if (splitIndex >= 0) {
    return {
      left: expr.substring(0, splitIndex),
      right: expr.substring(splitIndex + op.length),
    };
  }

  return null;
}
