import type { ServicePluginOrchestrationOptions } from './service-plugin-contract.js';
import type {
  AdapterRuntimeManifestEntry,
  AdapterRuntimeMap,
  AdapterRuntimeResolution,
  TempljsHostServiceAdapterId,
} from './adapter-runtime-contract.js';

export type AdapterRuntimeRegistryKey = TempljsHostServiceAdapterId;

export type AdapterRuntimeRegistryEntry = {
  id: AdapterRuntimeRegistryKey;
  manifest: (options: ServicePluginOrchestrationOptions) => AdapterRuntimeManifestEntry | undefined;
  resolveRuntime: (context: {
    formattingHostLanguages: string[];
    isExtensionInstalled: (extensionId: string) => boolean;
  }) => AdapterRuntimeResolution;
};

const BASE_PRETTIER_HOST_LANGUAGES = ['markdown', 'json', 'yaml', 'html'] as const;
const FORMATTER_EXTENSION_IDS = ['esbenp.prettier-vscode'] as const;
const supportedFormattingHostLanguages = new Set<string>(BASE_PRETTIER_HOST_LANGUAGES);

const adapterRuntimeRegistryMap = new Map<AdapterRuntimeRegistryKey, AdapterRuntimeRegistryEntry>();

export function getSupportedFormattingHostLanguages(): string[] {
  return [...BASE_PRETTIER_HOST_LANGUAGES];
}

export function getFormattingExtensionIds(): string[] {
  return [...FORMATTER_EXTENSION_IDS];
}

export function getFormattingLanguageConfigurationKeys(): string[] {
  return getSupportedFormattingHostLanguages().map((language) => `[${language}]`);
}

export function getConfiguredFormattingHostLanguages(
  options: ServicePluginOrchestrationOptions
): string[] {
  const configured =
    options.initializationOptions?.formattingHostLanguages ??
    options.initializationOptions?.prettierHostLanguages;
  if (!Array.isArray(configured)) {
    return [];
  }

  const normalized = configured
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => supportedFormattingHostLanguages.has(value));

  return Array.from(new Set(normalized));
}

