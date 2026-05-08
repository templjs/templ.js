import type { LanguageServicePlugin, LanguageServiceContext } from '@volar/language-service';
import { URI } from 'vscode-uri';
import {
  collectDiagnostics,
  TempljsServicePlugin,
  type DiagnosticItem,
  type DiagnosticOptions,
  type IntellisenseOptions,
  type LSPCompletionItem,
} from '@templjs/volar';
import { pathToFileURL } from 'url';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { create as createVolarHtmlServicePlugin } from 'volar-service-html';
import { create as createVolarJsonServicePlugin } from 'volar-service-json';
import { create as createVolarYamlServicePlugin } from 'volar-service-yaml';
import { loadSchemaSourceSync, resolveDocumentSchemaSources } from './schema-loading.js';
import {
  createMarkdownHostDiagnosticsAdapter,
  planMarkdownAdapterRuntime,
} from './markdown-adapter.js';
import { createPrettierHostAdapter, planPrettierAdapterRuntime } from './prettier-adapter.js';
import { createYamlHostDiagnosticsAdapter, planYamlAdapterRuntime } from './yaml-adapter.js';
import type { ServicePluginOrchestrationOptions } from './service-plugin-contract.js';
import {
  getConfiguredPrettierHostLanguages,
  resolveAdapterRuntimeManifest,
} from './runtime-manifest.js';

type PluginOptions = ServicePluginOrchestrationOptions;

type ResolvedSchemaOptions = {
  schema?: object;
  schemaUri?: string;
  contentSchema?: object;
  contentSchemaUri?: string;
};

function resolveSchemaOptionsForSource(
  options: PluginOptions,
  sourceUri: string,
  sourceText: string
): ResolvedSchemaOptions {
  const params = {
    rootUri: options.workspaceFolder
      ? pathToFileURL(options.workspaceFolder).toString()
      : undefined,
    initializationOptions: {
      ...options.initializationOptions,
      documentContext: {
        uri: sourceUri,
        content: sourceText,
      },
    },
  };

  const resolvedSources = resolveDocumentSchemaSources(params);
  const schemaOptions: ResolvedSchemaOptions = {};
  const schemaCache = options.schemaCache ?? new Map<string, unknown>();

  options.log?.(
    `[templjs-schema] resolve uri=${sourceUri} schemaPath=${resolvedSources.schemaPath ?? 'none'} contentSchemaPath=${resolvedSources.contentSchemaPath ?? 'none'}`
  );

  if (resolvedSources.schemaPath) {
    Object.assign(
      schemaOptions,
      loadSchemaSourceSync(resolvedSources.schemaPath, options.workspaceFolder, sourceUri, {
        cache: schemaCache,
        loadUrlSync: options.loadSchemaUrlSync,
        log: options.log,
      })
    );
  }

  if (resolvedSources.contentSchemaPath) {
    const contentResult = loadSchemaSourceSync(
      resolvedSources.contentSchemaPath,
      options.workspaceFolder,
      sourceUri,
      {
        cache: schemaCache,
        loadUrlSync: options.loadSchemaUrlSync,
        log: options.log,
      }
    );
    schemaOptions.contentSchema = contentResult.schema;
    schemaOptions.contentSchemaUri = contentResult.schemaUri;
  }

  return schemaOptions;
}

function toIntellisenseOptions(
  options: PluginOptions,
  sourceUri: string,
  sourceText: string
): IntellisenseOptions {
  if (options.getIntellisenseOptions) {
    return options.getIntellisenseOptions(sourceUri, sourceText);
  }

  const schemaOptions = resolveSchemaOptionsForSource(options, sourceUri, sourceText);
  return {
    documentUri: sourceUri,
    workspaceRoot: options.workspaceFolder,
    schema: schemaOptions.schema,
    schemaUri: schemaOptions.schemaUri,
    contentSchema: schemaOptions.contentSchema,
    contentSchemaUri: schemaOptions.contentSchemaUri,
    debugLog: (message: string) => options.log?.(`[templjs-trace] ${sourceUri} ${message}`),
  };
}

