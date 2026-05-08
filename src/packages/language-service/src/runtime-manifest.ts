import type {
  ServicePluginOrchestrationOptions,
} from './service-plugin-contract.js';
import type {
  AdapterRuntimeManifest,
  AdapterRuntimeManifestEntry,
  AdapterRuntimeResolution,
  TempljsHostServiceAdapterId,
} from './adapter-runtime-contract.js';

const BASE_ADAPTER_ENTRIES: AdapterRuntimeManifestEntry[] = [
  {
    id: 'templjs-markdown-host',
    languageIds: ['markdown', 'templjs-markdown'],
    capabilities: ['diagnostics'],
    resolutionMode: 'immediate',
    requirements: {
      extensionIds: ['DavidAnson.vscode-markdownlint'],
      settingsKeys: ['[markdown]'],
    },
  },
  {
    id: 'templjs-yaml',
    languageIds: ['yaml', 'templjs-yaml'],
    capabilities: ['diagnostics', 'completion'],
    resolutionMode: 'immediate',
    requirements: {
      extensionIds: ['redhat.vscode-yaml'],
      settingsKeys: ['[yaml]'],
    },
  },
  {
    id: 'templjs-html-host',
    languageIds: ['html', 'templjs-html'],
    capabilities: ['diagnostics', 'completion', 'hover', 'definition'],
    resolutionMode: 'immediate',
    requirements: {
      extensionIds: ['vscode.html-language-features'],
      settingsKeys: ['[html]'],
    },
  },
  {
    id: 'templjs-json-host',
    languageIds: ['json', 'templjs-json'],
    capabilities: ['diagnostics', 'completion', 'hover', 'definition'],
    resolutionMode: 'immediate',
    requirements: {
      extensionIds: ['vscode.json-language-features'],
      settingsKeys: ['[json]'],
    },
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
      requirements: {
        extensionIds: ['esbenp.prettier-vscode'],
        settingsKeys: ['editor.defaultFormatter', '[markdown]', '[json]', '[yaml]', '[html]'],
      },
    });
  }

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
