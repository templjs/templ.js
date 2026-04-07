import { describe, expect, it } from 'vitest';
import { render } from './renderer.js';
import type {
  SetNode,
  LiteralNode,
  VariableNode,
  ForNode,
  ExpressionStatementNode,
  TemplateNode,
  ASTNode,
} from '../parser/types.js';

// ─── helpers ────────────────────────────────────────────────────────────────

const POS = { line: 1, column: 0 };

function lit(value: string | number | boolean | null): LiteralNode {
  return {
    type: 'literal',
    valueType:
      value === null
        ? 'null'
        : value === true || value === false
          ? 'boolean'
          : typeof value === 'number'
            ? 'number'
            : 'string',
    value,
    start: POS,
    end: POS,
  };
}

function varRef(name: string): VariableNode {
  return { type: 'variable', name, path: [], start: POS, end: POS };
}

function setNode(name: string, value: LiteralNode | VariableNode): SetNode {
  return { type: 'set', name, value, start: POS, end: POS };
}

function exprStmt(value: VariableNode): ExpressionStatementNode {
  return { type: 'expression_statement', value, start: POS, end: POS };
}

function forNode(iterator: string, iterable: VariableNode, body: ASTNode[]): ForNode {
  return { type: 'for', iterator, valueIterator: undefined, iterable, body, start: POS, end: POS };
}

function template(...children: ASTNode[]): TemplateNode {
  return { type: 'template', children, start: POS, end: POS };
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('SetNodeRenderer', () => {
  // Case 1: new variable — context.data and scopes both empty (branch 4)
  it('writes a new variable to context.data when scopes are empty', () => {
    const ast = template(setNode('greeting', lit('hello')));
    const data: Record<string, unknown> = {};
    const result = render(ast, data);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.output).toBe('');
    expect(data['greeting']).toBe('hello');
  });

  it('set always returns empty string output', () => {
    const ast = template(setNode('hidden', lit('no output')));
    const result = render(ast, {});
    expect(result.output).toBe('');
  });

  it('writes multiple types to context.data when scopes are empty', () => {
    const data: Record<string, unknown> = {};
    const result = render(
      template(setNode('n', lit(42)), setNode('b', lit(true)), setNode('nil', lit(null))),
      data
    );
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(data['n']).toBe(42);
    expect(data['b']).toBe(true);
    expect(data['nil']).toBeNull();
  });

  // Case 2: updating an existing variable in an inner scope (branch 1)
  // ForNodeRenderer pushes a scope per iteration; SetNodeRenderer finds the key
  // there and updates it rather than writing to context.data.
  it('updates the loop-scope variable when the for-loop body sets the iterator variable', () => {
    // for item in items([1,2]): set item = 99; {{ item }}
    // Each iteration: scope = {item:val, loop:...}, set finds 'item' in scope → updates to 99
    // exprStmt outputs '99' × 2 iterations → '9999'
    const body: ASTNode[] = [setNode('item', lit(99)), exprStmt(varRef('item'))];
    const ast = template(forNode('item', varRef('items'), body));
    const result = render(ast, { items: [1, 2] });
    expect(result.success).toBe(true);
    expect(result.output).toBe('9999');
  });

  it('does not leak the loop-scope update back to context.data', () => {
    // context.data has 'items' but no 'item' key — the write stays in the for-loop scope
    const body: ASTNode[] = [setNode('item', lit(99))];
    const data: Record<string, unknown> = { xs: [1] };
    render(template(forNode('item', varRef('xs'), body)), data);
    expect(Object.prototype.hasOwnProperty.call(data, 'item')).toBe(false);
  });

  // Case 3: updating an existing variable stored on context.data (branch 2)
  it('updates an existing variable on context.data when no scope owns it', () => {
    const ast = template(setNode('name', lit('Alice')));
    const data: Record<string, unknown> = { name: 'Bob' };
    render(ast, data);
    expect(data['name']).toBe('Alice');
  });

  // Case 4: scope precedence — innermost scope is updated, outer scope untouched (branch 1)
  it('updates the innermost for-loop scope and leaves the outer scope unchanged', () => {
    // Outer for x in outer_xs([1]): inner for x in inner_xs([2]): set x=99; {{ x }}; {{ x }}
    // When inner body runs, scopes = [{x:1,loop:...}, {x:2,loop:...}]
    // SetNodeRenderer scans innermost first → updates inner scope's x to 99
    // Inner exprStmt outputs '99'; inner scope popped; outer exprStmt reads outer x=1 → '1'
    const innerBody: ASTNode[] = [setNode('x', lit(99)), exprStmt(varRef('x'))];
    const innerFor = forNode('x', varRef('inner_xs'), innerBody);
    const outerBody: ASTNode[] = [innerFor, exprStmt(varRef('x'))];
    const outerFor = forNode('x', varRef('outer_xs'), outerBody);
    const result = render(template(outerFor), { outer_xs: [1], inner_xs: [2] });
    expect(result.success).toBe(true);
    expect(result.output).toBe('991');
  });

  it('new variable in a for-loop scope writes to the innermost scope (branch 3)', () => {
    // 'fresh' does not exist anywhere; scopes is non-empty (for-loop pushed one)
    // → SetNodeRenderer writes to innermost scope, not context.data
    const body: ASTNode[] = [setNode('fresh', lit('yes')), exprStmt(varRef('fresh'))];
    const data: Record<string, unknown> = { items: [1] };
    const result = render(template(forNode('item', varRef('items'), body)), data);
    expect(result.output).toBe('yes');
    expect(Object.prototype.hasOwnProperty.call(data, 'fresh')).toBe(false);
  });

  // Read-back and side-effect isolation
  it('set variable is readable by a subsequent expression statement', () => {
    const ast = template(setNode('x', lit(42)), exprStmt(varRef('x')));
    const data: Record<string, unknown> = {};
    const result = render(ast, data);
    expect(result.output).toBe('42');
    expect(data['x']).toBe(42);
  });

  it('evaluates a variable reference as the set value', () => {
    const ast = template(setNode('b', varRef('a')));
    const data: Record<string, unknown> = { a: 'source' };
    render(ast, data);
    expect(data['b']).toBe('source');
  });

  it('does not disturb unrelated keys in context.data', () => {
    const data: Record<string, unknown> = { y: 'unchanged', z: 99 };
    render(template(setNode('x', lit('new'))), data);
    expect(data['x']).toBe('new');
    expect(data['y']).toBe('unchanged');
    expect(data['z']).toBe(99);
  });

  it('last set wins when the same variable is set twice in sequence', () => {
    const data: Record<string, unknown> = {};
    render(template(setNode('v', lit('first')), setNode('v', lit('second'))), data);
    expect(data['v']).toBe('second');
  });

  // Error boundary: variable reference that cannot be resolved
  it('records an undefined_variable error and assigns undefined when the value is a nonexistent variable', () => {
    const data: Record<string, unknown> = {};
    const result = render(template(setNode('x', varRef('nonexistent'))), data);
    // undefined_variable is not a runtime_error, so the render is still considered successful
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe('undefined_variable');
    expect(result.errors[0].message).toContain('nonexistent');
    expect(result.output).toBe('');
    expect(data['x']).toBeUndefined();
  });
});

