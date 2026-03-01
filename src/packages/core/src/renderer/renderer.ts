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
  TextNode,
  ExpressionStatementNode,
} from '../parser/types';
import type { RenderContext, RenderResult, RenderOptions, RenderError } from './types';
import { VariableResolver } from './variable-resolver';
import { FilterEngine, filterRegistry } from './filter-engine';

type AnyValue = any;

/**
 * Default render options
 */
const DEFAULT_OPTIONS: Required<RenderOptions> = {
  throwOnError: false,
  undefinedValue: undefined,
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
  private options: Required<RenderOptions>;

  /**
   * Create a new renderer instance
   */
  constructor(options?: RenderOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Register a custom filter
   */
  registerFilter(name: string, fn: (value: AnyValue, ...args: AnyValue[]) => AnyValue): void {
    filterRegistry.register(name, fn);
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
      const output = renderNode(ast, context);
      const hasRuntimeError = context.errors.some((e) => e.type === 'runtime_error');
      return {
        output,
        errors: context.errors,
        success: !hasRuntimeError,
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
}

abstract class BaseNodeRenderer<TNode extends ASTNode> {
  /**
   * Evaluate a filter chain expression
   */
  protected evaluateFilterChain(expr: FilterNode, context: RenderContext): AnyValue {
    let value = this.evaluateExpression(expr.source, context);
    for (const filter of expr.filters) {
      const fn = filterRegistry.get(filter.name);
      if (typeof fn === 'function') {
        const args = filter.args?.map((arg) => this.evaluateExpression(arg, context)) ?? [];
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

  protected variableResolver: VariableResolver;
  protected filterEngine: FilterEngine;
  public abstract get type(): string;
  public abstract render(node: TNode, context: RenderContext): string;

  constructor() {
    this.variableResolver = new VariableResolver();
    this.filterEngine = new FilterEngine();
  }
  /**
   * Evaluate an expression to a value
   */
  protected evaluateExpression(expr: ExpressionNode, context: RenderContext): AnyValue {
    const type = expr?.type;
    if (typeof type !== 'string') {
      context.errors.push({
        message: 'Invalid or missing expression type',
        path: '',
        type: 'runtime_error',
      });
      return undefined;
    }

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
  protected resolveVariable(node: VariableNode, context: RenderContext): AnyValue {
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
              const indexValue = this.evaluateExpression(segment.value, context);
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
            const indexValue = this.evaluateExpression(segment.value, context);
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

class UnknownNodeRenderer extends BaseNodeRenderer<ASTNode> {
  public get type(): 'unknown' {
    return 'unknown';
  }

  render(node: ASTNode, context: RenderContext): string {
    context.errors.push({
      message: `Unknown node type: ${node?.type}`,
      path: '',
      type: 'runtime_error',
    });
    return '';
  }
}

class ExpressionStatementNodeRenderer extends BaseNodeRenderer<ExpressionStatementNode> {
  public get type(): 'expression_statement' {
    return 'expression_statement';
  }
  /**
   * Render an expression to a string
   */
  render(expr: ExpressionStatementNode, context: RenderContext): string {
    if (!expr || typeof expr !== 'object' || typeof expr.type !== 'string') {
      context.errors.push({
        message: 'Invalid or missing expression node',
        path: '',
        type: 'runtime_error',
      });
      return '';
    }
    const value = this.evaluateExpression(expr.value, context);

    if (value === undefined && context.options.undefinedValue !== undefined) {
      return context.options.undefinedValue;
    }

    return this.variableResolver.toString(value);
  }
}

class TemplateNodeRenderer extends BaseNodeRenderer<ASTNode> {
  public get type(): 'template' {
    return 'template';
  }
  render(node: ASTNode, context: RenderContext): string {
    // @ts-expect-error: TemplateNode type
    return node.children.map((child: ASTNode) => renderNode(child, context)).join('');
  }
}

class TextNodeRenderer extends BaseNodeRenderer<TextNode> {
  public get type(): 'text' {
    return 'text';
  }
  render(node: TextNode, _context: RenderContext): string {
    return node.value;
  }
}

class IfNodeRenderer extends BaseNodeRenderer<IfNode> {
  public get type(): 'if' {
    return 'if';
  }
  render(node: IfNode, context: RenderContext): string {
    const condition = this.evaluateExpression(node.condition, context);
    const isTruthy = this.variableResolver.toBoolean(condition);

    if (isTruthy) {
      return node.body.map((child) => renderNode(child, context)).join('');
    } else if (node.elseBody) {
      return node.elseBody.map((child) => renderNode(child, context)).join('');
    }

    return '';
  }
}
class ForNodeRenderer extends BaseNodeRenderer<ForNode> {
  public get type(): 'for' {
    return 'for';
  }
  render(node: ForNode, context: RenderContext): string {
    const iterable = this.evaluateExpression(node.iterable, context);

    if (!Array.isArray(iterable)) {
      const error: RenderError = {
        message: `Cannot iterate over non-array value: ${this.variableResolver.getType(iterable)}`,
        path: `for.iterable`,
        type: 'type_error',
        location: { start: node.start, end: node.end },
      };
      context.errors.push(error);
      if (context.options.throwOnError) {
        throw new Error(error.message);
      }
      return '';
    }

    const output: string[] = [];

    // Check max depth
    if (context.scopes.length >= (context.options.maxDepth ?? DEFAULT_OPTIONS.maxDepth)) {
      const error: RenderError = {
        message: 'Maximum nesting depth exceeded',
        path: 'for',
        type: 'runtime_error',
        location: { start: node.start, end: node.end },
      };
      context.errors.push(error);
      if (context.options.throwOnError) {
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
      output.push(node.body.map((child) => renderNode(child, context)).join(''));

      // Pop the scope
      context.scopes.pop();
    });

    return output.join('');
  }
}

const nodeRendererRegistry = new Map<string, BaseNodeRenderer<ASTNode>>([
  ['template', new TemplateNodeRenderer()],
  ['text', new TextNodeRenderer()],
  ['expression_statement', new ExpressionStatementNodeRenderer()],
  ['if', new IfNodeRenderer()],
  ['for', new ForNodeRenderer()],
  ['unknown', new UnknownNodeRenderer()],
  ['undefined', new UnknownNodeRenderer()],
  ['null', new UnknownNodeRenderer()],
]);

/**
 * Render a single AST node
 */
function renderNode(node: ASTNode, context: RenderContext): string {
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') {
    context.errors.push({
      message: 'Unknown or invalid AST node',
      path: '',
      type: 'runtime_error',
    });
    return '';
  }
  if (!nodeRendererRegistry.has(node.type)) {
    return nodeRendererRegistry.get('unknown')!.render(node, context);
  } else {
    return nodeRendererRegistry.get(node.type)!.render(node, context);
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
