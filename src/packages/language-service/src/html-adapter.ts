import type { LanguageServicePlugin } from '@volar/language-service';
import { create as createVolarHtmlServicePlugin } from 'volar-service-html';
import type { ServicePluginOrchestrationOptions } from './service-plugin-contract.js';

export type HtmlAdapterRuntimePlan = {
  enabled: boolean;
  reason: 'default-enabled' | 'disabled-html-ls-not-registered-for-html';
};

export function planHtmlAdapterRuntime(
  options: ServicePluginOrchestrationOptions
): HtmlAdapterRuntimePlan {
  if (options.initializationOptions?.htmlLSRegisteredForHtml === false) {
    return {
      enabled: false,
      reason: 'disabled-html-ls-not-registered-for-html',
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
