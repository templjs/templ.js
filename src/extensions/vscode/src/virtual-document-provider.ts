/**
 * Virtual document provider for templjs host language delegation.
 *
 * Registers a `templjs-virtual://` URI scheme and serves cleaned template content
 * (template expressions masked to whitespace) so VS Code routes embedded documents
 * to whatever language server the user has configured for that base format — markdown,
 * JSON, YAML, HTML, etc. — without any hardcoded dependency on a specific linter.
 *
 * Diagnostics produced by host language servers against virtual URIs are collected via
 * `vscode.languages.onDidChangeDiagnostics` and re-mapped to source file positions using
 * the offset tables built during template cleaning.
 */

import * as vscode from 'vscode';
import { cleanTemplateContent } from '@templjs/volar';

export const VIRTUAL_SCHEME = 'templjs-virtual';
const VIRTUAL_AUTHORITY = 'host';

interface VirtualDocumentEntry {
  cleaned: string;
  /** cleanedToSourceOffsets[cleanedOffset] = sourceOffset (length = cleaned.length + 1) */
  cleanedToSourceOffsets: number[];
  cleanedLineOffsets: number[];
  sourceLineOffsets: number[];
}

function computeLineOffsets(text: string): number[] {
  const offsets: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

/**
 * Invert the originalToCleanedOffsets map so we can go from a cleaned offset back to its
 * source offset. Gaps (positions inside masked template blocks) are filled with the nearest
 * preceding mapped source offset so diagnostics pointing into placeholder whitespace still
 * round-trip to a valid source location.
 */
function buildCleanedToSourceOffsets(
  originalToCleanedOffsets: number[],
  cleanedLength: number
): number[] {
  const result = new Array<number>(cleanedLength + 1).fill(-1);

  for (let src = 0; src < originalToCleanedOffsets.length; src++) {
    const dst = originalToCleanedOffsets[src];
    if (dst !== undefined && dst <= cleanedLength && result[dst] === -1) {
      result[dst] = src;
    }
  }

  // Fill forward gaps with the nearest known source offset
  let lastKnown = 0;
  for (let i = 0; i <= cleanedLength; i++) {
    if (result[i] !== -1) {
      lastKnown = result[i];
    } else {
      result[i] = lastKnown;
    }
  }

  return result;
}

/**
 * Returns the synthetic file extension appended to virtual URIs so VS Code selects
 * the right language server. E.g. `example.md.tmpl` → virtual path ends in `.md`.
 */
function baseFormatExtension(fsPath: string): string {
  if (/\.(md|markdown)\.(templ|tmpl|tpl)$/i.test(fsPath)) return '.md';
  if (/\.json\.(templ|tmpl|tpl)$/i.test(fsPath)) return '.json';
  if (/\.ya?ml\.(templ|tmpl|tpl)$/i.test(fsPath)) return '.yaml';
  if (/\.html?\.(templ|tmpl|tpl)$/i.test(fsPath)) return '.html';
  return '.txt';
}

const VIRTUAL_EXTENSIONS = ['.md', '.json', '.yaml', '.html', '.txt'] as const;

function stripVirtualExtension(path: string): string {
  for (const ext of VIRTUAL_EXTENSIONS) {
    if (path.endsWith(ext)) {
      return path.slice(0, -ext.length);
    }
  }
  return path;
}

/**
 * TextDocumentContentProvider for the `templjs-virtual://` scheme.
 *
 * Lifecycle:
 *  1. `update(sourceUri, rawText)` — called whenever a templjs document opens or changes.
 *     Cleans the template text, builds offset maps, fires `onDidChange`.
 *  2. VS Code calls `provideTextDocumentContent` to serve the virtual document.
 *  3. Host language servers (markdownlint, remark, JSON, YAML…) produce diagnostics.
 *  4. `mapDiagnosticToSource` remaps virtual positions back to source positions.
 */
export class TempljsVirtualDocumentProvider implements vscode.TextDocumentContentProvider {
  private readonly entries = new Map<string, VirtualDocumentEntry>();
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  /**
   * Recompute the virtual document entry for `sourceUri` from the latest raw text.
   * Returns the virtual URI that was updated (or created).
   */
  update(sourceUri: vscode.Uri, rawText: string): vscode.Uri {
    const { cleaned, originalToCleanedOffsets } = cleanTemplateContent(rawText);
    const cleanedToSourceOffsets = buildCleanedToSourceOffsets(
      originalToCleanedOffsets,
      cleaned.length
    );

    this.entries.set(sourceUri.toString(), {
      cleaned,
      cleanedToSourceOffsets,
      cleanedLineOffsets: computeLineOffsets(cleaned),
      sourceLineOffsets: computeLineOffsets(rawText),
    });

    const virtualUri = this.toVirtualUri(sourceUri);
    this._onDidChange.fire(virtualUri);
    return virtualUri;
  }

  remove(sourceUri: vscode.Uri): void {
    this.entries.delete(sourceUri.toString());
  }

  hasEntry(sourceUri: vscode.Uri): boolean {
    return this.entries.has(sourceUri.toString());
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    const sourceUri = this.toSourceUri(uri);
    return this.entries.get(sourceUri.toString())?.cleaned ?? '';
  }

  /**
   * Derive the `templjs-virtual://host/<path>.<ext>` URI for a source file.
   * The appended extension causes VS Code to assign the correct language ID.
   */
  toVirtualUri(sourceUri: vscode.Uri): vscode.Uri {
    const ext = baseFormatExtension(sourceUri.fsPath);
    return vscode.Uri.from({
      scheme: VIRTUAL_SCHEME,
      authority: VIRTUAL_AUTHORITY,
      path: sourceUri.path + ext,
    });
  }

  /**
   * Reverse of `toVirtualUri`: strip the appended extension and reconstruct the source URI.
   */
  toSourceUri(virtualUri: vscode.Uri): vscode.Uri {
    const sourcePath = stripVirtualExtension(virtualUri.path);
    return vscode.Uri.file(sourcePath);
  }

  isVirtualUri(uri: vscode.Uri): boolean {
    return uri.scheme === VIRTUAL_SCHEME;
  }

  /**
   * Re-map a diagnostic whose range is expressed in virtual (cleaned) document coordinates
   * back to the corresponding range in the original source document.
   *
   * Returns `undefined` if the entry is not found or the position cannot be mapped.
   */
  mapDiagnosticToSource(
    sourceUri: vscode.Uri,
    virtualDiag: vscode.Diagnostic
  ): vscode.Diagnostic | undefined {
    const entry = this.entries.get(sourceUri.toString());
    if (!entry) return undefined;

    const start = this.mapPosition(virtualDiag.range.start, entry);
    const end = this.mapPosition(virtualDiag.range.end, entry);
    if (!start || !end) return undefined;

    const mapped = new vscode.Diagnostic(
      new vscode.Range(start, end),
      virtualDiag.message,
      virtualDiag.severity
    );
    mapped.source = virtualDiag.source;
    mapped.code = virtualDiag.code;
    mapped.tags = virtualDiag.tags;
    mapped.relatedInformation = virtualDiag.relatedInformation;
    return mapped;
  }

  private mapPosition(
    virtualPos: vscode.Position,
    entry: VirtualDocumentEntry
  ): vscode.Position | undefined {
    const lineStart = entry.cleanedLineOffsets[virtualPos.line];
    if (lineStart === undefined) return undefined;

    const cleanedOffset = lineStart + virtualPos.character;
    const sourceOffset = entry.cleanedToSourceOffsets[cleanedOffset];
    if (sourceOffset === undefined) return undefined;

    // Binary-search for the source line containing sourceOffset
    const lines = entry.sourceLineOffsets;
    let lo = 0;
    let hi = lines.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if ((lines[mid] ?? 0) <= sourceOffset) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    return new vscode.Position(lo, sourceOffset - (lines[lo] ?? 0));
  }

  dispose(): void {
    this._onDidChange.dispose();
    this.entries.clear();
  }
}
