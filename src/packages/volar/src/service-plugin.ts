/**
 * Templjs Service Plugin
 *
 * Encapsulates all templjs-specific LSP handler logic and provider interaction.
 * This plugin wraps the Volar providers and handles LSP protocol mapping,
 * making integration with different IDEs simpler.
 */

import { collectDiagnostics, IntellisenseProvider } from './index.js';
import type { IntellisenseOptions } from './index.js';

export interface ServicePluginDiagnosticOptions {
  schema?: object;
  contentSchema?: object;
  frontmatterRange?: { start: number; end: number };
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
    kind: string;
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
  private intellisenseProvider = new IntellisenseProvider();

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
   * Handles scope resolution internally to map aliases to canonical schema paths
   * Returns LSP-ready definition location
   */
  getDefinition(
    text: string,
    offset: number,
    options?: IntellisenseOptions
  ): LSPDefinitionLocation | null {
    const definition = this.intellisenseProvider.getDefinition(text, offset, options);
    if (!definition) {
      return null;
    }

    if (definition.range) {
      return {
        uri: definition.uri,
        range: definition.range,
      };
    }

    // For simple case without range resolution, return basic location
    // Note: Scope resolution happens in getDefinitionWithRangeResolver below
    return {
      uri: definition.uri,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
    };
  }

  /**
   * Get definition location, resolving schema path if needed
   * Caller must provide schema path resolution function
   */
  getDefinitionWithRangeResolver(
    text: string,
    offset: number,
    options: IntellisenseOptions | undefined,
    getRangeForUri: (
      uri: string,
      path: string,
      pathKind?: 'property' | 'value',
      valueToken?: string
    ) => { start: { line: number; character: number }; end: { line: number; character: number } }
  ): LSPDefinitionLocation | null {
    const definition = this.intellisenseProvider.getDefinition(text, offset, options);
    if (!definition) {
      return null;
    }

    if (definition.range) {
      return {
        uri: definition.uri,
        range: definition.range,
      };
    }

    if (!definition.path) {
      return null;
    }

    const range = getRangeForUri(
      definition.uri,
      definition.path,
      definition.pathKind,
      definition.valueToken
    );

    return {
      uri: definition.uri,
      range,
    };
  }

  /**
   * Collect diagnostics for the given text
   * Returns LSP-ready diagnostic items
   */
  collectDiagnostics(text: string, options?: ServicePluginDiagnosticOptions): LSPDiagnostic[] {
    const diagnostics = collectDiagnostics(text, {
      schema: options?.schema,
      contentSchema: options?.contentSchema,
      frontmatterRange: options?.frontmatterRange,
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
