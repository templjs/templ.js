/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  BinaryOpNode,
  ExpressionNode,
  ErrorNode,
  FilterNode,
  LiteralNode,
  UnaryOpNode,
  VariableNode,
} from '../parser/types';
import type { RenderContext, RenderError } from './types';
import { VariableResolver } from './variable-resolver';
import { createBuiltinFilterMap } from './filter-engine';

type AnyValue = any;

const variableResolver = new VariableResolver();
const builtinFilters = createBuiltinFilterMap();

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
 * Handle parse error expressions
 */
export function evaluateError(expr: ErrorNode, context: RenderContext): AnyValue {
  context.errors.push({
    message: expr.message || 'Invalid or missing expression type',
    path: '',
    type: 'runtime_error',
  });
  return undefined;
}

/**
 * Main expression evaluator - dispatches to specific evaluators
 * This is the core evaluation function called by the renderer
 */
export function evaluateExpression(expr: ExpressionNode, context: RenderContext): AnyValue {
  const type = expr?.type;
  if (typeof type !== 'string') {
    context.errors.push({
      message: 'Invalid or missing expression type',
      path: '',
      type: 'runtime_error',
    });
    return undefined;
  }

  // Dispatch to specific evaluator based on expression type
  const evaluators: Record<string, (expr: ExpressionNode, context: RenderContext) => AnyValue> = {
    literal: evaluateLiteral as any,
    variable: evaluateVariable as any,
    filter: evaluateFilter as any,
    binary_op: evaluateBinaryOp as any,
    unary_op: evaluateUnaryOp as any,
    error: evaluateError as any,
  };

  const evaluator = evaluators[type];
  if (evaluator) {
    return evaluator(expr, context);
  }

  return undefined;
}
