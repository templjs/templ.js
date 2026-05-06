import type { LanguagePlugin } from '@volar/language-core';
import type { URI } from 'vscode-uri';
import { createTempljsLanguagePlugin, type TempljsLanguagePluginOptions } from '@templjs/volar';

export function createTempljsLanguagePlugins(
  options: TempljsLanguagePluginOptions = {}
): LanguagePlugin<URI>[] {
  return [createTempljsLanguagePlugin(options)];
}

export type { TempljsLanguagePluginOptions };

export type {
  TempljsDelimiterConfig,
  TempljsDocumentSnapshotId,
  TempljsGeneratedCodePurpose,
  TempljsHostLanguage,
  TempljsLanguageServerInitializationOptions,
  TempljsParseDiagnosticRef,
  TempljsSchemaSourceRef,
  TempljsSemanticZoneRef,
  TempljsSourceFileKind,
  TempljsVirtualDocumentMetadata,
} from './public-types.js';
