import type { ServicePlugin, ServiceEnvironment, ServiceContext } from '@volar/language-service';
import type { Diagnostic } from '@volar/language-service';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { getLanguageService as getHtmlLanguageService } from 'vscode-html-languageservice/lib/esm/htmlLanguageService';
import { getLanguageService as getJsonLanguageService } from 'vscode-json-languageservice/lib/esm/jsonLanguageService';
import {
  createLanguageService as createMarkdownLanguageService,
  githubSlugifier,
  LogLevel,
  DiagnosticLevel,
} from 'vscode-markdown-languageservice';
import MarkdownIt from 'markdown-it';
import matter from 'gray-matter';
import { TempljsServicePlugin, type IntellisenseOptions } from '@templjs/volar';

type PluginOptions = {
  getIntellisenseOptions: (sourceUri: string) => IntellisenseOptions;
  workspaceFolder?: string;
};

function getSourceFileInfo(context: ServiceContext, uri: string) {
  const [, sourceFile] = context.documents.getVirtualCodeByUri(uri);
  if (sourceFile) {
    return sourceFile;
  }
  return context.language.files.get(uri);
}

function getSourceUri(context: ServiceContext, uri: string): string {
  return getSourceFileInfo(context, uri)?.id ?? uri;
}

function getSourceLanguageId(context: ServiceContext, uri: string): string | undefined {
  return getSourceFileInfo(context, uri)?.languageId;
}

function isTempljsDocument(
  context: ServiceContext,
  document: { uri: string; languageId: string }
): boolean {
  if (document.languageId.startsWith('templjs-')) {
    return true;
  }

  return getSourceLanguageId(context, document.uri)?.startsWith('templjs-') ?? false;
}

function isLanguageDocument(
  context: ServiceContext,
  document: { uri: string; languageId: string },
  languageId: 'html' | 'json' | 'markdown'
): boolean {
  if (document.languageId === languageId) {
    return true;
  }

  const sourceLanguageId = getSourceLanguageId(context, document.uri);
  return sourceLanguageId === languageId || sourceLanguageId === `templjs-${languageId}`;
}

function noopEvent() {
  return () => ({ dispose() {} });
}

function resolveReference(base: string, ref: string): string {
  try {
    return new URL(ref, base).toString();
  } catch {
    return ref;
  }
}

async function readResource(env: ServiceEnvironment, uri: string): Promise<string | undefined> {
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const response = await fetch(uri);
    if (!response.ok) {
      return undefined;
    }
    return await response.text();
  }

  return await Promise.resolve(env.fs?.readFile(uri));
}

function createTempljsAdditionalPlugin(options: PluginOptions): ServicePlugin {
  const templjs = new TempljsServicePlugin();

  return {
    name: 'templjs-intellisense',
    triggerCharacters: ['.', '|'],
    create(context) {
      return {
        isAdditionalCompletion: true,
        provideCompletionItems(document, position) {
          if (!isTempljsDocument(context, document)) {
            return;
          }

          const sourceUri = getSourceUri(context, document.uri);
          const items = templjs.getCompletions(
            document.getText(),
            document.offsetAt(position),
            options.getIntellisenseOptions(sourceUri)
          );

          return {
            isIncomplete: false,
            items: items.map((item) => ({
              ...item,
              kind: item.kind as 1,
            })),
          };
        },
        provideHover(document, position) {
          if (!isTempljsDocument(context, document)) {
            return;
          }

          const sourceUri = getSourceUri(context, document.uri);
          return templjs.getHover(
            document.getText(),
            document.offsetAt(position),
            options.getIntellisenseOptions(sourceUri)
          );
        },
        provideDefinition(document, position) {
          if (!isTempljsDocument(context, document)) {
            return;
          }

          const sourceUri = getSourceUri(context, document.uri);
          const definition = templjs.getDefinition(
            document.getText(),
            document.offsetAt(position),
            options.getIntellisenseOptions(sourceUri)
          );

          if (!definition) {
            return;
          }

          return [
            {
              targetUri: definition.uri,
              targetRange: definition.range,
              targetSelectionRange: definition.range,
            },
          ];
        },
      };
    },
  };
}

