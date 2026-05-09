import type { LanguageServicePlugin } from '@volar/language-service';
import type { TempljsHostServiceAdapterId } from './adapter-runtime-contract.js';
import type { ServicePluginOrchestrationOptions } from './service-plugin-contract.js';
import {
  createMarkdownHostDiagnosticsAdapter,
  createMarkdownlintHostDiagnosticsAdapter,
} from './markdown-adapter.js';
import { createYamlHostDiagnosticsAdapter } from './yaml-adapter.js';
import { createHtmlHostAdapter } from './html-adapter.js';
import { createJsonHostAdapter } from './json-adapter.js';
import { createPrettierHostAdapter } from './prettier-adapter.js';

export type HostAdapterPluginRegistryKey = TempljsHostServiceAdapterId;

export type HostAdapterPluginFactory = (
  options: ServicePluginOrchestrationOptions
) => LanguageServicePlugin | undefined;

const hostAdapterPluginRegistryMap = new Map<
  HostAdapterPluginRegistryKey,
  HostAdapterPluginFactory
>([
  ['templjs-markdown-host', createMarkdownHostDiagnosticsAdapter],
  ['templjs-markdownlint-host', createMarkdownlintHostDiagnosticsAdapter],
  ['templjs-yaml', createYamlHostDiagnosticsAdapter],
  ['templjs-html-host', createHtmlHostAdapter],
  ['templjs-json-host', createJsonHostAdapter],
  ['templjs-prettier-host', createPrettierHostAdapter],
]);

export function registerHostAdapterPlugin(
  key: HostAdapterPluginRegistryKey,
  factory: HostAdapterPluginFactory
): void {
  hostAdapterPluginRegistryMap.set(key, factory);
}

export function unregisterHostAdapterPlugin(key: HostAdapterPluginRegistryKey): boolean {
  return hostAdapterPluginRegistryMap.delete(key);
}

export function getHostAdapterPluginFactory(
  key: HostAdapterPluginRegistryKey
): HostAdapterPluginFactory | undefined {
  return hostAdapterPluginRegistryMap.get(key);
}

export function listHostAdapterPluginKeys(): HostAdapterPluginRegistryKey[] {
  return [...hostAdapterPluginRegistryMap.keys()];
}
