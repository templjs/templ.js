import { collectTemplateDiagnostics } from './diagnostic-template-analysis.js';
import { remapDiagnosticsToOriginal } from './diagnostic-remapping.js';
import { resolveDelimiters } from './template-delimiters.js';
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

export function collectDiagnostics(text: string, options?: DiagnosticOptions): DiagnosticItem[] {
  const diagnostics = collectTemplateDiagnostics(text, options);

  if (options?.baseDiagnostics?.length) {
    const delimiters = resolveDelimiters(options.delimiters);
    diagnostics.push(...remapDiagnosticsToOriginal(text, options.baseDiagnostics, delimiters));
  }

  return diagnostics;
}