function createHtmlPlugin(): ServicePlugin {
  const html = getHtmlLanguageService();

  return {
    name: 'templjs-html',
    triggerCharacters: ['<', ':', '@', '/', '.', '"', "'", '='],
    create(context) {
      return {
        provideCompletionItems(document, position) {
          if (!isLanguageDocument(context, document, 'html')) {
            return;
          }
          const parsed = html.parseHTMLDocument(document);
          return html.doComplete(document, position, parsed);
        },
        provideHover(document, position) {
          if (!isLanguageDocument(context, document, 'html')) {
            return;
          }
          const parsed = html.parseHTMLDocument(document);
          return html.doHover(document, position, parsed) ?? undefined;
        },
        provideDocumentFormattingEdits(document, _range, options) {
          if (!isLanguageDocument(context, document, 'html')) {
            return;
          }
          return html.format(document, undefined, options);
        },
        provideDocumentLinks(document) {
          if (!isLanguageDocument(context, document, 'html')) {
            return;
          }
          return html.findDocumentLinks(document, {
            resolveReference: (ref, base) => resolveReference(base, ref),
          });
        },
        provideFoldingRanges(document) {
          if (!isLanguageDocument(context, document, 'html')) {
            return;
          }
          return html.getFoldingRanges(document);
        },
      };
    },
  };
}

function createJsonPlugin(): ServicePlugin {
  return {
    name: 'templjs-json',
    triggerCharacters: ['"', ':'],
    create(context) {
      const json = getJsonLanguageService({
        schemaRequestService: (uri) => readResource(context.env, uri).then((value) => value ?? ''),
      });

      return {
        async provideCompletionItems(document, position) {
          if (!isLanguageDocument(context, document, 'json')) {
            return;
          }
          const parsed = json.parseJSONDocument(document);
          return (await json.doComplete(document, position, parsed)) ?? undefined;
        },
        async provideHover(document, position) {
          if (!isLanguageDocument(context, document, 'json')) {
            return;
          }
          const parsed = json.parseJSONDocument(document);
          return (await json.doHover(document, position, parsed)) ?? undefined;
        },
        async provideDefinition(document, position) {
          if (!isLanguageDocument(context, document, 'json')) {
            return;
          }
          const parsed = json.parseJSONDocument(document);
          return (await json.findDefinition(document, position, parsed)) ?? undefined;
        },
        async provideDocumentLinks(document) {
          if (!isLanguageDocument(context, document, 'json')) {
            return;
          }
          const parsed = json.parseJSONDocument(document);
          return (await json.findLinks(document, parsed)) ?? undefined;
        },
        async provideDiagnostics(document) {
          if (!isLanguageDocument(context, document, 'json')) {
            return;
          }
          const parsed = json.parseJSONDocument(document);
          return await json.doValidation(document, parsed);
        },
        provideDocumentFormattingEdits(document, _range, options) {
          if (!isLanguageDocument(context, document, 'json')) {
            return;
          }
          return json.format(document, undefined, options);
        },
      };
    },
  };
}

