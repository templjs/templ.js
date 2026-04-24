import { describe, expect, it } from 'vitest';
import type { ServiceContext } from '@volar/language-service';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createServicePlugins } from '../src/service-plugins';

/**
 * Minimal ServiceContext stub sufficient for the markdown plugin's provideDiagnostics.
 *
 * - isLanguageDocument() returns true when document.languageId === 'markdown', so
 *   context.documents is never consulted for pure-markdown documents.
 * - workspace.hasMarkdownDocument() calls context.language.files.get(), which returns
 *   undefined (no registered files); link validation therefore finds no broken links.
 */
function makeMinimalContext(): ServiceContext {
  return {
    language: {
      files: { get: () => undefined },
    },
  } as unknown as ServiceContext;
}

const noCancellationToken = {
  isCancellationRequested: false,
  onCancellationRequested: () => ({ dispose: () => {} }),
};

describe('createMarkdownPlugin – provideDiagnostics', () => {
  it('returns a YAML frontmatter diagnostic for invalid YAML', async () => {
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
    });
    // Index 2 is createMarkdownPlugin (html=0, json=1, markdown=2, templjs=3).
    const markdownPlugin = plugins[2];
    const service = markdownPlugin.create!(makeMinimalContext());

    // Unclosed brace is unambiguously invalid YAML.
    const content = '---\ntitle: {\n---\n# Content';
    const document = TextDocument.create('file:///test/doc.md', 'markdown', 1, content);

    const diagnostics = await service.provideDiagnostics!(document, noCancellationToken);

    expect(Array.isArray(diagnostics)).toBe(true);
    const frontmatterDiag = diagnostics?.find((d) => d.code === 'md.frontmatter.yaml');
    expect(frontmatterDiag).toBeDefined();
    expect(frontmatterDiag?.severity).toBe(1);
    expect(frontmatterDiag?.source).toBe('markdown');
    expect(frontmatterDiag?.message).toMatch(/YAML frontmatter/);
  });

  it('returns no frontmatter diagnostic for valid YAML frontmatter', async () => {
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
    });
    const markdownPlugin = plugins[2];
    const service = markdownPlugin.create!(makeMinimalContext());

    const content = '---\ntitle: "Hello"\nauthor: Alice\n---\n# Content';
    const document = TextDocument.create('file:///test/doc.md', 'markdown', 1, content);

    const diagnostics = await service.provideDiagnostics!(document, noCancellationToken);

    const frontmatterDiag = diagnostics?.find((d) => d.code === 'md.frontmatter.yaml');
    expect(frontmatterDiag).toBeUndefined();
  });

  it('returns no frontmatter diagnostic for documents without frontmatter', async () => {
    const plugins = createServicePlugins({
      getIntellisenseOptions: () => ({}),
    });
    const markdownPlugin = plugins[2];
    const service = markdownPlugin.create!(makeMinimalContext());

    const content = '# Just a heading\n\nSome content.';
    const document = TextDocument.create('file:///test/doc.md', 'markdown', 1, content);

    const diagnostics = await service.provideDiagnostics!(document, noCancellationToken);

    const frontmatterDiag = diagnostics?.find((d) => d.code === 'md.frontmatter.yaml');
    expect(frontmatterDiag).toBeUndefined();
  });
});
