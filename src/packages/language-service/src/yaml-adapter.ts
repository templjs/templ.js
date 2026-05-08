import type { LanguageServicePlugin } from '@volar/language-service';
import { create as createVolarYamlServicePlugin } from 'volar-service-yaml';
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
      return {
        ...instance,
        async provideDiagnostics(document, token) {
          // Source-level templjs documents carry raw template syntax — skip them.
          if (document.languageId.startsWith('templjs-')) return;
          return instance.provideDiagnostics?.(document, token);
        },
      };
    },
  };
}
