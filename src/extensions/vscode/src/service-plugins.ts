import type { ServicePlugin, ServiceContext } from '@volar/language-service';
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

export function createServicePlugins(options: PluginOptions): ServicePlugin[] {
  return [createTempljsAdditionalPlugin(options)];
}
