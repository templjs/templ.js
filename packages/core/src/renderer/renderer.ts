/**
 * Template rendering engine that traverses AST and produces output
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  TemplateNode,
  ASTNode,
  ExpressionNode,
  IfNode,
  ForNode,
  VariableNode,
  BinaryOpNode,
  FilterNode,
} from '../parser/types';
import type { RenderContext, RenderResult, RenderOptions, RenderError } from './types';
import { VariableResolver } from './variable-resolver';
import { FilterEngine } from './filter-engine';

type AnyValue = any;

/**
 * Default render options
 */
const DEFAULT_OPTIONS: Required<RenderOptions> = {
  throwOnError: false,
  includeUndefinedVars: false,
  undefinedValue: '',
  maxDepth: 100,
  debug: false,
};

/**
 * Main template renderer
 *
 * Traverses AST and generates rendered output with proper variable resolution,
 * filter application, and scope management.
 */
export class Renderer {
  private variableResolver: VariableResolver;
  private filterEngine: FilterEngine;
  private options: Required<RenderOptions>;

  /**
   * Create a new renderer instance
   */
  constructor(options?: RenderOptions) {
    this.variableResolver = new VariableResolver();
    this.filterEngine = new FilterEngine();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Register a custom filter
   */
  registerFilter(name: string, fn: (value: AnyValue, ...args: AnyValue[]) => AnyValue): void {
    this.filterEngine.registerFilter(name, fn);
  }

  /**
   * Render an AST with the given data
   *
   * @param ast - The abstract syntax tree to render
   * @param data - The data context for variable resolution
   * @returns The rendered output and any errors that occurred
   */
  render(ast: TemplateNode | ASTNode, data: AnyValue): RenderResult {
    const context: RenderContext = {
      data: typeof data === 'object' && data !== null ? data : {},
      scopes: [],
      filters: new Map(),
      functions: new Map(),
      errors: [],
      options: this.options,
    };

    try {
      const output = this.renderNode(ast, context);
      return {
        output,
        errors: context.errors,
        success: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.options.throwOnError) {
        throw error;
      }
      context.errors.push({
        message,
        path: '',
        type: 'runtime_error',
      });
      return {
        output: '',
        errors: context.errors,
        success: false,
      };
    }
  }

  /**
   * Render a single AST node
   */
  private renderNode(node: ASTNode, context: RenderContext): string {
    if (node.type === 'template') {
      const template = node;
      return template.children.map((child) => this.renderNode(child, context)).join('');
    }

    if (node.type === 'text') {
      const text = node;
      return text.value;
    }

    if (node.type === 'expression_statement') {
      const expr = node;
      return this.renderExpression(expr.value, context);
    }

    if (node.type === 'if') {
      return this.renderIfStatement(node, context);
    }

    if (node.type === 'for') {
      return this.renderForStatement(node, context);
    }

    return '';
  }

  /**
   * Render an if/else statement
   */
  private renderIfStatement(node: IfNode, context: RenderContext): string {
    const condition = this.evaluateExpression(node.condition, context);
    const isTruthy = this.variableResolver.toBoolean(condition);

    if (isTruthy) {
      return node.body.map((child) => this.renderNode(child, context)).join('');
    } else if (node.elseBody) {
      return node.elseBody.map((child) => this.renderNode(child, context)).join('');
    }

    return '';
  }

  /**
   * Render a for loop statement
   */
  private renderForStatement(node: ForNode, context: RenderContext): string {
    const iterable = this.evaluateExpression(node.iterable, context);

    if (!Array.isArray(iterable)) {
      const error: RenderError = {
        message: `Cannot iterate over non-array value: ${this.variableResolver.getType(iterable)}`,
        path: `for.iterable`,
        type: 'type_error',
        location: node.location,
      };
      context.errors.push(error);
      if (this.options.throwOnError) {
        throw new Error(error.message);
      }
      return '';
    }

    const output: string[] = [];

    // Check max depth
    if (context.scopes.length >= this.options.maxDepth) {
      const error: RenderError = {
        message: 'Maximum nesting depth exceeded',
        path: 'for',
        type: 'runtime_error',
        location: node.location,
      };
      context.errors.push(error);
      if (this.options.throwOnError) {
        throw new Error(error.message);
      }
      return '';
    }

    iterable.forEach((item: AnyValue, index: number) => {
      // Push a new scope with the loop variable and loop object
      context.scopes.push({
        [node.iterator]: item,
        loop: {
          index: index + 1, // 1-indexed for templates
          first: index === 0,
          last: index === iterable.length - 1,
          length: iterable.length,
        },
      });

      // Render the loop body
      output.push(node.body.map((child) => this.renderNode(child, context)).join(''));

      // Pop the scope
      context.scopes.pop();
    });

    return output.join('');
  }

  /**
   * Render an expression to a string
   */
  private renderExpression(expr: ExpressionNode, context: RenderContext): string {
    const value = this.evaluateExpression(expr, context);
    return this.variableResolver.toString(value);
  }

  /**
   * Evaluate an expression to a value
   */
  private evaluateExpression(expr: ExpressionNode, context: RenderContext): AnyValue {
    // Variable reference
    if (expr.type === 'variable') {
      return this.resolveVariable(expr, context);
    }

    // Literal value
    if (expr.type === 'literal') {
      const lit = expr;
      return lit.value;
    }

    // Filter chain
    if (expr.type === 'filter') {
      return this.evaluateFilterChain(expr, context);
    }

    // Binary operations
    if (expr.type === 'binary_op') {
      return this.evaluateBinaryOp(expr, context);
    }

    // Unary operations
    if (expr.type === 'unary_op') {
      const unary = expr as any;
      const operand = this.evaluateExpression(unary.operand, context);

      switch (unary.operator) {
        case '!':
          return !this.variableResolver.toBoolean(operand);
        case '-':
          return typeof operand === 'number' ? -operand : operand;
        case '+':
          return typeof operand === 'number' ? operand : operand;
        default:
          return operand;
      }
    }

    return undefined;
  }

  /**
   * Resolve a variable reference
   */
  private resolveVariable(node: VariableNode, context: RenderContext): AnyValue {
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
            value = value[segment.value];
          } else if (segment.type === 'index') {
            if (typeof segment.value === 'string') {
              const index = parseInt(segment.value, 10);

              value = value[index];
            } else {
              const indexValue = this.evaluateExpression(segment.value, context);

              value = value[indexValue];
            }
          }
        }

