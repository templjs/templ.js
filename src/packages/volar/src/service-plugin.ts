/**
 * Templjs Service Plugin
 *
 * Encapsulates all templjs-specific LSP handler logic and provider interaction.
 * This plugin wraps the Volar providers and handles LSP protocol mapping,
 * making integration with different IDEs simpler.
 */

import { collectDiagnostics } from './diagnostic-provider.js';
import { IntellisenseProvider, type IntellisenseOptions } from './intellisense-provider.js';

export interface ServicePluginDiagnosticOptions {
  documentUri?: string;
  schema?: object;
  contentSchema?: object;
  frontmatterRange?: { start: number; end: number };
  customFilters?: string[];
  delimiters?: {
    statementStart?: string;
    statementEnd?: string;
    expressionStart?: string;
    expressionEnd?: string;
    commentStart?: string;
    commentEnd?: string;
  };
  baseDiagnostics?: LSPDiagnostic[];
}

export interface LSPDiagnostic {
  message: string;
  severity: number;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  source?: string;
  code?: string;
}

export interface LSPCompletionItem {
  label: string;
  detail?: string;
  documentation?: string;
  kind: number;
}

export interface LSPHoverInfo {
  contents: {
    kind: 'markdown' | 'plaintext';
    value: string;
  };
}

export interface LSPDefinitionLocation {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

const COMPLETION_KIND = {
  Function: 3,
  Variable: 6,
  Keyword: 14,
} as const;

/**
 * Service plugin for Templjs language support
 *
 * Provides LSP-ready methods for completion, hover, definition, and diagnostics.
 * Internally manages provider instances and handles all protocol mapping.
 */
export class TempljsServicePlugin {
  private readonly intellisenseProvider: IntellisenseProvider;

  constructor(intellisenseProvider: IntellisenseProvider = new IntellisenseProvider()) {
    this.intellisenseProvider = intellisenseProvider;
  }

  /**
   * Get completions at the given offset in text
   * Returns LSP-ready completion items
   */
  getCompletions(text: string, offset: number, options?: IntellisenseOptions): LSPCompletionItem[] {
    const items = this.intellisenseProvider.getCompletions(text, offset, options);
    return items.map((item) => ({
      label: item.label,
      detail: item.detail,
      documentation: item.documentation,
      kind:
        item.kind === 'property' || item.kind === 'variable'
          ? COMPLETION_KIND.Variable
          : item.kind === 'filter'
            ? COMPLETION_KIND.Function
            : COMPLETION_KIND.Keyword,
    }));
  }

  /**
   * Get hover information at the given offset
   * Returns LSP-ready hover info
   */
  getHover(text: string, offset: number, options?: IntellisenseOptions): LSPHoverInfo | null {
    const hover = this.intellisenseProvider.getHover(text, offset, options);
    if (!hover) {
      return null;
    }

    return {
      contents: {
        kind: 'markdown',
        value: hover.contents,
      },
    };
  }

  /**
   * Get definition location at the given offset
   * Returns LSP-ready definition location
   */
  getDefinition(
    text: string,
    offset: number,
    options?: IntellisenseOptions
  ): LSPDefinitionLocation | null {
    const definition = this.intellisenseProvider.getDefinition(text, offset, options);
    if (!definition || !definition.range) {
      return null;
    }

    return {
      uri: definition.uri,
      range: definition.range,
    };
  }

  /**
   * Collect diagnostics for the given text
   * Returns LSP-ready diagnostic items
   */
  collectDiagnostics(text: string, options?: ServicePluginDiagnosticOptions): LSPDiagnostic[] {
    const diagnostics = collectDiagnostics(text, {
      documentUri: options?.documentUri,
      schema: options?.schema,
      contentSchema: options?.contentSchema,
      frontmatterRange: options?.frontmatterRange,
      customFilters: options?.customFilters,
      delimiters: options?.delimiters,
      baseDiagnostics: options?.baseDiagnostics,
    });

    return diagnostics.map((diagnostic) => ({
      message: diagnostic.message,
      severity: diagnostic.severity,
      range: diagnostic.range,
      source: diagnostic.source ?? 'templjs',
      code: diagnostic.code,
    }));
  }
}
