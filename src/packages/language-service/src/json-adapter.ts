import type { LanguageServicePlugin } from '@volar/language-service';
import { create as createVolarJsonServicePlugin } from 'volar-service-json';
import type { ServicePluginOrchestrationOptions } from './service-plugin-contract.js';
import { getResolvedAdapterRuntime } from './runtime-manifest.js';

export type JsonAdapterRuntimePlan = {
  enabled: boolean;
  reason: string;
};

export function planJsonAdapterRuntime(
  options: ServicePluginOrchestrationOptions
): JsonAdapterRuntimePlan {
  const resolvedRuntime = getResolvedAdapterRuntime(options, 'templjs-json-host');
  if (resolvedRuntime) {
    return {
      enabled: resolvedRuntime.state === 'enabled',
      reason: resolvedRuntime.reason,
    };
  }

  if (options.initializationOptions?.jsonLSRegisteredForJson === false) {
    return {
      enabled: false,
      reason: 'disabled-json-ls-not-registered-for-json',
    };
  }

  return {
    enabled: true,
    reason: 'default-enabled',
  };
}

export function createJsonHostAdapter(
  options: ServicePluginOrchestrationOptions
): LanguageServicePlugin | undefined {
  const plan = planJsonAdapterRuntime(options);
  options.log?.(
    `[templjs-runtime] adapter=templjs-json-host enabled=${plan.enabled} reason=${plan.reason}`
  );

  if (!plan.enabled) {
    return undefined;
  }

  const basePlugin = createVolarJsonServicePlugin();
  return {
    ...basePlugin,
    name: 'templjs-json-host',
  };
}