function createMarkdownPlugin(workspaceFolder: string | undefined): ServicePlugin {
  const parser = new MarkdownIt();

  return {
    name: 'templjs-markdown',
    triggerCharacters: ['[', ']', '(', ')', '#', '/'],
    create(context) {
      const workspaceUri = workspaceFolder ? URI.file(workspaceFolder) : undefined;
      const workspace = {
        workspaceFolders: workspaceUri ? [workspaceUri] : [],
        onDidChangeMarkdownDocument: noopEvent(),
        onDidCreateMarkdownDocument: noopEvent(),
        onDidDeleteMarkdownDocument: noopEvent(),
        async getAllMarkdownDocuments() {
          return [];
        },
        hasMarkdownDocument(resource: URI) {
          return !!context.language.files.get(resource.toString());
        },
        async openMarkdownDocument(resource: URI) {
          const existing = context.language.files.get(resource.toString());
          if (existing) {
            return TextDocument.create(
              existing.id,
              'markdown',
              0,
              existing.snapshot.getText(0, existing.snapshot.getLength())
            );
          }
          const text = await readResource(context.env, resource.toString());
          if (text === undefined) {
            return undefined;
          }
          return TextDocument.create(resource.toString(), 'markdown', 0, text);
        },
        async stat(resource: URI) {
          const stat = await Promise.resolve(context.env.fs?.stat(resource.toString()));
          if (!stat) {
            return undefined;
          }
          return { isDirectory: stat.type === 2 };
        },
        async readDirectory(resource: URI) {
          const entries =
            (await Promise.resolve(context.env.fs?.readDirectory(resource.toString()))) ?? [];
          return entries.map(([name, stat]) => [name, { isDirectory: stat === 2 }] as const);
        },
      };

      const markdown = createMarkdownLanguageService({
        workspace,
        parser: {
          slugifier: githubSlugifier,
          async tokenize(document) {
            return parser.parse(document.getText(), {}) as never[];
          },
        },
        logger: {
          get level() {
            return LogLevel.Off;
          },
          log() {},
        },
        markdownFileExtensions: ['md', 'md.templ', 'md.tmpl', 'md.tpl'],
        knownLinkedToFileExtensions: ['md', 'templ', 'tmpl', 'tpl'],
        excludePaths: [],
      });

      return {
        async provideCompletionItems(document, position, completionContext, token) {
          if (!isLanguageDocument(context, document, 'markdown')) {
            return;
          }
          const items = await markdown.getCompletionItems(document, position, {}, token);
          return { isIncomplete: false, items };
        },
        async provideDefinition(document, position, token) {
          if (!isLanguageDocument(context, document, 'markdown')) {
            return;
          }
          const definition = await markdown.getDefinition(document, position, token);
          if (!definition) {
            return;
          }
          const definitions = Array.isArray(definition) ? definition : [definition];
          return definitions.map((item) => ({
            targetUri: item.uri,
            targetRange: item.range,
            targetSelectionRange: item.range,
          }));
        },
        async provideDocumentLinks(document, token) {
          if (!isLanguageDocument(context, document, 'markdown')) {
            return;
          }
          return await markdown.getDocumentLinks(document, token);
        },
        async provideDiagnostics(document, token) {
          if (!isLanguageDocument(context, document, 'markdown')) {
            return;
          }
          const linkDiagnostics =
            (await markdown.computeDiagnostics(
              document,
              {
                validateReferences: DiagnosticLevel.warning,
                validateFragmentLinks: DiagnosticLevel.warning,
                validateFileLinks: DiagnosticLevel.warning,
                validateMarkdownFileLinkFragments: DiagnosticLevel.warning,
                validateUnusedLinkDefinitions: DiagnosticLevel.ignore,
                validateDuplicateLinkDefinitions: DiagnosticLevel.warning,
                ignoreLinks: [],
              },
              token
            )) ?? [];

          const frontmatterDiagnostics: Diagnostic[] = [];
          const content = document.getText();
          if (content.startsWith('---')) {
            try {
              matter(content);
            } catch (err) {
              if (err instanceof Error) {
                const yamlErr = err as Error & {
                  mark?: { line: number; column: number };
                  reason?: string;
                };
                const line = yamlErr.mark?.line ?? 0;
                const col = yamlErr.mark?.column ?? 0;
                frontmatterDiagnostics.push({
                  message: `YAML frontmatter: ${yamlErr.reason ?? err.message}`,
                  severity: 1, // DiagnosticSeverity.Error
                  range: {
                    start: { line, character: col },
                    end: { line, character: col + 1 },
                  },
                  source: 'markdown',
                  code: 'md.frontmatter.yaml',
                });
              }
            }
          }

          return [...linkDiagnostics, ...frontmatterDiagnostics];
        },
        async provideFoldingRanges(document, token) {
          if (!isLanguageDocument(context, document, 'markdown')) {
            return;
          }
          return await markdown.getFoldingRanges(document, token);
        },
      };
    },
  };
}

export function createServicePlugins(options: PluginOptions): ServicePlugin[] {
  return [
    createHtmlPlugin(),
    createJsonPlugin(),
    createMarkdownPlugin(options.workspaceFolder),
    createTempljsAdditionalPlugin(options),
  ];
}
