import { ExpressionNode, TemplateNode } from '../../src/parser';

const POS = { line: 1, column: 0 };

const literal = (value: string | number | boolean | null): ExpressionNode => ({
  type: 'literal',
  valueType: value === null ? 'null' : (typeof value as 'string' | 'number' | 'boolean'),
  value,
  start: POS,
  end: POS,
});

const variable = (name: string): ExpressionNode => ({
  type: 'variable',
  name,
  path: [],
  start: POS,
  end: POS,
});

const binary = (operator: string, left: ExpressionNode, right: ExpressionNode): ExpressionNode => ({
  type: 'binary_op',
  operator,
  left,
  right,
  start: POS,
  end: POS,
});

const unary = (operator: string, operand: ExpressionNode): ExpressionNode => ({
  type: 'unary_op',
  operator,
  operand,
  start: POS,
  end: POS,
});

const filtered = (
  source: ExpressionNode,
  name: string,
  args: ExpressionNode[] = []
): ExpressionNode => ({
  type: 'filter',
  source,
  filters: [{ name, args }],
  start: POS,
  end: POS,
});

const template = (value: ExpressionNode): TemplateNode => ({
  type: 'template',
  children: [{ type: 'expression_statement', value, start: POS, end: POS }],
  start: POS,
  end: POS,
});

export { literal, variable, binary, unary, filtered, template, POS };
