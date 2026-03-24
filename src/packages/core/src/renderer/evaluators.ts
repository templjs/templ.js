/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  BinaryOpNode,
  ExpressionNode,
  ErrorNode,
  FilterNode,
  LiteralNode,
  ParenNode,
  UnaryOpNode,
  VariableNode,
} from '../parser/types.js';
import type { RenderContext, RenderError } from './types.js';
import { VariableResolver } from './variable-resolver.js';
import { createBuiltinFilterMap } from './filter-engine.js';

type AnyValue = any;

const variableResolver = new VariableResolver();
const builtinFilters = createBuiltinFilterMap();
/**
 * Sentinel position used when a node has no source-location information.
 * `line` is 1-based; `column` is 0-based. Consumer-facing helper for IDE/Volar integration.
 */
export const UNKNOWN_POSITION = { line: -1, column: -1 } as const;

/**
 * Type guard for a usable source position.
 * Accepts an undefined or partial position object and returns `true` only when
 * both `line` (≥ 1, 1-based) and `column` (≥ 0, 0-based) are present numeric
 * values. Consumer-facing helper for IDE/Volar integration.
 */
export function isHighlightablePosition(
  position: Partial<{ line: number; column: number }> | undefined
): position is { line: number; column: number } {
  return (
    position !== undefined &&
    typeof position.line === 'number' &&
    typeof position.column === 'number' &&
    position.line >= 1 &&
    position.column >= 0
  );
}

/**
 * Evaluate a literal expression
 */
export function evaluateLiteral(expr: LiteralNode, _context: RenderContext): AnyValue {
  return expr.value;
}

/**
 * Resolve a variable reference by traversing scopes and data
 */
export function evaluateVariable(node: VariableNode, context: RenderContext): AnyValue {
  const variableName = node.name;

  // Check scopes from innermost to outermost
  for (let i = context.scopes.length - 1; i >= 0; i--) {
    const scope = context.scopes[i];
    if (variableName in scope) {
      let value = scope[variableName];
      // Apply path segments
      for (const segment of node.path) {
        if (value === null || value === undefined) {
          return undefined;
        }
        if (segment.type === 'property') {
          if (Array.isArray(value) && segment.value === 'length') {
            value = value.length;
          } else {
            value = value[segment.value as string];
          }
        } else if (segment.type === 'index') {
          if (typeof segment.value === 'string') {
            const index = parseInt(segment.value, 10);
            value = value[index];
          } else {
            // Recursively evaluate index expression
            const indexValue = evaluateExpression(segment.value, context);
            value = value[indexValue];
          }
        }
      }
      return value;
    }
  }

  // Check root data
  if (context.data && variableName in context.data) {
    let value = context.data[variableName];
    for (const segment of node.path) {
      if (value === null || value === undefined) {
        return undefined;
      }
      if (segment.type === 'property') {
        if (Array.isArray(value) && segment.value === 'length') {
          value = value.length;
        } else {
          value = value[segment.value as string];
        }
      } else if (segment.type === 'index') {
        if (typeof segment.value === 'string') {
          const index = parseInt(segment.value, 10);
          value = value[index];
        } else {
          // Recursively evaluate index expression
          const indexValue = evaluateExpression(segment.value, context);
          value = value[indexValue];
        }
      }
    }
    return value;
  }

  // Variable not found
  const error: RenderError = {
    type: 'undefined_variable',
    message: `Undefined variable: ${variableName}`,
    path: variableName,
    location: { start: node.start, end: node.end },
  };
  context.errors.push(error);
  return undefined;
}

/**
 * Evaluate a filter chain expression
 */
export function evaluateFilter(expr: FilterNode, context: RenderContext): AnyValue {
  let value = evaluateExpression(expr.source, context);
  for (const filter of expr.filters) {
    const fn = context.filters.get(filter.name) ?? builtinFilters.get(filter.name);
    if (typeof fn === 'function') {
      const args =
        filter.args?.map((arg: ExpressionNode) => evaluateExpression(arg, context)) ?? [];
      value = fn(value, ...args);
    } else {
      const error: RenderError = {
        type: 'filter_error',
        path: `filter.${filter.name}`,
        message: `Filter not found: ${filter.name}`,
      };
      context.errors.push(error);
      if (context.options.throwOnError) {
        throw new Error(error.message);
      }
    }
  }
  return value;
}