describe('ForNodeRenderer', () => {
  // Empty-iterable boundary: forEach iterates zero times → no output, no errors
  it('produces no output and no errors when iterating over an empty array', () => {
    const ast = template(forNode('item', varRef('items'), [exprStmt(varRef('item'))]));
    const result = render(ast, { items: [] });
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.output).toBe('');
  });
});

describe('Renderer edge cases', () => {
  it('records runtime error for unknown or invalid AST node input', () => {
    const result = render(null as unknown as ASTNode, {});

    expect(result.success).toBe(false);
    expect(result.output).toBe('');
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'runtime_error',
          message: 'Unknown or invalid AST node',
        }),
      ])
    );
  });

  it('records type error for non-array for iterable when throwOnError is false', () => {
    const ast = template(forNode('item', varRef('items'), [exprStmt(varRef('item'))]));
    const result = render(ast, { items: 'not-an-array' });

    expect(result.success).toBe(true);
    expect(result.output).toBe('');
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'type_error',
          path: 'for.iterable',
        }),
      ])
    );
  });

  it('throws for non-array for iterable when throwOnError is true', () => {
    const ast = template(forNode('item', varRef('items'), [exprStmt(varRef('item'))]));

    expect(() => render(ast, { items: 'not-an-array' }, { throwOnError: true })).toThrow(
      'Cannot iterate over non-array value: string'
    );
  });

  it('records max-depth runtime error when loop nesting exceeds maxDepth', () => {
    const ast = template(forNode('item', varRef('items'), [exprStmt(varRef('item'))]));
    const result = render(ast, { items: [1] }, { maxDepth: 0 });

    expect(result.success).toBe(false);
    expect(result.output).toBe('');
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'runtime_error',
          path: 'for',
          message: 'Maximum nesting depth exceeded',
        }),
      ])
    );
  });

  it('records runtime error for invalid set variable name when throwOnError is false', () => {
    const invalidSet = {
      type: 'set',
      name: '1notValid',
      value: lit(1),
      start: POS,
      end: POS,
    } as unknown as ASTNode;
    const result = render(template(invalidSet), {});

    expect(result.success).toBe(false);
    expect(result.output).toBe('');
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'runtime_error',
          path: 'set.name',
          message: expect.stringContaining('Invalid or missing variable name for set statement'),
        }),
      ])
    );
  });

  it('throws for invalid set variable name when throwOnError is true', () => {
    const invalidSet = {
      type: 'set',
      name: '1notValid',
      value: lit(1),
      start: POS,
      end: POS,
    } as unknown as ASTNode;

    expect(() => render(template(invalidSet), {}, { throwOnError: true })).toThrow(
      'Invalid or missing variable name for set statement'
    );
  });

  it('records runtime error when evaluating set value throws unexpectedly', () => {
    const badValueExpr = {
      get type() {
        throw new Error('set value exploded');
      },
      start: POS,
      end: POS,
    } as unknown;

    const badSet = {
      type: 'set',
      name: 'safeName',
      value: badValueExpr,
      start: POS,
      end: POS,
    } as unknown as ASTNode;

    const result = render(template(badSet), {});
    expect(result.success).toBe(false);
    expect(result.output).toBe('');
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'runtime_error',
          path: 'set.value',
          message: 'Error evaluating set value for "safeName": set value exploded',
        }),
      ])
    );

    expect(() => render(template(badSet), {}, { throwOnError: true })).toThrow(
      'set value exploded'
    );
  });
});
