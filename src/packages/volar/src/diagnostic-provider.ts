import { collectTemplateDiagnostics } from './diagnostic-template-analysis.js';
import { remapDiagnosticsToOriginal } from './diagnostic-remapping.js';
import { resolveDelimiters } from './template-delimiters.js';
import { createTempljsAuthoringProfile } from '@templjs/semantify';
import type { DiagnosticItem, DiagnosticOptions } from './diagnostic-types.js';

export { resolveScopedPathInText } from './diagnostic-template-analysis.js';
export { remapDiagnosticsToOriginal } from './diagnostic-remapping.js';
export { DiagnosticSeverity } from './diagnostic-types.js';
export type {
  DiagnosticItem,
  DiagnosticOptions,
  DiagnosticPosition,
  DiagnosticRange,
  TemplateDelimiters,
} from './diagnostic-types.js';

const DIAGNOSTIC_PLANNER_SOURCE =
  createTempljsAuthoringProfile().helperExtensions?.find(
    (helper) => helper.kind === 'diagnostic-planner'
  )?.id ?? 'templjs.authoring.diagnostics';

export function collectDiagnostics(text: string, options?: DiagnosticOptions): DiagnosticItem[] {
  const diagnostics = collectTemplateDiagnostics(text, options).map((diagnostic) => ({
    ...diagnostic,
    source: diagnostic.source ?? DIAGNOSTIC_PLANNER_SOURCE,
  }));

  if (options?.baseDiagnostics?.length) {
    const delimiters = resolveDelimiters(options.delimiters);
    diagnostics.push(...remapDiagnosticsToOriginal(text, options.baseDiagnostics, delimiters));
  }

  return diagnostics;
}
