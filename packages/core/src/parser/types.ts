/**
 * Abstract Syntax Tree (AST) node types for templjs templates
 */

import type { Position } from '../types';

/**
 * Base interface for all AST nodes
 */
export interface BaseNode {
  type: string;
  start: Position;
  end: Position;
  raw?: string;
}

/**
 * The root template node containing all statements and text
 */
export interface TemplateNode extends BaseNode {
  type: 'template';
  children: ASTNode[];
}

/**
 * Text content (literal string)
 */
export interface TextNode extends BaseNode {
  type: 'text';
  value: string;
}

/**
 * If/else conditional statement
 * e.g., {% if condition %}...{% else %}...{% endif %}
 */
export interface IfNode extends BaseNode {
  type: 'if';
  condition: ExpressionNode;
  body: ASTNode[];
  elseBody?: ASTNode[];
}

/**
 * For loop statement
 * e.g., {% for item in items %}...{% endfor %}
 */
export interface ForNode extends BaseNode {
  type: 'for';
  iterator: string;
  iterable: ExpressionNode;
  body: ASTNode[];
}

/**
 * Set statement for variable assignment
 * e.g., {% set x = 1 %}
 */
export interface SetNode extends BaseNode {
  type: 'set';
  name: string;
  value: ExpressionNode;
}

/**
 * Block definition (named content blocks)
 * e.g., {% block header %}...{% endblock %}
 */
export interface BlockNode extends BaseNode {
  type: 'block';
  name: string;
  body: ASTNode[];
}

/**
 * Expression statement
 * e.g., {{ user.name | upper }}
 */
export interface ExpressionStatementNode extends BaseNode {
  type: 'expression_statement';
  value: ExpressionNode;
}

/**
 * Variable reference
 * e.g., user, user.name, items[0]
 */
export interface VariableNode extends BaseNode {
  type: 'variable';
  name: string;
  path: PathSegment[];
}

/**
 * Segment in a variable path (property or index)
 */
export interface PathSegment {
  type: 'property' | 'index';
  value: string | ExpressionNode;
}

/**
 * Literal value (string, number, boolean, null)
 */
export interface LiteralNode extends BaseNode {
  type: 'literal';
  valueType: 'string' | 'number' | 'boolean' | 'null';
  value: string | number | boolean | null;
}

/**
 * Filter expression
 * e.g., user.name | upper | trim
 */
export interface FilterNode extends BaseNode {
  type: 'filter';
  source: ExpressionNode;
  filters: FilterCall[];
}

/**
 * A single filter call with arguments
 */
export interface FilterCall {
  name: string;
  args: ExpressionNode[];
}

/**
 * Function call expression
 * e.g., user.getName() or upper(value)
 */
export interface FunctionCallNode extends BaseNode {
  type: 'function_call';
  name: string;
  args: ExpressionNode[];
  object?: ExpressionNode;
}

/**
 * Binary operation
 * e.g., a + b, x == y, items[0]
 */
export interface BinaryOpNode extends BaseNode {
  type: 'binary_op';
  operator: string;
  left: ExpressionNode;
  right: ExpressionNode;
}

/**
 * Unary operation
 * e.g., !condition, -number
 */
export interface UnaryOpNode extends BaseNode {
  type: 'unary_op';
  operator: string;
  operand: ExpressionNode;
}

/**
 * Array literal
 * e.g., [1, 2, 3]
 */
export interface ArrayNode extends BaseNode {
  type: 'array';
  elements: ExpressionNode[];
}

/**
 * Object literal
 * e.g., { name: "John", age: 30 }
 */
export interface ObjectNode extends BaseNode {
  type: 'object';
  properties: ObjectProperty[];
}

/**
 * Property in an object literal
 */
export interface ObjectProperty {
  key: string;
  value: ExpressionNode;
}

/**
 * Parenthesized expression
 * e.g., (a + b)
 */
export interface ParenNode extends BaseNode {
  type: 'paren';
  value: ExpressionNode;
}

/**
 * Ternary conditional expression
 * e.g., condition ? trueValue : falseValue
 */
export interface TernaryNode extends BaseNode {
  type: 'ternary';
  condition: ExpressionNode;
  trueValue: ExpressionNode;
  falseValue: ExpressionNode;
}

/**
 * Error recovery node for malformed input
 */
export interface ErrorNode extends BaseNode {
  type: 'error';
  message: string;
  recovered: boolean;
}

/**
 * Union type of all possible expression nodes
 */
export type ExpressionNode =
  | VariableNode
  | LiteralNode
  | FilterNode
  | FunctionCallNode
  | BinaryOpNode
  | UnaryOpNode
  | ArrayNode
  | ObjectNode
  | ParenNode
  | TernaryNode
  | ErrorNode;

/**
 * Union type of all possible AST nodes
 */
export type ASTNode =
  | TemplateNode
  | TextNode
  | IfNode
  | ForNode
  | SetNode
  | BlockNode
  | ExpressionStatementNode
  | ExpressionNode;

/**
 * Parser result containing the AST and any errors
 */
export interface ParseResult {
  ast: TemplateNode | null;
  errors: ParseError[];
}

/**
 * Parse error with location information
 */
export interface ParseError {
  type: 'syntax' | 'recovery' | 'validation';
  message: string;
  location: Position;
  suggestion?: string;
}