function toDiagnosticOptions(
  options: PluginOptions,
  sourceUri: string,
  sourceText: string
): DiagnosticOptions {
  if (options.getDiagnosticOptions) {
    return options.getDiagnosticOptions(sourceUri, sourceText);
  }

  const schemaOptions = resolveSchemaOptionsForSource(options, sourceUri, sourceText);
  return {
    documentUri: sourceUri,
    schema: schemaOptions.schema,
    contentSchema: schemaOptions.contentSchema,
  };
}

function getSourceFileInfo(context: LanguageServiceContext, uri: string) {
  const decoded = context.decodeEmbeddedDocumentUri(URI.parse(uri));
  if (decoded) {
    const [documentUri] = decoded;
    return context.language.scripts.get(documentUri);
  }
  return context.language.scripts.get(URI.parse(uri));
}

function getSourceUri(context: LanguageServiceContext, uri: string): string {
  return getSourceFileInfo(context, uri)?.id?.toString() ?? uri;
}

function getSourceLanguageId(context: LanguageServiceContext, uri: string): string | undefined {
  return getSourceFileInfo(context, uri)?.languageId;
}

type SourceSnapshot = {
  getText: (start: number, end: number) => string;
  getLength: () => number;
};

function getSourceDocumentText(
  context: LanguageServiceContext,
  document: { uri: string; getText: () => string },
  sourceUri: string
): { text: string; fromSource: boolean } {
  if (sourceUri === document.uri) {
    return { text: document.getText(), fromSource: false };
  }

  const sourceFile =
    getSourceFileInfo(context, document.uri) ?? context.language.scripts.get(URI.parse(sourceUri));
  const snapshot = (sourceFile as { snapshot?: SourceSnapshot } | undefined)?.snapshot;
  if (snapshot?.getText && snapshot?.getLength) {
    return {
      text: snapshot.getText(0, snapshot.getLength()),
      fromSource: true,
    };
  }

  return { text: document.getText(), fromSource: false };
}

function getSourceOffsetFromPosition(
  document: {
    uri: string;
    languageId: string;
    offsetAt: (position: { line: number; character: number }) => number;
  },
  position: { line: number; character: number },
  sourceText: { text: string; fromSource: boolean }
): number {
  if (!sourceText.fromSource) {
    return document.offsetAt(position);
  }

  const sourceDocument = createTextDocumentLike(
    `${document.uri}#source`,
    document.languageId,
    sourceText.text
  );

  return sourceDocument.offsetAt(position);
}

function getVirtualCodeId(context: LanguageServiceContext, uri: string): string | undefined {
  const decoded = context.decodeEmbeddedDocumentUri(URI.parse(uri));
  return decoded?.[1];
}

function isMarkdownTempljsLanguage(languageId: string | undefined): boolean {
  return languageId === 'templjs-markdown';
}

function shouldSkipTempljsDiagnostics(
  context: LanguageServiceContext,
  document: { uri: string; languageId: string },
  options: PluginOptions,
  pluginName: string
): { skip: boolean; sourceUri: string; sourceLanguageId: string } {
  options.log?.(`[${pluginName}] enter uri=${document.uri} languageId=${document.languageId}`);

  const virtualCodeId = getVirtualCodeId(context, document.uri);
  if (virtualCodeId && virtualCodeId !== 'root') {
    options.log?.(
      `[${pluginName}] skip reason=virtual-non-root virtualCodeId=${virtualCodeId} uri=${document.uri}`
    );
    return { skip: true, sourceUri: document.uri, sourceLanguageId: document.languageId };
  }

  const sourceUri = getSourceUri(context, document.uri);
  const sourceLanguageId = getSourceLanguageId(context, document.uri) ?? document.languageId;
  options.log?.(`[${pluginName}] source uri=${sourceUri} sourceLanguageId=${sourceLanguageId}`);

  if (!sourceLanguageId.startsWith('templjs-')) {
    options.log?.(
      `[${pluginName}] skip reason=non-templjs sourceLanguageId=${sourceLanguageId} uri=${document.uri}`
    );
    return { skip: true, sourceUri, sourceLanguageId };
  }

  return { skip: false, sourceUri, sourceLanguageId };
}