        return value;
      }
    }

    // Check root data
    let value: AnyValue = context.data;

    if (!(variableName in value)) {
      const error: RenderError = {
        message: `Undefined variable: ${variableName}`,
        path: variableName,
        type: 'undefined_variable',
        location: node.location,
      };
      context.errors.push(error);
      return undefined;
    }

    value = value[variableName];

    // Apply path segments
    for (const segment of node.path) {
      if (value === null || value === undefined) {
        return undefined;
      }

      if (segment.type === 'property') {
        value = value[segment.value];
      } else if (segment.type === 'index') {
        if (typeof segment.value === 'string') {
          const index = parseInt(segment.value, 10);

          value = value[index];
        } else {
          const indexValue = this.evaluateExpression(segment.value, context);

          value = value[indexValue];
        }
      }
    }

    return value;
  }

  /**
   * Evaluate a filter chain expression
   */
  private evaluateFilterChain(node: FilterNode, context: RenderContext): AnyValue {
    let value = this.evaluateExpression(node.source, context);

    for (const filter of node.filters) {
      try {
        const args = filter.args.map((arg) => this.evaluateExpression(arg, context));
        value = this.filterEngine.applyFilter(filter.name, value, args);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const renderError: RenderError = {
          message,
          path: `filter.${filter.name}`,
          type: 'filter_error',
          location: node.location,
        };
        context.errors.push(renderError);
        if (this.options.throwOnError) {
          throw error;
        }
      }
    }

    return value;
  }

  /**
   * Evaluate a binary operation
   */
  private evaluateBinaryOp(node: BinaryOpNode, context: RenderContext): AnyValue {
    const left = this.evaluateExpression(node.left, context);
    const right = this.evaluateExpression(node.right, context);

    switch (node.operator) {
      // Arithmetic
      case '+':
        if (typeof left === 'number' && typeof right === 'number') {
          return left + right;
        }
        // String concatenation
        return this.variableResolver.toString(left) + this.variableResolver.toString(right);
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
        return this.variableResolver.toBoolean(left) && this.variableResolver.toBoolean(right);
      case '||':
        return this.variableResolver.toBoolean(left) || this.variableResolver.toBoolean(right);

      // Array/object access
      case '[':
        return left[right];

      default:
        return undefined;
    }
  }
}

/**
 * Convenience function to render a template
 */
export function render(
  ast: TemplateNode | ASTNode,
  data: AnyValue,
  options?: RenderOptions
): RenderResult {
  const renderer = new Renderer(options);
  return renderer.render(ast, data);
}
