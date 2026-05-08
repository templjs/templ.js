import type { LanguageServicePlugin } from '@volar/language-service';
import prettier from 'prettier';
import { create as createVolarPrettierServicePlugin } from 'volar-service-prettier';
import type { ServicePluginOrchestrationOptions } from './service-plugin-contract.js';
import {
  getConfiguredPrettierHostLanguages,
  getResolvedAdapterRuntime,
} from './runtime-manifest.js';

export type PrettierAdapterRuntimePlan = {
  enabled: boolean;
  languages: string[];
  reason: string;
};

export function planPrettierAdapterRuntime(
  options: ServicePluginOrchestrationOptions
): PrettierAdapterRuntimePlan {
  const resolvedRuntime = getResolvedAdapterRuntime(options, 'templjs-prettier-host');
  if (resolvedRuntime && resolvedRuntime.state !== 'enabled') {
    return {
      enabled: false,
      languages: [],
      reason: resolvedRuntime.reason,
    };
  }
  const languages = getConfiguredPrettierHostLanguages(options);
  if (languages.length === 0) {
    return {
      enabled: false,
      languages: [],
      reason: 'disabled-no-languages-configured',
    };
  }

  return {
    enabled: true,
    languages,
    reason: resolvedRuntime?.reason ?? 'configured-languages',
  };
}

export function createPrettierHostAdapter(
  options: ServicePluginOrchestrationOptions
): LanguageServicePlugin | undefined {
  const plan = planPrettierAdapterRuntime(options);
  options.log?.(
    `[templjs-runtime] adapter=templjs-prettier-host enabled=${plan.enabled} reason=${plan.reason} languages=${plan.languages.join(',')}`
  );

  if (!plan.enabled) {
    return undefined;
  }

  const basePlugin = createVolarPrettierServicePlugin(prettier, {
    documentSelector: plan.languages,
  });

  return {
    ...basePlugin,
    name: 'templjs-prettier-host',
  };
}
