import { beforeEach, describe, expect, it, vi } from 'vitest';

class MockEventEmitter<T> {
  readonly event = vi.fn();
  fire = vi.fn((_value: T) => {});
  dispose = vi.fn();
}

class MockUri {
  constructor(
    public readonly scheme: string,
    public readonly authority: string,
    public readonly path: string,
    public readonly fsPath: string
  ) {}

  toString() {
    return `${this.scheme}://${this.authority}${this.path}`;
  }

  static from(parts: { scheme: string; authority?: string; path: string }) {
    return new MockUri(parts.scheme, parts.authority ?? '', parts.path, parts.path);
  }

  static file(path: string) {
    return new MockUri('file', '', path, path);
  }
}

class MockPosition {
  constructor(
    public readonly line: number,
    public readonly character: number
  ) {}
}

class MockRange {
  constructor(
    public readonly start: MockPosition,
    public readonly end: MockPosition
  ) {}
}

class MockDiagnostic {
  source?: string;
  code?: string | number;
  tags?: number[];
  relatedInformation?: unknown[];

  constructor(
    public readonly range: MockRange,
    public readonly message: string,
    public readonly severity?: number
  ) {}
}

const cleanTemplateContent = vi.fn((text: string) => ({
  cleaned: text.replace(/\{\{[^}]+\}\}/g, '        '),
  originalToCleanedOffsets: Array.from({ length: text.length + 1 }, (_, index) => index),
}));

vi.mock('vscode', () => ({
  EventEmitter: MockEventEmitter,
  Uri: MockUri,
  Position: MockPosition,
  Range: MockRange,
  Diagnostic: MockDiagnostic,
}));

vi.mock('@templjs/volar', () => ({
  cleanTemplateContent,
}));

describe('TempljsVirtualDocumentProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates virtual documents, serves cleaned content, and tracks entries', async () => {
    const { TempljsVirtualDocumentProvider, VIRTUAL_SCHEME } =
      await import('../src/virtual-document-provider');
    const provider = new TempljsVirtualDocumentProvider();
    const sourceUri = MockUri.file('/workspace/page.md.templ');

    const virtualUri = provider.update(sourceUri as never, 'Hello {{ name }}');

    expect(cleanTemplateContent).toHaveBeenCalledWith('Hello {{ name }}');
    expect(virtualUri.scheme).toBe(VIRTUAL_SCHEME);
    expect(virtualUri.path).toBe('/workspace/page.md.templ.md');
    expect(provider.hasEntry(sourceUri as never)).toBe(true);
    expect(provider.provideTextDocumentContent(virtualUri as never)).toBe('Hello         ');
    expect(provider.toSourceUri(virtualUri as never).fsPath).toBe('/workspace/page.md.templ');
    expect(provider.isVirtualUri(virtualUri as never)).toBe(true);
    expect(provider.isVirtualUri(sourceUri as never)).toBe(false);
    provider.dispose();
  });

  it('maps diagnostics back to the source document and preserves metadata', async () => {
    const { TempljsVirtualDocumentProvider } = await import('../src/virtual-document-provider');
    const provider = new TempljsVirtualDocumentProvider();
    const sourceUri = MockUri.file('/workspace/data.yaml.templ');

    provider.update(sourceUri as never, 'title: test\nvalue: {{ item }}\n');

    const diagnostic = new MockDiagnostic(
      new MockRange(new MockPosition(1, 3), new MockPosition(1, 8)),
      'bad value',
      1
    );
    diagnostic.source = 'yaml';
    diagnostic.code = 'YAML001';
    diagnostic.tags = [1];
    diagnostic.relatedInformation = [{ message: 'related' }];

    const mapped = provider.mapDiagnosticToSource(sourceUri as never, diagnostic as never);

    expect(mapped?.message).toBe('bad value');
    expect(mapped?.severity).toBe(1);
    expect(mapped?.source).toBe('yaml');
    expect(mapped?.code).toBe('YAML001');
    expect(mapped?.tags).toEqual([1]);
    expect(mapped?.relatedInformation).toEqual([{ message: 'related' }]);
    expect(mapped?.range.start.line).toBe(1);
    expect(mapped?.range.end.line).toBe(1);
  });

  it('returns undefined for unmapped diagnostics and supports entry removal', async () => {
    const { TempljsVirtualDocumentProvider } = await import('../src/virtual-document-provider');
    const provider = new TempljsVirtualDocumentProvider();
    const sourceUri = MockUri.file('/workspace/notes.txt.templ');
    const virtualUri = provider.toVirtualUri(sourceUri as never);

    expect(provider.provideTextDocumentContent(virtualUri as never)).toBe('');
    expect(
      provider.mapDiagnosticToSource(
        sourceUri as never,
        new MockDiagnostic(
          new MockRange(new MockPosition(4, 0), new MockPosition(4, 2)),
          'missing',
          1
        ) as never
      )
    ).toBeUndefined();

    provider.update(sourceUri as never, 'plain text');
    provider.remove(sourceUri as never);
    expect(provider.hasEntry(sourceUri as never)).toBe(false);
    expect(
      provider.mapDiagnosticToSource(
        sourceUri as never,
        new MockDiagnostic(
          new MockRange(new MockPosition(0, 0), new MockPosition(0, 1)),
          'missing',
          1
        ) as never
      )
    ).toBeUndefined();
  });

  it('maps markdown templates and leaves unknown virtual extensions untouched on reverse mapping', async () => {
    const { TempljsVirtualDocumentProvider } = await import('../src/virtual-document-provider');
    const provider = new TempljsVirtualDocumentProvider();

    const markdownVirtual = provider.toVirtualUri(
      MockUri.file('/workspace/readme.markdown.templ') as never
    );
    expect(markdownVirtual.path).toBe('/workspace/readme.markdown.templ.md');
    expect(provider.toVirtualUri(MockUri.file('/workspace/readme.md.templ') as never).path).toBe(
      '/workspace/readme.md.templ.md'
    );
    expect(provider.toVirtualUri(MockUri.file('/workspace/data.json.templ') as never).path).toBe(
      '/workspace/data.json.templ.json'
    );
    expect(provider.toVirtualUri(MockUri.file('/workspace/data.yaml.templ') as never).path).toBe(
      '/workspace/data.yaml.templ.yaml'
    );
    expect(provider.toVirtualUri(MockUri.file('/workspace/page.html.templ') as never).path).toBe(
      '/workspace/page.html.templ.html'
    );
    expect(provider.toVirtualUri(MockUri.file('/workspace/notes.tpl') as never).path).toBe(
      '/workspace/notes.tpl.txt'
    );
    expect(
      provider.toSourceUri(
        MockUri.from({ scheme: 'templjs-virtual', authority: 'host', path: '/x.md' }) as never
      ).fsPath
    ).toBe('/x');
    expect(
      provider.toSourceUri(
        MockUri.from({ scheme: 'templjs-virtual', authority: 'host', path: '/x.json' }) as never
      ).fsPath
    ).toBe('/x');
    expect(
      provider.toSourceUri(
        MockUri.from({ scheme: 'templjs-virtual', authority: 'host', path: '/x.yaml' }) as never
      ).fsPath
    ).toBe('/x');
    expect(
      provider.toSourceUri(
        MockUri.from({ scheme: 'templjs-virtual', authority: 'host', path: '/x.html' }) as never
      ).fsPath
    ).toBe('/x');
    expect(
      provider.toSourceUri(
        MockUri.from({ scheme: 'templjs-virtual', authority: 'host', path: '/x.txt' }) as never
      ).fsPath
    ).toBe('/x');

    const customVirtual = MockUri.from({
      scheme: 'templjs-virtual',
      authority: 'host',
      path: '/workspace/file.templ.custom',
    });
    expect(provider.toSourceUri(customVirtual as never).fsPath).toBe(
      '/workspace/file.templ.custom'
    );

    const windowsVirtual = new MockUri(
      'templjs-virtual',
      'host',
      '/C:/workspace/page.md.templ.md',
      'C:\\workspace\\page.md.templ.md'
    );
    expect(provider.toSourceUri(windowsVirtual as never).fsPath).toBe(
      'C:\\workspace\\page.md.templ'
    );
  });

  it('fills source offset gaps when cleaned mappings contain duplicates or out-of-range values', async () => {
    cleanTemplateContent.mockImplementationOnce(() => ({
      cleaned: 'abc',
      originalToCleanedOffsets: [0, 0, 2, 99, 3],
    }));

    const { TempljsVirtualDocumentProvider } = await import('../src/virtual-document-provider');
    const provider = new TempljsVirtualDocumentProvider();
    const sourceUri = MockUri.file('/workspace/gaps.md.templ');
    provider.update(sourceUri as never, 'abcd');

    const mapped = provider.mapDiagnosticToSource(
      sourceUri as never,
      new MockDiagnostic(
        new MockRange(new MockPosition(0, 1), new MockPosition(0, 2)),
        'gap',
        1
      ) as never
    );

    expect(mapped?.range.start.character).toBe(0);
    expect(mapped?.range.end.character).toBe(2);
  });

  it('returns undefined when a mapped diagnostic references an unknown line or source offset', async () => {
    cleanTemplateContent.mockImplementationOnce(() => ({
      cleaned: 'abc',
      originalToCleanedOffsets: [0, 1, 2, 3],
    }));

    const { TempljsVirtualDocumentProvider } = await import('../src/virtual-document-provider');
    const provider = new TempljsVirtualDocumentProvider();
    const sourceUri = MockUri.file('/workspace/edges.md.templ');
    provider.update(sourceUri as never, 'abc');

    expect(
      provider.mapDiagnosticToSource(
        sourceUri as never,
        new MockDiagnostic(
          new MockRange(new MockPosition(4, 0), new MockPosition(4, 1)),
          'bad line',
          1
        ) as never
      )
    ).toBeUndefined();

    cleanTemplateContent.mockImplementationOnce(() => ({
      cleaned: 'a',
      originalToCleanedOffsets: [0],
    }));

    const providerWithShortOffsets = new TempljsVirtualDocumentProvider();
    providerWithShortOffsets.update(sourceUri as never, 'a');

    expect(
      providerWithShortOffsets.mapDiagnosticToSource(
        sourceUri as never,
        new MockDiagnostic(
          new MockRange(new MockPosition(0, 5), new MockPosition(0, 5)),
          'bad offset',
          1
        ) as never
      )
    ).toBeUndefined();
  });
});