/**
 * Evaluate a binary operation with JavaScript-correct semantics
 */
export function evaluateBinaryOp(node: BinaryOpNode, context: RenderContext): AnyValue {
  const left = evaluateExpression(node.left, context);
  const right = evaluateExpression(node.right, context);

  switch (node.operator) {
    // Arithmetic
    case '+':
      if (typeof left === 'number' && typeof right === 'number') {
        return left + right;
      }
      // String concatenation
      return variableResolver.toString(left) + variableResolver.toString(right);
    case '-':
      return typeof left === 'number' && typeof right === 'number' ? left - right : 0;
    case '*':
      return typeof left === 'number' && typeof right === 'number' ? left * right : 0;
    case '/':
      if (typeof left === 'number' && typeof right === 'number' && right !== 0) {
        return left / right;
      }
      return 0;
    case '%':
      if (typeof left === 'number' && typeof right === 'number') {
        return left % right;
      }
      return 0;

    // Comparison
    case '==':
      return left == right;
    case '!=':
      return left != right;
    case '===':
      return left === right;
    case '!==':
      return left !== right;
    case '<':
      return (left as number) < (right as number);
    case '<=':
      return (left as number) <= (right as number);
    case '>':
      return (left as number) > (right as number);
    case '>=':
      return (left as number) >= (right as number);

    // Logical
    case '&&':
      return variableResolver.toBoolean(left) && variableResolver.toBoolean(right);
    case '||':
      return variableResolver.toBoolean(left) || variableResolver.toBoolean(right);

    // Array/object access
    case '[':
      return left[right];

    default:
      return undefined;
  }
}

/**
 * Evaluate a unary operation
 */
export function evaluateUnaryOp(node: UnaryOpNode, context: RenderContext): AnyValue {
  const operand = evaluateExpression(node.operand, context);

  switch (node.operator) {
    case '!':
      return !variableResolver.toBoolean(operand);
    case '-':
      return -Number(operand);
    case '+':
      return +Number(operand);
    default:
      return operand;
  }
}

/**
 * Evaluate a parenthesized expression
 */
export function evaluateParen(node: ParenNode, context: RenderContext): AnyValue {
  return evaluateExpression(node.value, context);
}

/**
 * Handle parse error expressions
 */
export function evaluateError(expr: ErrorNode, context: RenderContext): AnyValue {
  const message = expr.message || 'Invalid or missing expression type';
  const hasHighlightableLocation =
    isHighlightablePosition(expr.start) && isHighlightablePosition(expr.end);

  context.errors.push({
    message,
    path: '',
    type: 'runtime_error',
    ...(hasHighlightableLocation
      ? {
          location: {
            start: expr.start,
            end: expr.end,
          },
        }
      : {}),
  });

  if (context.options.throwOnError) {
    throw new Error(message);
  }

  return undefined;
}

/**
 * Main expression evaluator - dispatches to specific evaluators
 * This is the core evaluation function called by the renderer
 */
export function evaluateExpression(expr: ExpressionNode, context: RenderContext): AnyValue {
  const type = expr?.type;
  if (typeof type !== 'string') {
    // Unknown expression shape has no reliable source mapping.
    // Use a sentinel that evaluateError treats as non-highlightable.
    const fallbackPosition = UNKNOWN_POSITION;
    const exprLike = expr as Partial<ErrorNode> | undefined;

    return evaluateError(
      {
        type: 'error',
        message: 'Invalid or missing expression type',
        recovered: true,
        start: exprLike?.start ?? fallbackPosition,
        end: exprLike?.end ?? fallbackPosition,
      },
      context
    );
  }

  // Dispatch to specific evaluator based on expression type
  const evaluators: Record<string, (expr: ExpressionNode, context: RenderContext) => AnyValue> = {
    literal: evaluateLiteral as any,
    variable: evaluateVariable as any,
    filter: evaluateFilter as any,
    binary_op: evaluateBinaryOp as any,
    unary_op: evaluateUnaryOp as any,
    paren: evaluateParen as any,
    error: evaluateError as any,
  };

  const evaluator = evaluators[type];
  if (evaluator) {
    return evaluator(expr, context);
  }

  return evaluateError(
    {
      type: 'error',
      message: `Unknown expression type: ${type}`,
      recovered: true,
      start: expr.start,
      end: expr.end,
    },
    context
  );
}
