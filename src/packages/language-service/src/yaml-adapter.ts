import type { LanguageServicePlugin } from '@volar/language-service';
import { create as createVolarYamlServicePlugin } from 'volar-service-yaml';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { cleanTemplateContent } from '@templjs/volar';
import type { ServicePluginOrchestrationOptions } from './service-plugin-contract.js';
import { getResolvedAdapterRuntime } from './runtime-manifest.js';

export type YamlAdapterRuntimePlan = {
  enabled: boolean;
  reason: string;
};

export function planYamlAdapterRuntime(
  options: ServicePluginOrchestrationOptions
): YamlAdapterRuntimePlan {
  const resolvedRuntime = getResolvedAdapterRuntime(options, 'templjs-yaml');
  if (resolvedRuntime) {
    return {
      enabled: resolvedRuntime.state === 'enabled',
      reason: resolvedRuntime.reason,
    };
  }

  if (options.initializationOptions?.redhatYamlRegisteredForYaml === false) {
    return {
      enabled: false,
      reason: 'disabled-yaml-ls-not-registered-for-yaml',
    };
  }

  return {
    enabled: true,
    reason: 'default-enabled',
  };
}

export function createYamlHostDiagnosticsAdapter(
  options: ServicePluginOrchestrationOptions
): LanguageServicePlugin | undefined {
  const plan = planYamlAdapterRuntime(options);
  options.log?.(
    `[templjs-runtime] adapter=templjs-yaml enabled=${plan.enabled} reason=${plan.reason}`
  );

  if (!plan.enabled) {
    return undefined;
  }

  const base = createVolarYamlServicePlugin();
  return {
    ...base,
    name: 'templjs-yaml',
    capabilities: {
      completionProvider: {
        triggerCharacters: [':', '-', '{', '['],
      },
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
    },
    create(context) {
      const instance = base.create(context);

      const logYamlFeatureError = (feature: string, documentUri: string, error: unknown) => {
        options.log?.(
          `[templjs-yaml] ${feature} failed uri=${documentUri} message=${error instanceof Error ? error.message : String(error)}`
        );
      };

      const toCleanedDocument = (document: {
        uri: string;
        languageId: string;
        version?: number;
        getText: () => string;
      }) => {
        const source = document.getText();
        const cleaned = cleanTemplateContent(source, undefined, { mode: 'text-only' }).cleaned;
        return {
          source,
          cleaned,
          document: TextDocument.create(
          document.uri,
          document.languageId,
          document.version ?? 1,
          cleaned
          ),
        };
      };

      return {
        ...instance,
        async provideDiagnostics(document, token) {
          // Source-level templjs documents and embedded host codes carry raw template syntax or cleaned code without schemas — skip them.
          // Remap wrapper will handle routing templjs-yaml root documents to the base YAML service for structured diagnostics.
          if (document.languageId.startsWith('templjs-')) return;

          try {
            return await instance.provideDiagnostics?.(document, token);
          } catch (error) {
            logYamlFeatureError('diagnostics', document.uri, error);
            try {
              const cleanedDocumentContext = toCleanedDocument(document);
              if (cleanedDocumentContext.cleaned === cleanedDocumentContext.source) {
                return [];
              }

              options.log?.(`[templjs-yaml] diagnostics retry=cleaned uri=${document.uri}`);
              return await instance.provideDiagnostics?.(cleanedDocumentContext.document, token);
            } catch (retryError) {
              logYamlFeatureError('diagnostics-retry', document.uri, retryError);
              return [];
            }
          }
        },
        async provideHover(document, position, token) {
          if (!instance.provideHover) {
            return;
          }

          try {
            return await instance.provideHover(document, position, token);
          } catch (error) {
            logYamlFeatureError('hover', document.uri, error);
            return;
          }
        },
        async provideCompletionItems(document, position, completionContext, token) {
          if (!instance.provideCompletionItems) {
            return;
          }

          try {
            return await instance.provideCompletionItems(document, position, completionContext, token);
          } catch (error) {
            logYamlFeatureError('completion', document.uri, error);
            return;
          }
        },
        async provideDefinition(document, position, token) {
          if (!instance.provideDefinition) {
            return;
          }

          try {
            return await instance.provideDefinition(document, position, token);
          } catch (error) {
            logYamlFeatureError('definition', document.uri, error);
            return;
          }
        },
      };
    },
  };
}
