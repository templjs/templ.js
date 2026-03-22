/**
 * Chevrotain-based parser that converts tokens into an Abstract Syntax Tree
 */

import type { Token } from '../lexer/types.js';
import { TokenType } from '../lexer/types.js';
import type {
  ASTNode,
  TemplateNode,
  ExpressionNode,
  VariableNode,
  LiteralNode,
  FilterNode,
  IfNode,
  ForNode,
  TextNode,
  ExpressionStatementNode,
  SetNode,
  BlockNode,
  FunctionCallNode,
  ErrorNode,
  ParseResult,
  ParseError,
} from './types.js';
import { parseExpressionWithPriorityList } from './parsers.js';

/**
 * Parser for converting token stream into AST
 * Handles statements (if, for, set, block) and expressions
 */
export class TemplateParser {
  private tokens: Token[];
  private position: number = 0;
  private errors: ParseError[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Parse the token stream into an AST
   */
  parse(): ParseResult {
    this.position = 0;
    this.errors = [];

    const children: ASTNode[] = [];

    while (!this.isAtEnd()) {
      const token = this.peek();
      if (!token) {
        // Defensive recovery for sparse token arrays: advance so parsing cannot stall.
        this.position++;
        continue;
      }

      if (token.type === TokenType.TEXT) {
        children.push(this.parseText());
      } else if (token.type === TokenType.STATEMENT) {
        const startPosition = this.position;
        const node = this.parseStatement();
        if (node) {
          children.push(node);
        } else if (this.position === startPosition) {
          // Defensive fallback if a statement parser returns null without consuming.
          this.position++;
        }
      } else if (token.type === TokenType.EXPRESSION) {
        children.push(this.parseExpressionStatement());
      } else if (token.type === TokenType.COMMENT) {
        // Skip comments
        this.advance();
      }
    }

    const firstToken = this.tokens[0];
    const lastToken = this.tokens[this.tokens.length - 1];

    const template: TemplateNode = {
      type: 'template',
      children,
      start: firstToken?.start || { line: 1, column: 0 },
      end: lastToken?.end || { line: 1, column: 0 },
    };

    return {
      ast: template,
      errors: this.errors,
    };
  }

  /**
   * Parse a text node
   */
  private parseText(): TextNode {
    const token = this.advance();
    return {
      type: 'text',
      value: token.content,
      start: token.start,
      end: token.end,
      raw: token.content,
    };
  }

  /**
   * Parse a statement (if, for, set, block, etc.)
   */
  private parseStatement(): ASTNode | null {
    const token = this.peek();
    if (!token || token.type !== TokenType.STATEMENT) return null;

    const content = this.extractStatementContent(token.content).trim();

    if (content.match(/^if\s+/)) {
      return this.parseIfStatement();
    } else if (content.match(/^for\s+/)) {
      return this.parseForStatement();
    } else if (content.match(/^set\s+/)) {
      return this.parseSetStatement();
    } else if (content.match(/^block\s+/)) {
      return this.parseBlockStatement();
    } else {
      // Unknown statement - skip it
      return this.parseErrorStatement('Unknown statement type');
    }
  }

  /**
   * Parse an if/else statement
   * Syntax: {% if condition %}...{% else %}...{% endif %}
   */
  private parseIfStatement(): IfNode {
    const startToken = this.peek();
    if (!startToken) throw new Error('Expected statement token');

    const content = this.extractStatementContent(startToken.content);
    const conditionMatch = content.match(/^if\s+(.+?)$/is);
    if (!conditionMatch) {
      this.addError(
        'syntax',
        'Invalid if statement',
        startToken.start,
        'Did you forget to close the {% if %} block with {% endif %}?'
      );
      this.advance();
      return {
        type: 'if',
        condition: this.createErrorExpression('Invalid condition'),
        body: [],
        start: startToken.start,
        end: startToken.end,
      };
    }
    const condition = this.parseCondition(conditionMatch[1].trim());

    this.advance();

    const body = this.parseStatementBody(['else', 'endif']);
    let elseBody: ASTNode[] | undefined;

    // Check for else clause
    const nextToken = this.peek();
    if (
      nextToken &&
      nextToken.type === TokenType.STATEMENT &&
      this.extractStatementContent(nextToken.content).trim().startsWith('else')
    ) {
      this.advance();
      elseBody = this.parseStatementBody(['endif']);
    }

    // Consume endif
    const endToken = this.peek();
    if (
      endToken &&
      endToken.type === TokenType.STATEMENT &&
      this.extractStatementContent(endToken.content).startsWith('endif')
    ) {
      this.advance();
    } else {
      // Missing endif: emit recovery error
      this.addError(
        'recovery',
        'Unclosed if block: missing {% endif %}',
        endToken?.start || (body.length > 0 ? body[body.length - 1].end : startToken.end),
        'Did you forget to close the {% if %} block with {% endif %}?'
      );
    }

    return {
      type: 'if',
      condition,
      body,
      elseBody,
      start: startToken.start,
      end: endToken?.end || startToken.end,
    };
  }

  /**
   * Parse a for loop
   * Syntax: {% for item in items %}...{% endfor %}
   */
  private parseForStatement(): ForNode {
    const startToken = this.peek();
    if (!startToken) throw new Error('Expected statement token');

    const content = this.extractStatementContent(startToken.content);
    const match = content.match(/^for\s+(\w+)\s+in\s+(.+?)$/);

    if (!match) {
      this.addError(
        'syntax',
        'Invalid for statement syntax',
        startToken.start,
        'Did you forget to close the {% for %} block with {% endfor %}?'
      );
      this.advance();
      return this.createErrorForNode(startToken);
    }

    const iterator = match[1];
    const iterableStr = match[2].trim();
    const iterable = this.parseExpression(iterableStr);

    this.advance();
    const body = this.parseStatementBody(['endfor']);

    const endToken = this.peek();
    if (
      endToken &&
      endToken.type === TokenType.STATEMENT &&
      this.extractStatementContent(endToken.content).startsWith('endfor')
    ) {
      this.advance();
    } else {
      // Missing endfor: emit recovery error
      this.addError(
        'recovery',
        'Unclosed for block: missing {% endfor %}',
        endToken?.start || (body.length > 0 ? body[body.length - 1].end : startToken.end),
        'Did you forget to close the {% for %} block with {% endfor %}?'
      );
    }

    return {
      type: 'for',
      iterator,
      iterable,
      body,
      start: startToken.start,
      end: endToken?.end || startToken.end,
    };
  }

  /**
   * Parse a set statement
   * Syntax: {% set x = value %}
   */
  private parseSetStatement(): SetNode {
    const startToken = this.peek();
    if (!startToken) throw new Error('Expected statement token');

    const content = this.extractStatementContent(startToken.content);
    const match = content.match(/^set\s+(\w+)\s*=\s*(.+?)$/);

    if (!match) {
      this.addError(
        'syntax',
        'Invalid set statement syntax',
        startToken.start,
        'Check your {% set %} statement syntax. Example: {% set x = value %}'
      );
      this.advance();
      return this.createErrorSetNode(startToken);
    }

    const name = match[1];
    const valueStr = match[2].trim();
    const value = this.parseExpression(valueStr);

    this.advance();

    return {
      type: 'set',
      name,
      value,
      start: startToken.start,
      end: startToken.end,
    };
  }

  /**
   * Parse a block definition
   * Syntax: {% block name %}...{% endblock %}
   */
  private parseBlockStatement(): BlockNode {
    const startToken = this.peek();
    if (!startToken) throw new Error('Expected statement token');

    const content = this.extractStatementContent(startToken.content);
    const match = content.match(/^block\s+(\w+)$/);

    if (!match) {
      this.addError(
        'syntax',
        'Invalid block statement syntax',
        startToken.start,
        'Did you forget to close the {% block %} with {% endblock %}?'
      );
      this.advance();
      return this.createErrorBlockNode(startToken);
    }

    const name = match[1];

    this.advance();
    const body = this.parseStatementBody(['endblock']);

    const endToken = this.peek();
    if (
      endToken &&
      endToken.type === TokenType.STATEMENT &&
      this.extractStatementContent(endToken.content).startsWith('endblock')
    ) {
      this.advance();
    } else {
      // Missing endblock: emit recovery error
      this.addError(
        'recovery',
        'Unclosed block: missing {% endblock %}',
        endToken?.start || (body.length > 0 ? body[body.length - 1].end : startToken.end),
        'Did you forget to close the {% block %} with {% endblock %}?'
      );
    }

    return {
      type: 'block',
      name,
      body,
      start: startToken.start,
      end: endToken?.end || startToken.end,
    };
  }

  /**
   * Parse an expression statement {{ ... }}
   */
  private parseExpressionStatement(): ExpressionStatementNode {
    const token = this.advance();
    const content = this.extractExpressionContent(token.content);
    const value = this.parseExpression(content);

    return {
      type: 'expression_statement',
      value,
      start: token.start,
      end: token.end,
    };
  }

  /**
   * Parse body of a statement until a closing keyword
   */
  private parseStatementBody(closeKeywords: string[]): ASTNode[] {
    const body: ASTNode[] = [];

    while (!this.isAtEnd()) {
      const token = this.peek();
      if (!token) break;

      // Check if we've reached a closing keyword
      if (
        token.type === TokenType.STATEMENT &&
        closeKeywords.some((kw) => this.extractStatementContent(token.content).startsWith(kw))
      ) {
        break;
      }

      if (token.type === TokenType.TEXT) {
        body.push(this.parseText());
      } else if (token.type === TokenType.STATEMENT) {
        const startPosition = this.position;
        const node = this.parseStatement();
        if (node) {
          body.push(node);
        } else if (this.position === startPosition) {
          // Defensive fallback if a nested statement parser returns null without consuming.
          this.position++;
        }
      } else if (token.type === TokenType.EXPRESSION) {
        body.push(this.parseExpressionStatement());
      } else if (token.type === TokenType.COMMENT) {
        this.advance();
      }
    }

    return body;
  }

  /**
   * Parse a condition expression (for if statements)
   */
  private parseCondition(conditionStr: string): ExpressionNode {
    return this.parseExpression(conditionStr);
  }

  /**
   * Parse an expression string into an ExpressionNode
   * Supports: variables, literals, filters, function calls, operators
   */
  private parseExpression(expr: string): ExpressionNode {
    expr = expr.trim();

    // Handle empty expression
    if (!expr) {
      return this.createErrorExpression('Empty expression');
    }

    return parseExpressionWithPriorityList(expr, {
      parseExpression: (value) => this.parseExpression(value),
      parseLiteral: (value) => this.parseLiteral(value),
      parseFilterExpression: (value) => this.parseFilterExpression(value),
      parseVariable: (value) => this.parseVariable(value),
      parseObjectProperties: (inner) => this.parseObjectProperties(inner),
      splitTopLevel: (value, delimiter) => this.splitTopLevel(value, delimiter),
      isVariableStart: (char) => this.isVariableStart(char),
      createErrorExpression: (message) => this.createErrorExpression(message),
    });
  }

  /**
   * Parse a filter expression with pipes
   */
  private parseFilterExpression(expr: string): FilterNode {
    const parts = this.splitTopLevel(expr, '|');
    const sourceStr = parts[0].trim();
    const source = this.parseExpression(sourceStr);

    const filters = parts.slice(1).map((filterStr) => {
      filterStr = filterStr.trim();
      const match = filterStr.match(/^(\w+)(?:\(([^)]*)\))?$/);
      if (!match) {
        return { name: filterStr, args: [] };
      }

      const name = match[1];
      const argsStr = match[2];
      const args = argsStr
        ? this.splitTopLevel(argsStr, ',').map((a) => this.parseExpression(a.trim()))
        : [];

      return { name, args };
    });

    return {
      type: 'filter',
      source,
      filters,
      start: { line: 1, column: 0 },
      end: { line: 1, column: expr.length },
    };
  }

