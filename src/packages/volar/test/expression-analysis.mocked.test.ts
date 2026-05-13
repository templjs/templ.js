import { beforeEach, describe, expect, it, vi } from 'vitest';

const variableMock = vi.fn();
const filterMock = vi.fn();

vi.mock('@templjs/core', () => ({
  extractExpressionVariableReferences: variableMock,
  extractExpressionFilterReferences: filterMock,
}));

const { extractExpressionFilterReferences, extractExpressionVariableReferences } =
  await import('../src/expression-analysis.js');

describe('expression-analysis mocked branches', () => {
  beforeEach(() => {
    variableMock.mockReset();
    filterMock.mockReset();
  });

  it('forwards variable extraction calls to core', () => {
    variableMock.mockReturnValue([{ path: 'user.name', start: 0, end: 9 }]);

    const refs = extractExpressionVariableReferences('user.name');

    expect(variableMock).toHaveBeenCalledWith('user.name');
    expect(refs).toEqual([{ path: 'user.name', start: 0, end: 9 }]);
  });

  it('forwards filter extraction calls to core', () => {
    filterMock.mockReturnValue([{ name: 'lower', start: 12, end: 17 }]);

    const refs = extractExpressionFilterReferences('user.name | lower');

    expect(filterMock).toHaveBeenCalledWith('user.name | lower');
    expect(refs).toEqual([{ name: 'lower', start: 12, end: 17 }]);
  });
});
