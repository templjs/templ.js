import type { ServicePlugin, ServiceContext } from '@volar/language-service';
import {
  collectDiagnostics,
  detectFrontmatterRange,
  TempljsServicePlugin,
  type DiagnosticItem,
  type DiagnosticOptions,
  type IntellisenseOptions,
  type LSPCompletionItem,
} from '@templjs/volar';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { getLanguageService as getYamlLanguageService } from 'yaml-language-service';

type PluginOptions = {
  getIntellisenseOptions: (sourceUri: string) => IntellisenseOptions;
  getDiagnosticOptions: (sourceUri: string) => DiagnosticOptions;
  workspaceFolder?: string;
  traceYamlDiagnostics?: boolean;
  log?: (message: string) => void;
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

type SourceSnapshot = {
  getText: (start: number, end: number) => string;
  getLength: () => number;
};

function getSourceDocumentText(
  context: ServiceContext,
  document: { uri: string; getText: () => string },
  sourceUri: string
): { text: string; fromSource: boolean } {
  if (sourceUri === document.uri) {
    return { text: document.getText(), fromSource: false };
  }

  const sourceFile =
    getSourceFileInfo(context, document.uri) ?? context.language.files.get(sourceUri);
  const snapshot = (sourceFile as { snapshot?: SourceSnapshot } | undefined)?.snapshot;
  if (snapshot?.getText && snapshot?.getLength) {
    return {
      text: snapshot.getText(0, snapshot.getLength()),
      fromSource: true,
    };
  }

  return { text: document.getText(), fromSource: false };
}

function getVirtualCodeId(context: ServiceContext, uri: string): string | undefined {
  const [virtualCode] = context.documents.getVirtualCodeByUri(uri);
  return virtualCode?.id;
}

function isMarkdownTempljsLanguage(languageId: string | undefined): boolean {
  return languageId === 'templjs-markdown';
}

function shouldSkipTempljsDiagnostics(
  context: ServiceContext,
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
  context: ServiceContext,
  document: { uri: string; languageId: string }
): boolean {
  if (document.languageId.startsWith('templjs-')) {
    return true;
  }

  return getSourceLanguageId(context, document.uri)?.startsWith('templjs-') ?? false;
}

function isYamlDocument(
  context: ServiceContext,
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

function createYamlDiagnosticsPlugin(options: PluginOptions): ServicePlugin {
  const yaml = createYamlService();

  return {
    name: 'templjs-yaml',
    triggerCharacters: [':', '-', '{', '['],
    create(context) {
      return {
        async provideDiagnostics(document, _token) {
          const yamlDoc = isYamlDocument(context, document);
          if (!yamlDoc) {
            return;
          }

          const sourceLanguageId = getSourceLanguageId(context, document.uri) ?? 'unknown';
          if (options.traceYamlDiagnostics) {
            options.log?.(
              `[templjs-yaml-plugin] validate uri=${document.uri} languageId=${document.languageId} sourceLanguageId=${sourceLanguageId}`
            );
          }

          const diagnostics = await yaml.doValidation(document, false);
          if (options.traceYamlDiagnostics) {
            options.log?.(
              `[templjs-yaml-plugin] validated uri=${document.uri} diagnostics=${diagnostics.length}`
            );
          }

          return diagnostics.map((diagnostic) => ({
            ...diagnostic,
            severity: toDiagnosticSeverity(diagnostic.severity),
          }));
        },
      };
    },
  };
}

function createYamlService() {
  const yaml = getYamlLanguageService({
    /* c8 ignore start */
    schemaRequestService: async () => '',
    workspaceContext: {
      resolveRelativePath(relativePath: string): string {
        return relativePath;
      },
    },
    /* c8 ignore stop */
  });

  yaml.configure?.({ validate: true, schemas: [] });
  return yaml;
}

function detectMarkdownFrontmatterRange(text: string): { start: number; end: number } | undefined {
  const parsedRange = detectFrontmatterRange(text);
  if (parsedRange) {
    return parsedRange;
  }

  const openingFence = text.match(/^(---|\+\+\+)\r?\n/);
  if (!openingFence) {
    return undefined;
  }

  const fence = openingFence[1];
  const escapedFence = fence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const closingPattern = new RegExp(`(?:^|\\n)${escapedFence}\\r?(?:\\n|$)`, 'g');
  closingPattern.lastIndex = openingFence[0].length;
  const closingMatch = closingPattern.exec(text);
  if (!closingMatch) {
    return undefined;
  }

  return {
    start: 0,
    end: closingMatch.index + closingMatch[0].length,
  };
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

function createTempljsDiagnosticsPlugin(options: PluginOptions): ServicePlugin {
  return {
    name: 'templjs-diagnostics',
    create(context) {
      return {
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

          const diagnosticOptions = options.getDiagnosticOptions(route.sourceUri);
          const sourceText = getSourceDocumentText(context, document, route.sourceUri);
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

function createTempljsMarkdownDiagnosticsPlugin(options: PluginOptions): ServicePlugin {
  const yaml = createYamlService();

  return {
    name: 'templjs-markdown-diagnostics',
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

          const diagnosticOptions = options.getDiagnosticOptions(route.sourceUri);
          const sourceText = getSourceDocumentText(context, document, route.sourceUri);
          const frontmatterRange = detectMarkdownFrontmatterRange(sourceText.text);
          const cleanedText = document.getText();
          const cleanedFrontmatterRange = detectMarkdownFrontmatterRange(cleanedText);
          options.log?.(
            `[templjs-markdown-diag-plugin] options schema=${diagnosticOptions.schema ? 'yes' : 'no'} contentSchema=${diagnosticOptions.contentSchema ? 'yes' : 'no'} sourceUri=${route.sourceUri}`
          );
          options.log?.(
            `[templjs-markdown-diag-plugin] text fromSource=${sourceText.fromSource ? 'yes' : 'no'} length=${sourceText.text.length} uri=${document.uri}`
          );
          options.log?.(
            `[templjs-markdown-diag-plugin] frontmatter range=${frontmatterRange ? `${frontmatterRange.start}-${frontmatterRange.end}` : 'none'} sourceUri=${route.sourceUri}`
          );

          try {
            const templjsDiagnostics = collectDiagnostics(sourceText.text, {
              ...diagnosticOptions,
              frontmatterRange,
            });
            let yamlDiagnostics: Awaited<ReturnType<typeof yaml.doValidation>> = [];
            if (cleanedFrontmatterRange) {
              const frontmatterText = cleanedText.slice(
                cleanedFrontmatterRange.start,
                cleanedFrontmatterRange.end
              );
              const yamlDocument = createTextDocumentLike(
                `${route.sourceUri}#frontmatter.yaml`,
                'yaml',
                frontmatterText
              );
              yamlDiagnostics = await yaml.doValidation(yamlDocument, false);
            }
            options.log?.(
              `[templjs-markdown-diag-plugin] collected templjs=${templjsDiagnostics.length} yaml=${yamlDiagnostics.length} sourceUri=${route.sourceUri}`
            );
            return [
              ...templjsDiagnostics.map((d: DiagnosticItem) => ({
                message: d.message,
                severity: toDiagnosticSeverity(d.severity),
                range: d.range,
                source: d.source ?? 'templjs',
                code: d.code,
              })),
              ...yamlDiagnostics.map((diagnostic) => ({
                ...diagnostic,
                severity: toDiagnosticSeverity(diagnostic.severity),
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

export function createServicePlugins(options: PluginOptions): ServicePlugin[] {
  return [
    createTempljsAdditionalPlugin(options),
    createTempljsDiagnosticsPlugin(options),
    createTempljsMarkdownDiagnosticsPlugin(options),
    createYamlDiagnosticsPlugin(options),
  ];
}

/* c8 ignore start */
/* v8 ignore start */
export const servicePluginTesting = {
  getSourceUri,
  getSourceLanguageId,
  getSourceDocumentText,
  getVirtualCodeId,
  isMarkdownTempljsLanguage,
  shouldSkipTempljsDiagnostics,
  isTempljsDocument,
  isYamlDocument,
  detectMarkdownFrontmatterRange,
  createTextDocumentLike,
  toDiagnosticSeverity,
  createTempljsAdditionalPlugin,
  createTempljsDiagnosticsPlugin,
  createTempljsMarkdownDiagnosticsPlugin,
  createYamlDiagnosticsPlugin,
};
/* v8 ignore stop */
/* c8 ignore stop */
