import type { ServicePluginOrchestrationOptions } from './service-plugin-contract.js';
import type {
  AdapterRuntimeManifest,
  AdapterRuntimeResolution,
  TempljsHostServiceAdapterId,
} from './adapter-runtime-contract.js';
import {
  getConfiguredFormattingHostLanguages,
  listAdapterRuntimeEntries,
} from './adapter-registry.js';

const FORMATTING_ORCHESTRATOR_CONTRACT = {
  helperExtensionId: 'templjs.authoring.formatting',
  consumesSemanticKinds: ['templjs.binding', 'templjs.schema-path', 'templjs.semantic-zone'],
} as const;

export type FormattingOrchestrationContract = {
  helperExtensionId: string;
  consumesSemanticKinds: string[];
  source: 'manifest';
};

export function getConfiguredPrettierHostLanguages(
  options: ServicePluginOrchestrationOptions
): string[] {
  return getConfiguredFormattingHostLanguages(options);
}

export function resolveFormattingOrchestrationContract(): FormattingOrchestrationContract {
  return {
    helperExtensionId: FORMATTING_ORCHESTRATOR_CONTRACT.helperExtensionId,
    consumesSemanticKinds: [...FORMATTING_ORCHESTRATOR_CONTRACT.consumesSemanticKinds],
    source: 'manifest',
  };
}

export function resolveAdapterRuntimeManifest(
  options: ServicePluginOrchestrationOptions
): AdapterRuntimeManifest {
  const adapters = listAdapterRuntimeEntries()
    .map((entry) => entry.manifest(options))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

  return {
    version: 2,
    adapters,
  };
}

export function getResolvedAdapterRuntime(
  options: ServicePluginOrchestrationOptions,
  adapterId: TempljsHostServiceAdapterId
): AdapterRuntimeResolution | undefined {
  return options.initializationOptions?.adapterRuntimes?.[adapterId];
}
