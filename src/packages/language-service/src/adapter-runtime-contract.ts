export type TempljsHostServiceAdapterId = `templjs-${string}`;

export const ADAPTER_RUNTIME_CAPABILITIES = [
  'completion',
  'hover',
  'definition',
  'diagnostics',
  'formatting',
] as const;

export type AdapterRuntimeCapability = (typeof ADAPTER_RUNTIME_CAPABILITIES)[number];

export type AdapterRuntimeResolutionMode = 'immediate' | 'deferred';

export const ADAPTER_RUNTIME_PROVIDER_KINDS = [
  'vscode-extension',
  'library',
  'language-server',
  'binary',
] as const;

export type AdapterRuntimeProviderKind = (typeof ADAPTER_RUNTIME_PROVIDER_KINDS)[number];

export type AdapterRuntimeProvider = {
  kind: AdapterRuntimeProviderKind;
  id: string;
};

export type AdapterRuntimeRequirement =
  | {
      kind: 'extension-id';
      id: string;
    }
  | {
      kind: 'vscode-setting-key';
      key: string;
    }
  | {
      kind: 'env-var';
      name: string;
    }
  | {
      kind: 'binary-name';
      name: string;
    }
  | {
      kind: 'jsonpath';
      path: string;
    };

export type AdapterRuntimeRequirements = {
  required?: AdapterRuntimeRequirement[];
  optional?: AdapterRuntimeRequirement[];
};

export type AdapterRuntimeManifestEntry = {
  id: TempljsHostServiceAdapterId;
  languageIds: string[];
  capabilities: AdapterRuntimeCapability[];
  resolutionMode: AdapterRuntimeResolutionMode;
  requirements: AdapterRuntimeRequirements;
};

export type AdapterRuntimeManifest = {
  /**
   * Manifest schema version.
   *
   * v2 represents the two-phase runtime model from ADR-009 where adapters
   * publish deterministic manifest metadata and runtimes are resolved lazily.
   */
  version: 2;
  adapters: AdapterRuntimeManifestEntry[];
};

export type AdapterRuntimeResolutionState = 'enabled' | 'disabled' | 'unavailable';

export type AdapterRuntimeResolution = {
  state: AdapterRuntimeResolutionState;
  reason: string;
  provider?: AdapterRuntimeProvider;
  languageIds?: string[];
  settings?: Record<string, unknown>;
  binaryPath?: string;
};

export type AdapterRuntimeMap = Partial<
  Record<TempljsHostServiceAdapterId, AdapterRuntimeResolution>
>;
