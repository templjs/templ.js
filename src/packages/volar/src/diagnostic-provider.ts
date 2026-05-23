import { collectTemplateDiagnostics } from './diagnostic-template-analysis.js';
import { remapDiagnosticsToOriginal } from './diagnostic-remapping.js';
import { resolveDelimiters } from './template-delimiters.js';
import { createTempljsAuthoringProfile } from '@templjs/semantify';
import type { DiagnosticOptions, SemanticDiagnosticRecord } from './diagnostic-types.js';

export { resolveScopedPathInText } from './diagnostic-template-analysis.js';
export { remapDiagnosticsToOriginal } from './diagnostic-remapping.js';
export { DiagnosticSeverity } from './diagnostic-types.js';
export type {
  DiagnosticOptions,
  DiagnosticPosition,
  DiagnosticRange,
  SemanticDiagnosticRecord,
  TemplateDelimiters,
} from './diagnostic-types.js';

const DIAGNOSTIC_PROVIDER_SOURCE =
  createTempljsAuthoringProfile().helperExtensions?.find(
    (helper) => helper.kind === 'diagnostic-provider'
  )?.id ?? 'templjs.authoring.diagnostic-provider';

export function collectDiagnostics(
  text: string,
  options?: DiagnosticOptions
): SemanticDiagnosticRecord[] {
  const diagnostics = collectTemplateDiagnostics(text, options).map<SemanticDiagnosticRecord>(
    (diagnostic) => ({
      ...diagnostic,
      source: diagnostic.source ?? DIAGNOSTIC_PROVIDER_SOURCE,
    })
  );

  if (options?.baseSyntaxDiagnostics?.length) {
    const delimiters = resolveDelimiters(options.delimiters);
    diagnostics.push(
      ...remapDiagnosticsToOriginal(text, options.baseSyntaxDiagnostics, delimiters)
    );
  }

  return diagnostics;
}
