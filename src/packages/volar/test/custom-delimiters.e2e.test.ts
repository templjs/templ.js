import { describe, expect, it } from 'vitest';
import { createTempljsLanguagePlugin, extractSemanticTokens } from '../src/index.js';
import { collectDiagnostics } from '../src/diagnostic-provider.js';
import { IntellisenseProvider } from '../src/intellisense-provider.js';

describe('Custom Delimiters E2E', () => {
  const delimiters = {
    statementStart: '<<',
    statementEnd: '>>',
    expressionStart: '<:',
    expressionEnd: ':>',
    commentStart: '<#',
    commentEnd: '#>',
  } as const;

  const schema = {
    type: 'object',
    properties: {
      user: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      },
    },
  };

  it('supports custom delimiters across virtual code, diagnostics, intellisense, and semantic tokens', () => {
    const plugin = createTempljsLanguagePlugin({ delimiters });
    const provider = new IntellisenseProvider();

    const initialContent = [
      '<# template comment #>',
      '<< if user.name >>',
      'Hello <: user.name :>',
      '<< endif >>',
    ].join('\n');

    const initialSnapshot = {
      getText: (start?: number, end?: number) => {
        if (start === undefined || end === undefined) return initialContent;
        return initialContent.slice(start, end);
      },
      getLength: () => initialContent.length,
      getChangeRange: () => undefined,
    };

    const virtualCode = plugin.createVirtualCode(
      'file:///custom.e2e.md.tmpl',
      'templjs-markdown',
      initialSnapshot
    );

    if (!virtualCode) {
      throw new Error('Failed to create initial virtual code');
    }

    const virtualAccess = virtualCode as unknown as { cleaned: string };
    expect(virtualAccess.cleaned).not.toContain('<<');
    expect(virtualAccess.cleaned).not.toContain('>>');
    expect(virtualAccess.cleaned).not.toContain('<:');
    expect(virtualAccess.cleaned).not.toContain(':>');
    expect(virtualAccess.cleaned).not.toContain('<#');
    expect(virtualAccess.cleaned).not.toContain('#>');

    const target = 'Hello <: user.name :>';
    const replacement = 'Hello <: user.name :>!';
    const start = initialContent.indexOf(target);
    const updatedContent =
      initialContent.slice(0, start) + replacement + initialContent.slice(start + target.length);

    const updateSnapshot = {
      getText: (snapshotStart?: number, snapshotEnd?: number) => {
        if (snapshotStart === undefined || snapshotEnd === undefined) return updatedContent;
        return updatedContent.slice(snapshotStart, snapshotEnd);
      },
      getLength: () => updatedContent.length,
      getChangeRange: (oldSnapshot?: unknown) => {
        if (!oldSnapshot || oldSnapshot === initialSnapshot) {
          return {
            span: { start, length: target.length },
            newLength: replacement.length,
          };
        }
        return undefined;
      },
    };

    const updated = plugin.updateVirtualCode(
      'file:///custom.e2e.md.tmpl',
      virtualCode,
      updateSnapshot
    );
    expect(updated.snapshot).not.toBe(updateSnapshot);
    expect(updated.snapshot.getLength()).toBeGreaterThan(0);

    const diagnostics = collectDiagnostics(updatedContent, { schema, delimiters });
    expect(diagnostics).toHaveLength(0);

    const completions = provider.getCompletions('Hello <: us :>', 10, {
      schema,
      delimiters,
    });
    expect(completions.some((item) => item.label === 'user')).toBe(true);

    const hover = provider.getHover('Hello <: user.name :>', 10, {
      schema,
      delimiters,
    });
    expect(hover?.contents).toContain('user.name');

    const semanticTokens = extractSemanticTokens(updatedContent, delimiters);
    expect(semanticTokens.some((token) => token.type === 'comment')).toBe(true);
    expect(semanticTokens.some((token) => token.type === 'keyword')).toBe(true);
    expect(semanticTokens.some((token) => token.type === 'variable')).toBe(true);
  });
});
