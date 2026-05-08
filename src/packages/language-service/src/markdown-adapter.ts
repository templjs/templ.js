import type { LanguageServicePlugin } from '@volar/language-service';
import { create as createVolarMarkdownServicePlugin } from 'volar-service-markdown';
import type { ServicePluginOrchestrationOptions } from './service-plugin-contract.js';
import { getResolvedAdapterRuntime } from './runtime-manifest.js';

const DEFAULT_MARKDOWN_DIAGNOSTICS_OPTIONS = {
  validateReferences: 'warning',
  validateFragmentLinks: 'warning',
  validateFileLinks: 'warning',
  validateMarkdownFileLinkFragments: 'warning',
  validateUnusedLinkDefinitions: 'hint',
  validateDuplicateLinkDefinitions: 'warning',
  ignoreLinks: [] as string[],
} as const;

export type MarkdownAdapterRuntimePlan = {
  enabled: boolean;
  reason: string;
};

export function planMarkdownAdapterRuntime(
  options: ServicePluginOrchestrationOptions
): MarkdownAdapterRuntimePlan {
  const resolvedRuntime = getResolvedAdapterRuntime(options, 'templjs-markdown-host');
  if (resolvedRuntime) {
    return {
      enabled: resolvedRuntime.state === 'enabled',
      reason: resolvedRuntime.reason,
    };
  }

  if (options.initializationOptions?.markdownlintRegisteredForMd === false) {
    return {
      enabled: false,
      reason: 'disabled-markdownlint-not-registered-for-md',
    };
  }

  return {
    enabled: true,
    reason: 'default-enabled',
  };
}

export function createMarkdownHostDiagnosticsAdapter(
  options: ServicePluginOrchestrationOptions
): LanguageServicePlugin | undefined {
  const plan = planMarkdownAdapterRuntime(options);
  options.log?.(
    `[templjs-runtime] adapter=templjs-markdown-host enabled=${plan.enabled} reason=${plan.reason}`
  );

  if (!plan.enabled) {
    return undefined;
  }

  return {
    ...createVolarMarkdownServicePlugin({
      getDiagnosticOptions: async () => DEFAULT_MARKDOWN_DIAGNOSTICS_OPTIONS as any,
    }),
    name: 'templjs-markdown-host',
  };
}
