import type { LanguageServicePlugin } from '@volar/language-service';
import { create as createVolarJsonServicePlugin } from 'volar-service-json';
import type { ServicePluginOrchestrationOptions } from './service-plugin-contract.js';

export type JsonAdapterRuntimePlan = {
  enabled: boolean;
  reason: 'default-enabled' | 'disabled-json-ls-not-registered-for-json';
};

export function planJsonAdapterRuntime(
  options: ServicePluginOrchestrationOptions
): JsonAdapterRuntimePlan {
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