function isTempljsDocument(
  context: LanguageServiceContext,
  document: { uri: string; languageId: string }
): boolean {
  if (document.languageId.startsWith('templjs-')) {
    return true;
  }

  return getSourceLanguageId(context, document.uri)?.startsWith('templjs-') ?? false;
}

function isYamlDocument(
  context: LanguageServiceContext,
  document: { uri: string; languageId: string }
): boolean {
  const documentLanguage = document.languageId.toLowerCase();
  if (documentLanguage === 'yaml' || documentLanguage === 'templjs-yaml') {
    return true;
  }

  if (/\.ya?ml\.(templ|tmpl|tpl)($|\?)/i.test(document.uri)) {
    return true;
  }

  const sourceLanguageId = getSourceLanguageId(context, document.uri)?.toLowerCase();
  return sourceLanguageId === 'yaml' || sourceLanguageId === 'templjs-yaml';
}

function createTempljsAdditionalPlugin(options: PluginOptions): LanguageServicePlugin {
  const templjs = new TempljsServicePlugin();

  return {
    name: 'templjs-intellisense',
    capabilities: {
      completionProvider: {
        triggerCharacters: ['.', '|'],
      },
      hoverProvider: true,
      definitionProvider: true,
    },
    create(context) {
      return {
        isAdditionalCompletion: true,
        provideCompletionItems(document, position) {
          if (!isTempljsDocument(context, document)) {
            return;
          }

          const sourceUri = getSourceUri(context, document.uri);
          const sourceText = getSourceDocumentText(context, document, sourceUri);
          const offset = getSourceOffsetFromPosition(document, position, sourceText);
          const sourceLanguageId =
            getSourceLanguageId(context, document.uri) ?? document.languageId;
          if (sourceLanguageId === 'templjs-markdown') {
            const fencedRanges = detectMarkdownFencedCodeRanges(sourceText.text);
            if (isOffsetInRanges(offset, fencedRanges)) {
              return;
            }
          }

          const items = templjs.getCompletions(
            sourceText.text,
            offset,
            toIntellisenseOptions(options, sourceUri, sourceText.text)
          );

          return {
            isIncomplete: false,
            items: items.map((item: LSPCompletionItem) => ({
              ...item,
              kind: item.kind as 3 | 6 | 10 | 14,
            })),
          };
        },
        provideHover(document, position) {
          if (!isTempljsDocument(context, document)) {
            return;
          }

          const sourceUri = getSourceUri(context, document.uri);
          const sourceText = getSourceDocumentText(context, document, sourceUri);
          const offset = getSourceOffsetFromPosition(document, position, sourceText);
          const sourceLanguageId =
            getSourceLanguageId(context, document.uri) ?? document.languageId;
          if (sourceLanguageId === 'templjs-markdown') {
            const fencedRanges = detectMarkdownFencedCodeRanges(sourceText.text);
            if (isOffsetInRanges(offset, fencedRanges)) {
              return;
            }
          }

          return templjs.getHover(
            sourceText.text,
            offset,
            toIntellisenseOptions(options, sourceUri, sourceText.text)
          );
        },
        provideDefinition(document, position) {
          if (!isTempljsDocument(context, document)) {
            return;
          }

          const sourceUri = getSourceUri(context, document.uri);
          const sourceText = getSourceDocumentText(context, document, sourceUri);
          const offset = getSourceOffsetFromPosition(document, position, sourceText);
          const sourceLanguageId =
            getSourceLanguageId(context, document.uri) ?? document.languageId;
          if (sourceLanguageId === 'templjs-markdown') {
            const fencedRanges = detectMarkdownFencedCodeRanges(sourceText.text);
            if (isOffsetInRanges(offset, fencedRanges)) {
              return;
            }
          }

          const definition = templjs.getDefinition(
            sourceText.text,
            offset,
            toIntellisenseOptions(options, sourceUri, sourceText.text)
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

/**
 * Wraps a language service plugin so that documents whose `languageId` matches
 * `from` are treated as `to` before being dispatched to `provideDiagnostics`.
 * Useful when cleaned virtual codes carry a TemplJS-flavored variant languageId
 * and need to be routed to a canonical language service.
 */
function withLanguageIdRemap(
  plugin: LanguageServicePlugin,
  from: string,
  to: string
): LanguageServicePlugin {
  return {
    ...plugin,
    create(context) {
      const instance = plugin.create(context);
      if (!instance.provideDiagnostics) return instance;
      const { provideDiagnostics } = instance;
      return {
        ...instance,
        provideDiagnostics(document, token) {
          if (document.languageId !== from) return provideDiagnostics(document, token);
          const normalized = createTextDocumentLike(
            document.uri,
            to,
            document.getText()
          ) as Parameters<typeof provideDiagnostics>[0];
          return provideDiagnostics(normalized, token);
        },
      };
    },
  };
}

function createYamlDiagnosticsPlugin(options: PluginOptions): LanguageServicePlugin | undefined {
  return createYamlHostDiagnosticsAdapter(options);
}

function createMarkdownHostDiagnosticsPlugin(
  options: PluginOptions
): LanguageServicePlugin | undefined {
  return createMarkdownHostDiagnosticsAdapter(options);
}

function createHtmlHostServicePlugin(): LanguageServicePlugin {
  const basePlugin = createVolarHtmlServicePlugin();

  return {
    ...basePlugin,
    name: 'templjs-html-host',
  };
}

function createJsonHostServicePlugin(): LanguageServicePlugin {
  const basePlugin = createVolarJsonServicePlugin();

  return {
    ...basePlugin,
    name: 'templjs-json-host',
  };
}

function createPrettierHostServicePlugin(
  options: PluginOptions
): LanguageServicePlugin | undefined {
  return createPrettierHostAdapter(options);
}

function createTextDocumentLike(uri: string, languageId: string, text: string) {
  return TextDocument.create(uri, languageId, 1, text);
}

function detectMarkdownFencedCodeRanges(text: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  const lines = text.split(/\r?\n/);
  let offset = 0;

  let openFence:
    | {
        marker: '`' | '~';
        size: number;
        startOffset: number;
      }
    | undefined;

  for (const line of lines) {
    const startOffset = offset;
    const endOffset = startOffset + line.length;
    const lineBreakLength = text.startsWith('\r\n', endOffset) ? 2 : 1;
    offset = Math.min(text.length, endOffset + lineBreakLength);

    if (!openFence) {
      const openMatch = line.match(/^\s{0,3}(`{3,}|~{3,})[^`~]*$/);
      if (!openMatch) {
        continue;
      }

      const marker = openMatch[1][0] as '`' | '~';
      openFence = {
        marker,
        size: openMatch[1].length,
        startOffset,
      };
      continue;
    }

    const closePattern = new RegExp(`^\\s{0,3}${openFence.marker}{${openFence.size},}\\s*$`);
    if (!closePattern.test(line)) {
      continue;
    }

    ranges.push({
      start: openFence.startOffset,
      end: offset,
    });
    openFence = undefined;
  }

  if (openFence) {
    ranges.push({
      start: openFence.startOffset,
      end: text.length,
    });
  }

  return ranges;
}

function isOffsetInRanges(offset: number, ranges: Array<{ start: number; end: number }>): boolean {
  return ranges.some((range) => offset >= range.start && offset < range.end);
}

function maskRangesForTemplateSemantics(
  text: string,
  ranges: Array<{ start: number; end: number }>
): string {
  if (ranges.length === 0) {
    return text;
  }

  const chars = [...text];
  for (const range of ranges) {
    for (let i = range.start; i < Math.min(range.end, chars.length); i += 1) {
      if (chars[i] !== '\n' && chars[i] !== '\r') {
        chars[i] = ' ';
      }
    }
  }

  return chars.join('');
}

function toDiagnosticSeverity(severity: number | undefined): 1 | 2 | 3 | 4 | undefined {
  switch (severity) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 3;
    case 4:
      return 4;
    default:
      return undefined;
  }
}

function createTempljsDiagnosticsPlugin(options: PluginOptions): LanguageServicePlugin {
  return {
    name: 'templjs-diagnostics',
    capabilities: {
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
    },
    create(context) {
      return {
        /* c8 ignore next */
        /* v8 ignore next */
        async provideDiagnostics(document, _token) {
          const route = shouldSkipTempljsDiagnostics(
            context,
            document,
            options,
            'templjs-diag-plugin'
          );
          if (route.skip) {
            return;
          }

          if (isMarkdownTempljsLanguage(route.sourceLanguageId)) {
            options.log?.(
              `[templjs-diag-plugin] skip reason=markdown-routed sourceUri=${route.sourceUri}`
            );
            return;
          }

          const sourceText = getSourceDocumentText(context, document, route.sourceUri);
          const diagnosticOptions = toDiagnosticOptions(options, route.sourceUri, sourceText.text);
          options.log?.(
            `[templjs-diag-plugin] options schema=${diagnosticOptions.schema ? 'yes' : 'no'} contentSchema=${diagnosticOptions.contentSchema ? 'yes' : 'no'} sourceUri=${route.sourceUri}`
          );
          options.log?.(
            `[templjs-diag-plugin] text fromSource=${sourceText.fromSource ? 'yes' : 'no'} length=${sourceText.text.length} uri=${document.uri}`
          );

          try {
            const diagnostics = collectDiagnostics(sourceText.text, diagnosticOptions);
            options.log?.(
              `[templjs-diag-plugin] collected count=${diagnostics.length} sourceUri=${route.sourceUri}`
            );
            return diagnostics.map((d: DiagnosticItem) => ({
              message: d.message,
              severity: toDiagnosticSeverity(d.severity),
              range: d.range,
              source: d.source ?? 'templjs',
              code: d.code,
            }));
          } catch (error) {
            options.log?.(
              `[templjs-diag-plugin] error sourceUri=${route.sourceUri} message=${error instanceof Error ? error.message : String(error)}`
            );
            return [];
          }
        },
      };
    },
  };
}

function createTempljsMarkdownDiagnosticsPlugin(options: PluginOptions): LanguageServicePlugin {
  return {
    name: 'templjs-markdown-diagnostics',
    capabilities: {
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
    },
    create(context) {
      return {
        /* c8 ignore next */
        /* v8 ignore next */
        async provideDiagnostics(document, _token) {
          const route = shouldSkipTempljsDiagnostics(
            context,
            document,
            options,
            'templjs-markdown-diag-plugin'
          );
          if (route.skip) {
            return;
          }

          /* c8 ignore start */
          if (!isMarkdownTempljsLanguage(route.sourceLanguageId)) {
            options.log?.(
              `[templjs-markdown-diag-plugin] skip reason=non-markdown sourceUri=${route.sourceUri} sourceLanguageId=${route.sourceLanguageId}`
            );
            return;
          }
          /* c8 ignore stop */

          const sourceText = getSourceDocumentText(context, document, route.sourceUri);
          const diagnosticOptions = toDiagnosticOptions(options, route.sourceUri, sourceText.text);
          options.log?.(
            `[templjs-markdown-diag-plugin] options schema=${diagnosticOptions.schema ? 'yes' : 'no'} contentSchema=${diagnosticOptions.contentSchema ? 'yes' : 'no'} sourceUri=${route.sourceUri}`
          );
          options.log?.(
            `[templjs-markdown-diag-plugin] text fromSource=${sourceText.fromSource ? 'yes' : 'no'} length=${sourceText.text.length} uri=${document.uri}`
          );

          try {
            const fencedRanges = detectMarkdownFencedCodeRanges(sourceText.text);
            const maskedSourceText = maskRangesForTemplateSemantics(sourceText.text, fencedRanges);
            const isolatedTempljsDiagnostics = collectDiagnostics(maskedSourceText, {
              ...diagnosticOptions,
            });
            options.log?.(
              `[templjs-markdown-diag-plugin] collected templjs=${isolatedTempljsDiagnostics.length} sourceUri=${route.sourceUri}`
            );
            return [
              ...isolatedTempljsDiagnostics.map((d: DiagnosticItem) => ({
                message: d.message,
                severity: toDiagnosticSeverity(d.severity),
                range: d.range,
                source: d.source ?? 'templjs',
                code: d.code,
              })),
            ];
          } catch (error) {
            options.log?.(
              `[templjs-markdown-diag-plugin] error sourceUri=${route.sourceUri} message=${error instanceof Error ? error.message : String(error)}`
            );
            return [];
          }
        },
      };
    },
  };
}

export function createServicePlugins(options: PluginOptions): LanguageServicePlugin[] {
  const runtimeManifest = resolveAdapterRuntimeManifest(options);
  const markdownHostPlugin = createMarkdownHostDiagnosticsAdapter(options);
  options.log?.(
    `[templjs-runtime] manifest version=${runtimeManifest.version} adapters=${runtimeManifest.adapters.length}`
  );

  const yamlPlugin = createYamlDiagnosticsPlugin(options);
  const prettierPlugin = createPrettierHostServicePlugin(options);

  return [
    createTempljsAdditionalPlugin(options),
    createTempljsDiagnosticsPlugin(options),
    createTempljsMarkdownDiagnosticsPlugin(options),
    ...(markdownHostPlugin ? [markdownHostPlugin] : []),
    ...(yamlPlugin ? [yamlPlugin] : []),
    createHtmlHostServicePlugin(),
    createJsonHostServicePlugin(),
    ...(prettierPlugin ? [prettierPlugin] : []),
  ];
}

/* c8 ignore start */
/* v8 ignore start */
export const servicePluginTesting = {
  withLanguageIdRemap,
  getSourceUri,
  getSourceLanguageId,
  getSourceDocumentText,
  getVirtualCodeId,
  isMarkdownTempljsLanguage,
  shouldSkipTempljsDiagnostics,
  isTempljsDocument,
  isYamlDocument,
  detectMarkdownFencedCodeRanges,
  isOffsetInRanges,
  maskRangesForTemplateSemantics,
  createTextDocumentLike,
  toDiagnosticSeverity,
  resolveSchemaOptionsForSource,
  toIntellisenseOptions,
  toDiagnosticOptions,
  createTempljsAdditionalPlugin,
  createTempljsDiagnosticsPlugin,
  createTempljsMarkdownDiagnosticsPlugin,
  createMarkdownHostDiagnosticsPlugin,
  createYamlDiagnosticsPlugin,
  planYamlAdapterRuntime,
  createHtmlHostServicePlugin,
  createJsonHostServicePlugin,
  createPrettierHostServicePlugin,
  planPrettierAdapterRuntime,
  planMarkdownAdapterRuntime,
  getConfiguredPrettierHostLanguages,
  resolveAdapterRuntimeManifest,
};
/* v8 ignore stop */
/* c8 ignore stop */
