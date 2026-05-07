import type {
  ServicePluginOrchestrationOptions,
  TempljsHostServiceAdapterId,
} from './service-plugin-contract.js';

export type AdapterRuntimeCapability =
  | 'completion'
  | 'hover'
  | 'definition'
  | 'diagnostics'
  | 'formatting';

export type AdapterRuntimeResolutionMode = 'immediate' | 'deferred';

export type AdapterRuntimeManifestEntry = {
  id: TempljsHostServiceAdapterId;
  languageIds: string[];
  capabilities: AdapterRuntimeCapability[];
  resolutionMode: AdapterRuntimeResolutionMode;
};

export type AdapterRuntimeManifest = {
  version: 1;
  adapters: AdapterRuntimeManifestEntry[];
};

const BASE_ADAPTER_ENTRIES: AdapterRuntimeManifestEntry[] = [
  {
    id: 'templjs-markdown-host',
    languageIds: ['markdown', 'templjs-markdown'],
    capabilities: ['diagnostics'],
    resolutionMode: 'immediate',
  },
  {
    id: 'templjs-yaml',
    languageIds: ['yaml', 'templjs-yaml'],
    capabilities: ['diagnostics', 'completion'],
    resolutionMode: 'immediate',
  },
  {
    id: 'templjs-html-host',
    languageIds: ['html', 'templjs-html'],
    capabilities: ['diagnostics', 'completion', 'hover', 'definition'],
    resolutionMode: 'immediate',
  },
  {
    id: 'templjs-json-host',
    languageIds: ['json', 'templjs-json'],
    capabilities: ['diagnostics', 'completion', 'hover', 'definition'],
    resolutionMode: 'immediate',
  },
];

const SUPPORTED_PRETTIER_HOST_LANGUAGES = new Set(['markdown', 'json', 'yaml', 'html']);

export function getConfiguredPrettierHostLanguages(
  options: ServicePluginOrchestrationOptions
): string[] {
  const configured = options.initializationOptions?.prettierHostLanguages;
  if (!Array.isArray(configured)) {
    return [];
  }

  const normalized = configured
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => SUPPORTED_PRETTIER_HOST_LANGUAGES.has(value));

  return Array.from(new Set(normalized));
}

export function resolveAdapterRuntimeManifest(
  options: ServicePluginOrchestrationOptions
): AdapterRuntimeManifest {
  const adapters = [...BASE_ADAPTER_ENTRIES];
  const prettierHostLanguages = getConfiguredPrettierHostLanguages(options);

  if (prettierHostLanguages.length > 0) {
    adapters.push({
      id: 'templjs-prettier-host',
      languageIds: prettierHostLanguages,
      capabilities: ['formatting'],
      resolutionMode: 'deferred',
    });
  }

  return {
    version: 1,
    adapters,
  };
}
