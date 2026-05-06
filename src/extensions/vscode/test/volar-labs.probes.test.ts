import { describe, expect, it } from 'vitest';
import { createTempljsLanguagePlugin } from '@templjs/volar';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { createServicePlugins } from '../src/service-plugins';

function createVirtualTemplContext(uri: string, sourceLanguageId: string, sourceText: string) {
  const sourceScript = {
    id: URI.parse(uri),
    languageId: sourceLanguageId,
    snapshot: {
      getText: () => sourceText,
      getLength: () => sourceText.length,
    },
  };

  return {
    decodeEmbeddedDocumentUri: (embeddedUri: URI) => {
      return embeddedUri.toString().includes('virtualCodeId=root')
        ? [URI.parse(uri), 'root']
        : undefined;
    },
    documents: {
      getVirtualCodeByUri: () => [{ id: 'root' }, sourceScript],
    },
    language: {
      scripts: {
        get: () => sourceScript,
      },
      files: {
        get: () => undefined,
      },
    },
  } as never;
}

describe('volar-labs probes', () => {
  it('probe: host virtual code is transparent and source-mapped for markdown frontmatter/content', () => {
    const plugin = createTempljsLanguagePlugin();
    const sourceText = [
      '---',
      'title: "{{ front.title }}"',
      '---',
      '',
      '# Title',
      '{% if true %}',
      'Body',
      '{% endif %}',
    ].join('\n');

    const virtualCode = plugin.createVirtualCode(
      'file:///workspace/invalid_example.md.tmpl',
      'templjs-markdown',
      {
        getText: () => sourceText,
        getLength: () => sourceText.length,
        getChangeRange: () => undefined,
      }
    );

    const host = virtualCode.embeddedCodes.find((code) => code.id === 'host.markdown');
    const frontmatter = virtualCode.embeddedCodes.find((code) => code.id === 'frontmatter.yaml');

    expect(host).toBeDefined();
    expect(frontmatter).toBeUndefined();

    const hostText = host?.snapshot.getText(0, host.snapshot.getLength()) ?? '';

    expect(hostText).not.toContain('{{');
    expect(hostText).not.toContain('{%');
    expect(host?.mappings[0]?.sourceOffsets[0]).toBe(0);
  });

  it('probe: captures markdown/yaml authoring signal matrix for hover and definition', () => {
    const plugin = createServicePlugins({
      getIntellisenseOptions: (sourceUri) => ({ documentUri: sourceUri }),
      getDiagnosticOptions: () => ({}),
    }).find((candidate) => candidate.name === 'templjs-intellisense');

    expect(plugin).toBeDefined();

    const scenarios = [
      {
        uri: 'file:///workspace/invalid_example.md.tmpl',
        sourceLanguageId: 'templjs-markdown',
        virtualLanguageId: 'markdown',
        sourceText: ['## Subtitle', '{% for x in collection %}', '{{ x }}', '{% endfor %}'].join(
          '\n'
        ),
        position: { line: 2, character: 3 },
      },
      {
        uri: 'file:///workspace/invalid_example.yaml.tmpl',
        sourceLanguageId: 'templjs-yaml',
        virtualLanguageId: 'yaml',
        sourceText: ['{% for c in id %}', '{{ c }}', '{% endfor %}'].join('\n'),
        position: { line: 1, character: 3 },
      },
    ] as const;

    const probeMatrix: Array<{ uri: string; hasHover: boolean; hasDefinition: boolean }> = [];

    for (const scenario of scenarios) {
      const virtualDoc = TextDocument.create(
        `${scenario.uri}?virtualCodeId=root`,
        scenario.virtualLanguageId,
        1,
        scenario.sourceText
      );
      const intellisense = plugin!.create(
        createVirtualTemplContext(scenario.uri, scenario.sourceLanguageId, scenario.sourceText)
      );

      const hover = intellisense.provideHover?.(
        virtualDoc as never,
        scenario.position as never,
        undefined as never
      );
      const definition = intellisense.provideDefinition?.(
        virtualDoc as never,
        scenario.position as never,
        undefined as never
      );

      probeMatrix.push({
        uri: scenario.uri,
        hasHover: Boolean(hover),
        hasDefinition: Boolean(definition),
      });

      expect(hover).toBeDefined();
      expect(definition).toBeDefined();
    }

    expect(probeMatrix).toHaveLength(2);
    expect(probeMatrix.every((probe) => probe.hasHover)).toBe(true);
    expect(probeMatrix.every((probe) => probe.hasDefinition)).toBe(true);
  });

  it('probe: yaml diagnostics are skipped for templjs-yaml source docs', async () => {
    const plugin = createServicePlugins({
      getIntellisenseOptions: () => ({}),
      getDiagnosticOptions: () => ({}),
    }).find((candidate) => candidate.name === 'templjs-yaml');

    expect(plugin).toBeDefined();

    const sourceText = ['test: yaml block', '{% for c in id %}', '{{ c }}', '{% endfor %}'].join(
      '\n'
    );
    const doc = TextDocument.create(
      'file:///workspace/invalid_example.yaml.tmpl',
      'templjs-yaml',
      1,
      sourceText
    );

    const diagnostics = await plugin!
      .create({
        documents: {
          getVirtualCodeByUri: () => [undefined, undefined],
        },
        language: {
          files: {
            get: () => undefined,
          },
        },
      } as never)
      .provideDiagnostics?.(doc as never, undefined as never);

    expect(diagnostics).toBeUndefined();
  });
});
