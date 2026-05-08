export type TempljsHostServiceAdapterId =
  | 'templjs-markdown-host'
  | 'templjs-yaml'
  | 'templjs-html-host'
  | 'templjs-json-host'
  | 'templjs-prettier-host';

export type AdapterRuntimeCapability =
  | 'completion'
  | 'hover'
  | 'definition'
  | 'diagnostics'
  | 'formatting';

export type AdapterRuntimeResolutionMode = 'immediate' | 'deferred';

export type AdapterRuntimeProvider = {
  kind: 'vscode-extension' | 'library';
  id: string;
};

export type AdapterRuntimeRequirements = {
  extensionIds?: string[];
  settingsKeys?: string[];
  binaryNames?: string[];
};

export type AdapterRuntimeManifestEntry = {
  id: TempljsHostServiceAdapterId;
  languageIds: string[];
  capabilities: AdapterRuntimeCapability[];
  resolutionMode: AdapterRuntimeResolutionMode;
  requirements: AdapterRuntimeRequirements;
};

export type AdapterRuntimeManifest = {
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