/**
 * @templjs/volar - Volar language server plugin for templjs
 *
 * This package provides Volar integration for IDE support including:
 * - Syntax highlighting
 * - Diagnostics and error reporting
 * - IntelliSense and autocompletion
 * - Virtual code mapping for base format delegation
 */

import type { CodeInformation, LanguagePlugin, VirtualCode } from '@volar/language-core';
import type * as ts from 'typescript';

/**
 * Base format types that templates can embed
 */
type BaseFormat = 'markdown' | 'json' | 'yaml' | 'html' | 'plain';

/**
 * Mapping between file extension and base format language ID
 */
const EXTENSION_TO_BASE_FORMAT: Record<string, BaseFormat> = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.html': 'html',
  '.htm': 'html',
};

const TEMPLATE_MARKERS = ['.templ.', '.tmpl.'] as const;

const DEFAULT_CODE_INFORMATION: CodeInformation = {
  verification: true,
  completion: true,
  semantic: true,
  navigation: true,
  structure: true,
  format: true,
};

/**
 * Map base format to VS Code language ID
 */
function getBaseFormatLanguageId(baseFormat: BaseFormat): string {
  switch (baseFormat) {
    case 'markdown':
      return 'markdown';
    case 'json':
      return 'json';
    case 'yaml':
      return 'yaml';
    case 'html':
      return 'html';
    case 'plain':
    default:
      return 'plaintext';
  }
}

/**
 * Detect base format from file extension
 */
function detectBaseFormat(fileUriString: string): BaseFormat {
  try {
    // Extract filename from URI (handle both file:// and regular paths)
    const filePath = fileUriString.replace(/^file:\/\//, '').replace(/^.*\//, '');

    for (const marker of TEMPLATE_MARKERS) {
      if (!filePath.includes(marker)) continue;
      const ext = '.' + filePath.split(marker)[1];
      const format = EXTENSION_TO_BASE_FORMAT[ext];
      if (format) return format;
    }

    if (filePath.endsWith('.tmpl') || filePath.endsWith('.templ')) {
      const suffixLength = filePath.endsWith('.tmpl') ? 5 : 6;
      const baseName = filePath.slice(0, -suffixLength);
      const lastDot = baseName.lastIndexOf('.');
      if (lastDot > -1) {
        const ext = baseName.slice(lastDot);
        const format = EXTENSION_TO_BASE_FORMAT[ext];
        if (format) return format;
      }
    }
  } catch {
    // Fallback to plain text
  }

  return 'plain';
}

/**
 * Virtual code representation with stripped template syntax
 */
class TempljsVirtualCode implements VirtualCode {
  id = 'root';
  languageId: string;
  snapshot: ts.IScriptSnapshot;
  mappings: Array<{
    sourceOffsets: number[];
    generatedOffsets: number[];
    lengths: number[];
    data: CodeInformation;
  }> = [];
  embeddedCodes: VirtualCode[] = [];

  constructor(original: string, baseFormat: BaseFormat, snapshot: ts.IScriptSnapshot) {
    this.languageId = getBaseFormatLanguageId(baseFormat);
    this.snapshot = snapshot;

    // Generate cleaned code (strip template syntax)
    const { cleaned, mappings: positionMappings } = this.stripTemplateSyntax(original);

    // Create position mappings for accurate error reporting
    this.mappings = this.createMappings(original, cleaned, positionMappings);
  }

  /**
   * Strip template syntax while preserving line structure for accurate error reporting
   */
  private stripTemplateSyntax(source: string): {
    cleaned: string;
    mappings: Array<{ src: number; dst: number }>;
  } {
    const mappings: Array<{ src: number; dst: number }> = [];
    let cleaned = '';
    let dstPos = 0;

    // Simple regex-based stripping for now
    // Matches: {% ... %}, {{ ... }}, {# ... #}
    const templatePattern = /(\{[%#{][\s\S]*?[%#}]\})/g;
    let lastIndex = 0;
    let match;

    while ((match = templatePattern.exec(source)) !== null) {
      // Add content before template block
      const beforeBlock = source.substring(lastIndex, match.index);
      cleaned += beforeBlock;
      dstPos += beforeBlock.length;

      // Replace template block with whitespace (preserve line structure)
      const templateBlock = match[0];
      const placeholder = templateBlock
        .split('\n')
        .map((line, idx) => (idx === 0 ? ' '.repeat(line.length) : '\n'))
        .join('');

      cleaned += placeholder;
      dstPos += placeholder.length;

      mappings.push({
        src: lastIndex,
        dst: dstPos - placeholder.length,
      });

      lastIndex = templatePattern.lastIndex;
    }

    // Add remaining content
    const remaining = source.substring(lastIndex);
    cleaned += remaining;

    return { cleaned, mappings };
  }

  /**
   * Create Volar-compatible position mappings
   */
  private createMappings(
    original: string,
    cleaned: string,
    _positionMappings: Array<{ src: number; dst: number }>
  ): VirtualCode['mappings'] {
    if (original === cleaned) {
      // No changes needed, create identity mapping
      return [
        {
          sourceOffsets: [0],
          generatedOffsets: [0],
          lengths: [original.length],
          data: DEFAULT_CODE_INFORMATION,
        },
      ];
    }

    // Create offset-based mappings
    return [
      {
        sourceOffsets: [0],
        generatedOffsets: [0],
        lengths: [Math.min(original.length, cleaned.length)],
        data: DEFAULT_CODE_INFORMATION,
      },
    ];
  }
}

export const version = '0.1.0';

/**
 * Create the templjs language plugin for Volar
 *
 * This plugin:
 * 1. Detects file format from extension
 * 2. Generates cleaned code without template syntax
 * 3. Delegates to base format language servers (markdown, JSON, etc.)
 * 4. Maintains position mappings for accurate error reporting
 */
export function createTempljsLanguagePlugin(): LanguagePlugin {
  return {
    createVirtualCode(uri: string, _languageId: string, snapshot: ts.IScriptSnapshot): VirtualCode {
      // Detect base format from file extension
      const baseFormat = detectBaseFormat(uri);

      // Get the original source code from snapshot
      const source = snapshot.getText(0, snapshot.getLength());

      // Create virtual code with stripped template syntax
      const virtualCode = new TempljsVirtualCode(source, baseFormat, snapshot);

      return virtualCode;
    },

    updateVirtualCode(
      uri: string,
      _virtualCode: TempljsVirtualCode,
      snapshot: ts.IScriptSnapshot
    ): TempljsVirtualCode {
      // Recalculate virtual code on document change
      const source = snapshot.getText(0, snapshot.getLength());
      const baseFormat = detectBaseFormat(uri);

      return new TempljsVirtualCode(source, baseFormat, snapshot);
    },
  };
}

export default {
  version,
  createTempljsLanguagePlugin,
};

export * from './diagnostic-provider';