  /**
   * Parse a variable reference with path (properties and indices)
   */
  private parseVariable(expr: string): VariableNode | FunctionCallNode {
    expr = expr.trim();

    // Check if it's a function call
    const funcMatch = expr.match(/^(\w+)\s*\(([^)]*)\)$/);
    if (funcMatch) {
      const name = funcMatch[1];
      const argsStr = funcMatch[2];
      const args = argsStr
        ? this.splitTopLevel(argsStr, ',').map((a) => this.parseExpression(a.trim()))
        : [];

      return {
        type: 'function_call',
        name,
        args,
        start: { line: 1, column: 0 },
        end: { line: 1, column: expr.length },
      };
    }

    // Parse variable with path
    const pathMatch = expr.match(/^([a-zA-Z_]\w*)(.*)$/);
    if (!pathMatch) {
      return this.createErrorVariable(expr);
    }

    const name = pathMatch[1];
    const pathStr = pathMatch[2];

    const path = this.parsePath(pathStr);

    // Check if the last segment is a function call
    if (path.length > 0 && path[path.length - 1].type === 'property') {
      const lastProp = path[path.length - 1].value as string;
      const remaining = pathStr.substring(pathStr.lastIndexOf(lastProp) + lastProp.length);

      if (remaining.startsWith('(')) {
        const funcMatch = remaining.match(/^\(([^)]*)\)/);
        if (funcMatch) {
          const argsStr = funcMatch[1];
          const args = argsStr
            ? this.splitTopLevel(argsStr, ',').map((a) => this.parseExpression(a.trim()))
            : [];

          // Build object expression for method call
          const baseObject: VariableNode = {
            type: 'variable',
            name,
            path: path.slice(0, -1),
            start: { line: 1, column: 0 },
            end: { line: 1, column: 0 },
          };

          return {
            type: 'function_call',
            name: lastProp,
            args,
            object: path.length > 1 ? baseObject : undefined,
            start: { line: 1, column: 0 },
            end: { line: 1, column: expr.length },
          };
        }
      }
    }

    return {
      type: 'variable',
      name,
      path,
      start: { line: 1, column: 0 },
      end: { line: 1, column: expr.length },
    };
  }

  /**
   * Parse the path part of a variable (properties and indices)
   */
  private parsePath(pathStr: string) {
    const path: Array<{ type: 'property' | 'index'; value: string | ExpressionNode }> = [];
    let i = 0;

    while (i < pathStr.length) {
      if (pathStr[i] === '.') {
        // Property access
        i++;
        const propMatch = pathStr.substring(i).match(/^([a-zA-Z_]\w*)/);
        if (propMatch) {
          path.push({ type: 'property', value: propMatch[1] });
          i += propMatch[1].length;
        }
      } else if (pathStr[i] === '[') {
        // Index access
        const endBracket = pathStr.indexOf(']', i);
        if (endBracket !== -1) {
          const indexStr = pathStr.substring(i + 1, endBracket).trim();
          const isQuoted =
            (indexStr.startsWith('"') && indexStr.endsWith('"')) ||
            (indexStr.startsWith("'") && indexStr.endsWith("'"));

          if (isQuoted) {
            // String index
            path.push({ type: 'index', value: indexStr.substring(1, indexStr.length - 1) });
          } else {
            // Expression index
            path.push({ type: 'index', value: this.parseExpression(indexStr) });
          }

          i = endBracket + 1;
        } else {
          // Malformed index access (missing ']'): consume the token to avoid infinite loops.
          i++;
        }
      } else {
        i++;
      }
    }

    return path;
  }

  /**
   * Parse literal values (strings, numbers, booleans, null)
   */
  private parseLiteral(expr: string): LiteralNode | null {
    expr = expr.trim();

    // String literals
    if (
      (expr.startsWith('"') && expr.endsWith('"')) ||
      (expr.startsWith("'") && expr.endsWith("'"))
    ) {
      const value = expr.substring(1, expr.length - 1);
      return {
        type: 'literal',
        valueType: 'string',
        value,
        start: { line: 1, column: 0 },
        end: { line: 1, column: expr.length },
      };
    }

    // Number literals
    if (/^-?\d+(\.\d+)?$/.test(expr)) {
      const value = expr.includes('.') ? parseFloat(expr) : parseInt(expr, 10);
      return {
        type: 'literal',
        valueType: 'number',
        value,
        start: { line: 1, column: 0 },
        end: { line: 1, column: expr.length },
      };
    }

    // Boolean literals
    if (expr === 'true') {
      return {
        type: 'literal',
        valueType: 'boolean',
        value: true,
        start: { line: 1, column: 0 },
        end: { line: 1, column: expr.length },
      };
    }

    if (expr === 'false') {
      return {
        type: 'literal',
        valueType: 'boolean',
        value: false,
        start: { line: 1, column: 0 },
        end: { line: 1, column: expr.length },
      };
    }

    // Null literal
    if (expr === 'null') {
      return {
        type: 'literal',
        valueType: 'null',
        value: null,
        start: { line: 1, column: 0 },
        end: { line: 1, column: expr.length },
      };
    }

    return null;
  }

  /**
   * Parse object properties
   */
  private parseObjectProperties(inner: string) {
    if (!inner.trim()) return [];

    const pairs = this.splitTopLevel(inner, ',');
    const properties: Array<{ key: string; value: ExpressionNode }> = [];

    for (const pair of pairs) {
      const match = pair.match(/^\s*([a-zA-Z_]\w*)\s*:\s*(.+)$/);
      if (match) {
        const key = match[1];
        const value = this.parseExpression(match[2].trim());
        properties.push({ key, value });
      }
    }

    return properties;
  }

  /**
   * Split string by delimiter respecting nested structures
   */
  private splitTopLevel(str: string, delimiter: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (char === '(' || char === '[' || char === '{') depth++;
      if (char === ')' || char === ']' || char === '}') depth--;

      if (depth === 0 && char === delimiter) {
        parts.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    if (current) parts.push(current);
    return parts;
  }

  /**
   * Check if character can start a variable name
   */
  private isVariableStart(char: string): boolean {
    return /[a-zA-Z_]/.test(char);
  }

  /**
   * Extract statement content between delimiters
   */
  private extractStatementContent(content: string): string {
    // Use flat string operations instead of regex to avoid ReDoS
    let result = content;
    if (result.startsWith('{%')) {
      result = result.substring(2);
    }
    if (result.endsWith('%}')) {
      result = result.substring(0, result.length - 2);
    }
    return result.trim();
  }

  /**
   * Extract expression content between delimiters
   */
  private extractExpressionContent(content: string): string {
    // Use flat string operations instead of regex to avoid ReDoS
    let result = content;
    if (result.startsWith('{{')) {
      result = result.substring(2);
    }
    if (result.endsWith('}}')) {
      result = result.substring(0, result.length - 2);
    }
    return result.trim();
  }

  /**
   * Parse an error statement
   */
  private parseErrorStatement(message: string): ErrorNode {
    const token = this.advance();
    this.addError('syntax', message, token.start, 'Check the statement syntax or delimiters.');
    return {
      type: 'error',
      message,
      recovered: false,
      start: token.start,
      end: token.end,
    };
  }

  /**
   * Create an error expression
   */
  private createErrorExpression(message: string): ExpressionNode {
    return {
      type: 'error',
      message,
      recovered: true,
      start: { line: 1, column: 0 },
      end: { line: 1, column: 0 },
    };
  }

  /**
   * Create an error variable node
   */
  private createErrorVariable(expr: string): VariableNode {
    return {
      type: 'variable',
      name: expr,
      path: [],
      start: { line: 1, column: 0 },
      end: { line: 1, column: expr.length },
    };
  }

  /**
   * Create an error for node
   */
  private createErrorForNode(token: Token): ForNode {
    return {
      type: 'for',
      iterator: '',
      iterable: this.createErrorExpression('Invalid for statement'),
      body: [],
      start: token.start,
      end: token.end,
    };
  }

  /**
   * Create an error set node
   */
  private createErrorSetNode(token: Token): SetNode {
    return {
      type: 'set',
      name: '',
      value: this.createErrorExpression('Invalid set statement'),
      start: token.start,
      end: token.end,
    };
  }

  /**
   * Create an error block node
   */
  private createErrorBlockNode(token: Token): BlockNode {
    return {
      type: 'block',
      name: '',
      body: [],
      start: token.start,
      end: token.end,
    };
  }

  /**
   * Add an error to the errors list
   */
  private addError(
    type: 'syntax' | 'recovery' | 'validation',
    message: string,
    location: { line: number; column: number },
    suggestion?: string
  ): void {
    this.errors.push({
      type,
      message,
      location,
      suggestion,
    });
  }

  /**
   * Get current token without advancing
   */
  private peek(offset = 0): Token | null {
    const index = this.position + offset;
    if (index >= this.tokens.length) return null;
    return this.tokens[index];
  }

  /**
   * Advance to next token and return current
   */
  private advance(): Token {
    const token = this.tokens[this.position];
    this.position++;
    return token;
  }

  /**
   * Check if at end of tokens
   */
  private isAtEnd(): boolean {
    return this.position >= this.tokens.length;
  }
}

/**
 * Parse tokens into an AST
 * @param tokens - Array of tokens from the lexer
 * @returns Parse result containing AST and any errors
 */
export function parse(tokens: Token[]): ParseResult {
  const parser = new TemplateParser(tokens);
  return parser.parse();
}
