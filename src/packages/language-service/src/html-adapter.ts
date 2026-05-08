import type { LanguageServicePlugin } from '@volar/language-service';
import { create as createVolarHtmlServicePlugin } from 'volar-service-html';
import type { ServicePluginOrchestrationOptions } from './service-plugin-contract.js';
import { getResolvedAdapterRuntime } from './runtime-manifest.js';

export type HtmlAdapterRuntimePlan = {
  enabled: boolean;
  reason: string;
};

export function planHtmlAdapterRuntime(
  options: ServicePluginOrchestrationOptions
): HtmlAdapterRuntimePlan {
  const resolvedRuntime = getResolvedAdapterRuntime(options, 'templjs-html-host');
  if (resolvedRuntime) {
    return {
      enabled: resolvedRuntime.state === 'enabled',
      reason: resolvedRuntime.reason,
    };
  }

  return {
    enabled: true,
    reason: 'default-enabled',
  };
}

export function createHtmlHostAdapter(
  options: ServicePluginOrchestrationOptions
): LanguageServicePlugin | undefined {
  const plan = planHtmlAdapterRuntime(options);
  options.log?.(
    `[templjs-runtime] adapter=templjs-html-host enabled=${plan.enabled} reason=${plan.reason}`
  );

  if (!plan.enabled) {
    return undefined;
  }

  const basePlugin = createVolarHtmlServicePlugin();
  return {
    ...basePlugin,
    name: 'templjs-html-host',
  };
}