const defaultAdapterRuntimeRegistryEntries: AdapterRuntimeRegistryEntry[] = [
  {
    id: 'templjs-markdown-host',
    manifest: () => ({
      id: 'templjs-markdown-host',
      languageIds: ['markdown', 'templjs-markdown'],
      capabilities: ['diagnostics', 'completion', 'hover', 'definition'],
      resolutionMode: 'immediate',
      requirements: {
        required: [{ kind: 'extension-id', id: 'vscode.markdown-language-features' }],
        optional: [{ kind: 'vscode-setting-key', key: '[markdown]' }],
      },
    }),
    resolveRuntime: ({ isExtensionInstalled }) => {
      const extensionId = 'vscode.markdown-language-features';
      const enabled = isExtensionInstalled(extensionId);
      return {
        state: enabled ? 'enabled' : 'unavailable',
        reason: enabled
          ? 'resolved-vscode-extension-markdown'
          : 'unavailable-vscode-extension-markdown',
        provider: {
          kind: 'vscode-extension',
          id: extensionId,
        },
        languageIds: ['markdown', 'templjs-markdown'],
      };
    },
  },
  {
    id: 'templjs-markdownlint-host',
    manifest: () => ({
      id: 'templjs-markdownlint-host',
      languageIds: ['markdown', 'templjs-markdown'],
      capabilities: ['diagnostics'],
      resolutionMode: 'deferred',
      requirements: {
        required: [{ kind: 'binary-name', name: 'markdownlint' }],
        optional: [
          { kind: 'env-var', name: 'PATH' },
          { kind: 'vscode-setting-key', key: '[markdown]' },
        ],
      },
    }),
    resolveRuntime: ({ isExtensionInstalled }) => {
      const extensionInstalled = isExtensionInstalled('DavidAnson.vscode-markdownlint');
      return {
        state: 'enabled',
        reason: extensionInstalled
          ? 'deferred-binary-resolution-markdownlint-extension-present'
          : 'deferred-binary-resolution-markdownlint',
        provider: {
          kind: 'binary',
          id: 'markdownlint',
        },
        languageIds: ['markdown', 'templjs-markdown'],
      };
    },
  },
  {
    id: 'templjs-yaml',
    manifest: () => ({
      id: 'templjs-yaml',
      languageIds: ['yaml', 'templjs-yaml'],
      capabilities: ['diagnostics', 'completion'],
      resolutionMode: 'immediate',
      requirements: {
        required: [{ kind: 'extension-id', id: 'redhat.vscode-yaml' }],
        optional: [{ kind: 'vscode-setting-key', key: '[yaml]' }],
      },
    }),
    resolveRuntime: ({ isExtensionInstalled }) => {
      const extensionId = 'redhat.vscode-yaml';
      const enabled = isExtensionInstalled(extensionId);
      return {
        state: enabled ? 'enabled' : 'unavailable',
        reason: enabled ? 'resolved-vscode-extension-yaml' : 'unavailable-vscode-extension-yaml',
        provider: {
          kind: 'vscode-extension',
          id: extensionId,
        },
        languageIds: ['yaml', 'templjs-yaml'],
      };
    },
  },
  {
    id: 'templjs-html-host',
    manifest: () => ({
      id: 'templjs-html-host',
      languageIds: ['html', 'templjs-html'],
      capabilities: ['diagnostics', 'completion', 'hover', 'definition'],
      resolutionMode: 'immediate',
      requirements: {
        required: [{ kind: 'extension-id', id: 'vscode.html-language-features' }],
        optional: [{ kind: 'vscode-setting-key', key: '[html]' }],
      },
    }),
    resolveRuntime: ({ isExtensionInstalled }) => {
      const extensionId = 'vscode.html-language-features';
      const enabled = isExtensionInstalled(extensionId);
      return {
        state: enabled ? 'enabled' : 'unavailable',
        reason: enabled ? 'resolved-vscode-extension-html' : 'unavailable-vscode-extension-html',
        provider: {
          kind: 'vscode-extension',
          id: extensionId,
        },
        languageIds: ['html', 'templjs-html'],
      };
    },
  },
  {
    id: 'templjs-json-host',
    manifest: () => ({
      id: 'templjs-json-host',
      languageIds: ['json', 'templjs-json'],
      capabilities: ['diagnostics', 'completion', 'hover', 'definition'],
      resolutionMode: 'immediate',
      requirements: {
        required: [{ kind: 'extension-id', id: 'vscode.json-language-features' }],
        optional: [{ kind: 'vscode-setting-key', key: '[json]' }],
      },
    }),
    resolveRuntime: ({ isExtensionInstalled }) => {
      const extensionId = 'vscode.json-language-features';
      const enabled = isExtensionInstalled(extensionId);
      return {
        state: enabled ? 'enabled' : 'unavailable',
        reason: enabled ? 'resolved-vscode-extension-json' : 'unavailable-vscode-extension-json',
        provider: {
          kind: 'vscode-extension',
          id: extensionId,
        },
        languageIds: ['json', 'templjs-json'],
      };
    },
  },
  {
    id: 'templjs-prettier-host',
    manifest: (options) => {
      const formattingHostLanguages = getConfiguredFormattingHostLanguages(options);
      if (formattingHostLanguages.length === 0) {
        return undefined;
      }

      return {
        id: 'templjs-prettier-host',
        languageIds: formattingHostLanguages,
        capabilities: ['formatting'],
        resolutionMode: 'deferred',
        requirements: {
          required: [{ kind: 'extension-id', id: 'esbenp.prettier-vscode' }],
          optional: [
            { kind: 'vscode-setting-key', key: 'editor.defaultFormatter' },
            { kind: 'vscode-setting-key', key: '[markdown]' },
            { kind: 'vscode-setting-key', key: '[json]' },
            { kind: 'vscode-setting-key', key: '[yaml]' },
            { kind: 'vscode-setting-key', key: '[html]' },
          ],
        },
      };
    },
    resolveRuntime: ({ formattingHostLanguages }) => ({
      state: formattingHostLanguages.length > 0 ? 'enabled' : 'disabled',
      reason:
        formattingHostLanguages.length > 0
          ? 'resolved-vscode-formatter-selection'
          : 'disabled-no-prettier-host-languages',
      provider: {
        kind: 'vscode-extension',
        id: 'esbenp.prettier-vscode',
      },
      languageIds: formattingHostLanguages,
      settings: {
        formattingHostLanguages,
      },
    }),
  },
];

for (const entry of defaultAdapterRuntimeRegistryEntries) {
  adapterRuntimeRegistryMap.set(entry.id, entry);
}

export function registerAdapterRuntimeEntry(entry: AdapterRuntimeRegistryEntry): void {
  adapterRuntimeRegistryMap.set(entry.id, entry);
}

export function unregisterAdapterRuntimeEntry(id: AdapterRuntimeRegistryKey): boolean {
  return adapterRuntimeRegistryMap.delete(id);
}

export function getAdapterRuntimeEntry(
  id: AdapterRuntimeRegistryKey
): AdapterRuntimeRegistryEntry | undefined {
  return adapterRuntimeRegistryMap.get(id);
}

export function listAdapterRuntimeEntries(): AdapterRuntimeRegistryEntry[] {
  return [...adapterRuntimeRegistryMap.values()];
}

export function resolveAdapterRuntimeMapFromRegistry(context: {
  formattingHostLanguages: string[];
  isExtensionInstalled: (extensionId: string) => boolean;
}): AdapterRuntimeMap {
  const runtimes: AdapterRuntimeMap = {};

  for (const entry of listAdapterRuntimeEntries()) {
    runtimes[entry.id] = entry.resolveRuntime(context);
  }

  return runtimes;
}
