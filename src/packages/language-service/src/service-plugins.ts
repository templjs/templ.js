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
import {
  createRangeMapperFromOriginal,
  remapCompletionResponse,
  remapDefinitionResponse,
  remapDiagnosticsResponse,
  remapHoverResponse,
} from './position-remapping-utility.js';
import { loadSchemaSourceSync, resolveDocumentSchemaSources } from './schema-loading.js';
import {
  createMarkdownHostDiagnosticsAdapter,
  createMarkdownlintHostDiagnosticsAdapter,
  planMarkdownAdapterRuntime,
  planMarkdownHostAdapterRuntime,
  planMarkdownlintAdapterRuntime,
} from './markdown-adapter.js';
import {
  isMarkdownTempljsLanguage,
  detectMarkdownFencedCodeRanges,
  maskRangesForTemplateSemantics,
  isOffsetInRanges,
} from './markdown-templjs-adapter.js';
import { createPrettierHostAdapter, planPrettierAdapterRuntime } from './prettier-adapter.js';
import { createJsonHostAdapter, planJsonAdapterRuntime } from './json-adapter.js';
import { createYamlHostDiagnosticsAdapter, planYamlAdapterRuntime } from './yaml-adapter.js';
import { createHtmlHostAdapter, planHtmlAdapterRuntime } from './html-adapter.js';
import {
  getHostAdapterPluginFactory,
  listHostAdapterPluginKeys,
} from './host-adapter-plugin-registry.js';
import type { ServicePluginOrchestrationOptions } from './service-plugin-contract.js';
import {
  getConfiguredPrettierHostLanguages,
  resolveFormattingOrchestrationContract,
  resolveAdapterRuntimeManifest,
} from './runtime-manifest.js';

type PluginOptions = ServicePluginOrchestrationOptions;

const TEMPLJS_COMPLETION_TRIGGER_CHARACTERS = [
  '.',
  '|',
  ...'abcdefghijklmnopqrstuvwxyz',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
] as const;

export type CoreServicePluginFactory = (options: PluginOptions) => LanguageServicePlugin;
export type CoreServicePluginKey = `core:${string}`;

type ResolvedSchemaOptions = {
  schema?: object;
  schemaUri?: string;
  contentSchema?: object;
  contentSchemaUri?: string;
};

