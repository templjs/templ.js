import type {
  ExpressionNode,
  LiteralNode,
  FilterNode,
  VariableNode,
  FunctionCallNode,
} from './types';

export interface BinaryMatch {
  operator: string;
  left: string;
  right: string;
}

export interface ExpressionParserContext {
  parseExpression: (expr: string) => ExpressionNode;
  parseLiteral: (expr: string) => LiteralNode | null;
  parseFilterExpression: (expr: string) => FilterNode;
  parseVariable: (expr: string) => VariableNode | FunctionCallNode;
  parseObjectProperties: (inner: string) => Array<{ key: string; value: ExpressionNode }>;
  splitTopLevel: (str: string, delimiter: string) => string[];
  isVariableStart: (char: string) => boolean;
  createErrorExpression: (message: string) => ExpressionNode;
}

interface ExpressionParserRule {
  name: string;
  priority: number;
  parse: (expr: string, context: ExpressionParserContext) => ExpressionNode | null;
}

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
      if (!(expr.startsWith('(') && expr.endsWith(')'))) return null;
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
    parse: (expr, context) => (expr.includes('|') ? context.parseFilterExpression(expr) : null),
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