type SourceFileInfo = {
  id?: { toString(): string };
  languageId?: string;
  snapshot?: {
    getText(start: number, end: number): string;
    getLength(): number;
  };
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

function getSourceFileInfo(
  context: LanguageServiceContext,
  uri: string
): SourceFileInfo | undefined {
  const scripts = (
    context as unknown as { language?: { scripts?: { get: (uri: URI) => unknown } } }
  ).language?.scripts;
  if (!scripts) {
    return undefined;
  }

  const parsedUri = URI.parse(uri);
  const decodeEmbeddedDocumentUri = (
    context as unknown as {
      decodeEmbeddedDocumentUri?: (
        uri: URI
      ) => ReturnType<LanguageServiceContext['decodeEmbeddedDocumentUri']>;
    }
  ).decodeEmbeddedDocumentUri;

  const decoded = decodeEmbeddedDocumentUri?.(parsedUri);
  if (decoded) {
    const [documentUri] = decoded;
    return scripts.get(documentUri) as SourceFileInfo | undefined;
  }
  return scripts.get(parsedUri) as SourceFileInfo | undefined;
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
    getText: () => string;
    offsetAt: (position: { line: number; character: number }) => number;
  },
  position: { line: number; character: number },
  sourceText: { text: string; fromSource: boolean }
): number {
  if (!sourceText.fromSource) {
    return document.offsetAt(position);
  }

  // Embedded virtual documents often use line/character coordinates that are
  // local to the virtual snippet rather than the full source document. Map via
  // virtual prefix when possible so cursor-sensitive completions (e.g. item.n)
  // resolve against the authoritative source text.
  const virtualText = document.getText();
  const virtualOffset = document.offsetAt(position);
  const virtualPrefix = virtualText.slice(0, Math.max(0, virtualOffset));
  if (virtualPrefix.length > 0 && virtualPrefix.length <= sourceText.text.length) {
    const sourcePrefixIndex = sourceText.text.lastIndexOf(virtualPrefix);
    if (sourcePrefixIndex >= 0) {
      return sourcePrefixIndex + virtualPrefix.length;
    }
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

function mergeCompletionItems(
  preferred: LSPCompletionItem[],
  fallback: LSPCompletionItem[]
): LSPCompletionItem[] {
  /* c8 ignore next */
  /* v8 ignore next */
  if (fallback.length === 0) {
    return preferred;
  }

  const toLabelKey = (label: unknown): string => {
    if (typeof label === 'string') {
      return label.toLowerCase();
    }

    if (
      label &&
      typeof label === 'object' &&
      'label' in label &&
      typeof (label as { label?: unknown }).label === 'string'
    ) {
      return (label as { label: string }).label.toLowerCase();
    }

    return String(label).toLowerCase();
  };

  const seen = new Set(
    preferred.map((item) => `${toLabelKey(item.label)}::${item.kind ?? ''}::${item.detail ?? ''}`)
  );
  const merged = [...preferred];

  for (const item of fallback) {
    const key = `${toLabelKey(item.label)}::${item.kind ?? ''}::${item.detail ?? ''}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(item);
  }

  return merged;
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

  if (/\.(templ|tmpl|tpl)($|\?)/i.test(document.uri)) {
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
        triggerCharacters: [...TEMPLJS_COMPLETION_TRIGGER_CHARACTERS],
      },
      hoverProvider: true,
      definitionProvider: true,
    },
    create(context) {
      return {
        // Surface templjs completions as primary suggestions so they are not
        // suppressed behind host-language snippet providers in templ blocks.
        isAdditionalCompletion: false,
        provideCompletionItems(document, position) {
          if (!isTempljsDocument(context, document)) {
            return;
          }

          const virtualCodeId = getVirtualCodeId(context, document.uri);
          const sourceUri = getSourceUri(context, document.uri);
          const sourceText = getSourceDocumentText(context, document, sourceUri);
          const sourceOffset = getSourceOffsetFromPosition(document, position, sourceText);
          const virtualOffset = document.offsetAt(position);
          const sourceLanguageId =
            getSourceLanguageId(context, document.uri) ?? document.languageId;
          if (sourceLanguageId === 'templjs-markdown') {
            const fencedRanges = detectMarkdownFencedCodeRanges(sourceText.text);
            if (isOffsetInRanges(sourceOffset, fencedRanges)) {
              return;
            }
          }

          const sourceItems = templjs.getCompletions(
            sourceText.text,
            sourceOffset,
            toIntellisenseOptions(options, sourceUri, sourceText.text)
          );

          let items = sourceItems;
          if (virtualCodeId && virtualCodeId !== 'root') {
            const virtualText = document.getText();
            const virtualItems = templjs.getCompletions(
              virtualText,
              virtualOffset,
              toIntellisenseOptions(options, sourceUri, sourceText.text)
            );
            items = mergeCompletionItems(virtualItems, sourceItems);
          }

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

          const virtualCodeId = getVirtualCodeId(context, document.uri);
          if (virtualCodeId && virtualCodeId !== 'root') {
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
 * `from` are treated as `to` before being dispatched to host-language feature
 * providers. Useful when cleaned virtual codes carry a TemplJS-flavored variant
 * languageId and need to be routed to a canonical language service.
 */
function withLanguageIdRemap(
  plugin: LanguageServicePlugin,
  from: string,
  to: string,
  options: { preserveSourceLanguageIdForDiagnostics?: boolean } = {}
): LanguageServicePlugin {
  const remapDocument = <T extends { uri: string; languageId: string; getText(): string }>(
    document: T
  ): T => {
    if (document.languageId !== from) {
      return document;
    }

    return createTextDocumentLike(document.uri, to, document.getText()) as unknown as T;
  };

  return {
    ...plugin,
    create(context) {
      const instance = plugin.create(context);

      const { provideDiagnostics, provideCompletionItems, provideHover, provideDefinition } =
        instance;

      if (!provideDiagnostics && !provideCompletionItems && !provideHover && !provideDefinition) {
        return instance;
      }

      return {
        ...instance,
        ...(provideDiagnostics
          ? {
              provideDiagnostics(document, token) {
                const decodedEmbeddedDocument = (
                  context as unknown as {
                    decodeEmbeddedDocumentUri?: (
                      uri: URI
                    ) => ReturnType<LanguageServiceContext['decodeEmbeddedDocumentUri']>;
                  }
                ).decodeEmbeddedDocumentUri?.(URI.parse(document.uri));
                const shouldPreserveSourceLanguageId =
                  options.preserveSourceLanguageIdForDiagnostics &&
                  document.languageId === from &&
                  !decodedEmbeddedDocument;
                return provideDiagnostics(
                  shouldPreserveSourceLanguageId ? document : remapDocument(document),
                  token
                );
              },
            }
          : {}),
        ...(provideCompletionItems
          ? {
              provideCompletionItems(document, position, completionContext, token) {
                return provideCompletionItems(
                  remapDocument(document),
                  position,
                  completionContext,
                  token
                );
              },
            }
          : {}),
        ...(provideHover
          ? {
              provideHover(document, position, token) {
                return provideHover(remapDocument(document), position, token);
              },
            }
          : {}),
        ...(provideDefinition
          ? {
              provideDefinition(document, position, token) {
                return provideDefinition(remapDocument(document), position, token);
              },
            }
          : {}),
      };
    },
  };
}

function withPositionRemap(
  plugin: LanguageServicePlugin,
  sourceLanguageId: string,
  options: PluginOptions
): LanguageServicePlugin {
  return {
    ...plugin,
    create(context) {
      const instance = plugin.create(context);

      const { provideDiagnostics, provideCompletionItems, provideHover, provideDefinition } =
        instance;

      if (!provideDiagnostics && !provideCompletionItems && !provideHover && !provideDefinition) {
        return instance;
      }

      const getRangeMapper = (document: { uri: string; languageId: string; getText(): string }) => {
        const resolvedSourceLanguageId =
          getSourceLanguageId(context, document.uri) ?? document.languageId;
        if (resolvedSourceLanguageId !== sourceLanguageId) {
          return;
        }

        // Prefer Volar's canonical generated->source map when available.
        // This avoids drift between adapter-internal cleaning and regex-based fallback remapping.
        const decoded = context.decodeEmbeddedDocumentUri?.(URI.parse(document.uri));
        if (decoded) {
          const [sourceScriptUri, embeddedCodeId] = decoded;
          const sourceScript = context.language.scripts.get(sourceScriptUri) as
            | {
                languageId?: string;
                snapshot?: SourceSnapshot;
                generated?: {
                  root?: { id?: string };
                  embeddedCodes?: Map<string, unknown>;
                };
              }
            | undefined;

          const virtualCode =
            sourceScript?.generated?.root?.id === embeddedCodeId
              ? sourceScript.generated.root
              : sourceScript?.generated?.embeddedCodes?.get(embeddedCodeId);

          const languageMaps = (
            context.language as unknown as {
              maps?: {
                get?: (
                  virtualCode: unknown,
                  sourceScript: unknown
                ) => {
                  toSourceRange?: (
                    generatedStart: number,
                    generatedEnd: number,
                    fallbackToAnyMatch: boolean
                  ) => Generator<readonly [number, number], unknown, unknown>;
                };
              };
            }
          ).maps;
          const sourceMap =
            virtualCode && languageMaps?.get
              ? languageMaps.get(virtualCode, sourceScript)
              : undefined;

          if (
            sourceMap?.toSourceRange &&
            sourceScript?.snapshot?.getText &&
            sourceScript.snapshot.getLength
          ) {
            const sourceUri = sourceScriptUri.toString();
            const sourceTextValue = sourceScript.snapshot.getText(
              0,
              sourceScript.snapshot.getLength()
            );
            const sourceDoc = createTextDocumentLike(
              sourceUri,
              sourceScript.languageId ?? sourceLanguageId,
              sourceTextValue
            );
            const generatedDoc = createTextDocumentLike(
              document.uri,
              document.languageId,
              document.getText()
            );

            return {
              cleanedRangeToOriginal(
                startLine: number,
                startCol: number,
                endLine: number,
                endCol: number
              ) {
                const generatedStart = generatedDoc.offsetAt({
                  line: startLine,
                  character: startCol,
                });
                const generatedEnd = generatedDoc.offsetAt({ line: endLine, character: endCol });
                const mappedRanges = sourceMap.toSourceRange?.(generatedStart, generatedEnd, true);
                const firstMatch = mappedRanges?.next().value as
                  | readonly [number, number]
                  | undefined;

                if (!firstMatch) {
                  return { startLine, startCol, endLine, endCol };
                }

                const [sourceStartOffset, sourceEndOffset] = firstMatch;
                const sourceStart = sourceDoc.positionAt(sourceStartOffset);
                const sourceEnd = sourceDoc.positionAt(sourceEndOffset);
                return {
                  startLine: sourceStart.line,
                  startCol: sourceStart.character,
                  endLine: sourceEnd.line,
                  endCol: sourceEnd.character,
                };
              },
            } as Parameters<typeof remapDiagnosticsResponse>[0];
          }
        }

        const sourceUri = getSourceUri(context, document.uri);
        const sourceText = getSourceDocumentText(context, document, sourceUri);
        if (!sourceText.fromSource) {
          return;
        }

        try {
          return createRangeMapperFromOriginal(sourceText.text);
        } catch (error) {
          options.log?.(
            `[templjs-remap] failed uri=${document.uri} message=${error instanceof Error ? error.message : String(error)}`
          );
          return;
        }
      };

      return {
        ...instance,
        ...(provideDiagnostics
          ? {
              provideDiagnostics(document, token) {
                const response = provideDiagnostics(document, token);
                const rangeMapper = getRangeMapper(document);
                if (!rangeMapper) {
                  return response;
                }

                if (isPromiseLike(response)) {
                  return response.then((items) => {
                    if (!items) {
                      return items;
                    }
                    return remapDiagnosticsResponse(
                      rangeMapper,
                      items as unknown as Parameters<typeof remapDiagnosticsResponse>[1]
                    ) as typeof items;
                  });
                }

                if (!response) {
                  return response;
                }

                return remapDiagnosticsResponse(
                  rangeMapper,
                  response as unknown as Parameters<typeof remapDiagnosticsResponse>[1]
                ) as typeof response;
              },
            }
          : {}),
        ...(provideCompletionItems
          ? {
              provideCompletionItems(document, position, completionContext, token) {
                const response = provideCompletionItems(
                  document,
                  position,
                  completionContext,
                  token
                );
                const rangeMapper = getRangeMapper(document);
                if (!rangeMapper) {
                  return response;
                }

                if (isPromiseLike(response)) {
                  return response.then((completion) => {
                    if (!completion) {
                      return completion;
                    }
                    return remapCompletionResponse(
                      rangeMapper,
                      completion as unknown as Parameters<typeof remapCompletionResponse>[1]
                    ) as typeof completion;
                  });
                }

                if (!response) {
                  return response;
                }

                return remapCompletionResponse(
                  rangeMapper,
                  response as unknown as Parameters<typeof remapCompletionResponse>[1]
                ) as typeof response;
              },
            }
          : {}),
        ...(provideHover
          ? {
              provideHover(document, position, token) {
                const response = provideHover(document, position, token);
                const rangeMapper = getRangeMapper(document);
                if (!rangeMapper) {
                  return response;
                }

                if (isPromiseLike(response)) {
                  return response.then((hover) => {
                    if (!hover) {
                      return hover;
                    }
                    return remapHoverResponse(
                      rangeMapper,
                      hover as unknown as Parameters<typeof remapHoverResponse>[1]
                    ) as typeof hover;
                  });
                }

                if (!response) {
                  return response;
                }

                return remapHoverResponse(
                  rangeMapper,
                  response as unknown as Parameters<typeof remapHoverResponse>[1]
                ) as typeof response;
              },
            }
          : {}),
        ...(provideDefinition
          ? {
              provideDefinition(document, position, token) {
                const response = provideDefinition(document, position, token);
                const rangeMapper = getRangeMapper(document);
                const sourceUri = getSourceUri(context, document.uri);
                if (!rangeMapper) {
                  return response;
                }

                const remapDefinitionResult = <T>(definition: T): T => {
                  if (!definition) {
                    return definition;
                  }

                  if (Array.isArray(definition)) {
                    return remapDefinitionResponse(
                      rangeMapper,
                      definition as unknown as Parameters<typeof remapDefinitionResponse>[1],
                      sourceUri
                    ) as T;
                  }

                  if (typeof definition === 'object') {
                    const candidate = definition as { targetUri?: unknown; uri?: unknown };
                    if ('targetUri' in candidate || 'uri' in candidate) {
                      const remapped = remapDefinitionResponse(
                        rangeMapper,
                        [definition] as unknown as Parameters<typeof remapDefinitionResponse>[1],
                        sourceUri
                      );
                      return remapped[0] as T;
                    }
                  }

                  return definition;
                };

                if (isPromiseLike(response)) {
                  return response.then((definition) => {
                    return remapDefinitionResult(definition);
                  });
                }

                return remapDefinitionResult(response);
              },
            }
          : {}),
      };
    },
  };
}

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return !!value && typeof (value as { then?: unknown }).then === 'function';
}

function createTextDocumentLike(uri: string, languageId: string, text: string) {
  return TextDocument.create(uri, languageId, 1, text);
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

const coreServicePluginRegistryMap = new Map<CoreServicePluginKey, CoreServicePluginFactory>([
  ['core:templjs-additional', createTempljsAdditionalPlugin],
  ['core:templjs-diagnostics', createTempljsDiagnosticsPlugin],
  ['core:templjs-markdown-diagnostics', createTempljsMarkdownDiagnosticsPlugin],
]);

export function registerCoreServicePlugin(
  key: CoreServicePluginKey,
  factory: CoreServicePluginFactory
): void {
  coreServicePluginRegistryMap.set(key, factory);
}

export function unregisterCoreServicePlugin(key: CoreServicePluginKey): boolean {
  return coreServicePluginRegistryMap.delete(key);
}

export function listCoreServicePluginKeys(): CoreServicePluginKey[] {
  return [...coreServicePluginRegistryMap.keys()];
}

export function listCoreServicePluginFactories(): CoreServicePluginFactory[] {
  return [...coreServicePluginRegistryMap.values()];
}

export function createServicePlugins(options: PluginOptions): LanguageServicePlugin[] {
  const runtimeManifest = resolveAdapterRuntimeManifest(options);
  options.log?.(
    `[templjs-runtime] manifest version=${runtimeManifest.version} adapters=${runtimeManifest.adapters.length}`
  );

  const corePlugins = listCoreServicePluginFactories().map((factory) => factory(options));

  const hostLanguageRemaps: Partial<
    Record<string, { fromLanguageId: string; toLanguageId: string }>
  > = {
    'templjs-yaml': {
      fromLanguageId: 'templjs-yaml',
      toLanguageId: 'yaml',
    },
    'templjs-markdown-host': {
      fromLanguageId: 'templjs-markdown',
      toLanguageId: 'markdown',
    },
    'templjs-markdownlint-host': {
      fromLanguageId: 'templjs-markdown',
      toLanguageId: 'markdown',
    },
  };

  const hostPlugins = runtimeManifest.adapters
    .map((adapter) => {
      const basePlugin = getHostAdapterPluginFactory(adapter.id)?.(options);
      if (!basePlugin) {
        return undefined;
      }

      const remap = hostLanguageRemaps[adapter.id];
      if (!remap) {
        return basePlugin;
      }

      const languageIdRemapped = withLanguageIdRemap(
        basePlugin,
        remap.fromLanguageId,
        remap.toLanguageId,
        {
          preserveSourceLanguageIdForDiagnostics: adapter.id === 'templjs-yaml',
        }
      );

      return withPositionRemap(languageIdRemapped, remap.fromLanguageId, options);
    })
    .filter((plugin): plugin is LanguageServicePlugin => plugin !== undefined);

  return [...corePlugins, ...hostPlugins];
}

/* c8 ignore start */
/* v8 ignore start */
export const servicePluginTesting = {
  withLanguageIdRemap,
  withPositionRemap,
  isPromiseLike,
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
  registerCoreServicePlugin,
  unregisterCoreServicePlugin,
  listCoreServicePluginKeys,
  listCoreServicePluginFactories,
  createMarkdownHostDiagnosticsAdapter,
  createMarkdownlintHostDiagnosticsAdapter,
  createYamlHostDiagnosticsAdapter,
  createHtmlHostAdapter,
  createJsonHostAdapter,
  createPrettierHostAdapter,
  getHostAdapterPluginFactory,
  listHostAdapterPluginKeys,
  planYamlAdapterRuntime,
  planHtmlAdapterRuntime,
  planJsonAdapterRuntime,
  planPrettierAdapterRuntime,
  planMarkdownHostAdapterRuntime,
  planMarkdownlintAdapterRuntime,
  planMarkdownAdapterRuntime,
  getConfiguredPrettierHostLanguages,
  resolveFormattingOrchestrationContract,
  resolveAdapterRuntimeManifest,
};
/* v8 ignore stop */
/* c8 ignore stop */
