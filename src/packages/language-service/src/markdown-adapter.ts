import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { LanguageServiceContext, LanguageServicePlugin } from '@volar/language-service';
import { create as createVolarMarkdownServicePlugin } from 'volar-service-markdown';
import { cleanTemplateContent } from '@templjs/volar';
import { URI } from 'vscode-uri';
import type { ServicePluginOrchestrationOptions } from './service-plugin-contract.js';
import { getResolvedAdapterRuntime } from './runtime-manifest.js';

const execFileAsync = promisify(execFile);

const DEFAULT_MARKDOWN_DIAGNOSTICS_OPTIONS = {
  validateReferences: 'warning',
  validateFragmentLinks: 'warning',
  validateFileLinks: 'warning',
  validateMarkdownFileLinkFragments: 'warning',
  validateUnusedLinkDefinitions: 'hint',
  validateDuplicateLinkDefinitions: 'warning',
  ignoreLinks: [] as string[],
} as const;

type MarkdownlintIssue = {
  lineNumber?: number;
  ruleNames?: string[] | string;
  ruleDescription?: string;
  errorDetail?: string;
  errorContext?: string;
  errorRange?: [number, number];
};

type SourceSnapshot = {
  getText: (start: number, end: number) => string;
  getLength: () => number;
};

type MarkdownlintCleanedInput = {
  cleaned: string;
  originalToCleanedOffsets: number[];
};

export type MarkdownAdapterRuntimePlan = {
  enabled: boolean;
  reason: string;
};

export function planMarkdownHostAdapterRuntime(
  options: ServicePluginOrchestrationOptions
): MarkdownAdapterRuntimePlan {
  const resolvedRuntime = getResolvedAdapterRuntime(options, 'templjs-markdown-host');
  if (resolvedRuntime) {
    return {
      enabled: resolvedRuntime.state === 'enabled',
      reason: resolvedRuntime.reason,
    };
  }

  return {
    enabled: true,
    reason: 'default-enabled',
  };
}

export function planMarkdownlintAdapterRuntime(
  options: ServicePluginOrchestrationOptions
): MarkdownAdapterRuntimePlan {
  const resolvedRuntime = getResolvedAdapterRuntime(options, 'templjs-markdownlint-host');
  if (resolvedRuntime) {
    return {
      enabled: resolvedRuntime.state === 'enabled',
      reason: resolvedRuntime.reason,
    };
  }

  return {
    enabled: true,
    reason: 'default-enabled',
  };
}

export const planMarkdownAdapterRuntime = planMarkdownlintAdapterRuntime;

function isMarkdownLanguage(languageId: string): boolean {
  const normalized = languageId.toLowerCase();
  // Only match canonical 'markdown', not 'templjs-markdown' which is an embedded host code
  // that should not receive direct diagnostics (remap wrapper routes root documents instead)
  return normalized === 'markdown';
}

function toMarkdownlintCode(ruleNames: MarkdownlintIssue['ruleNames']): string | undefined {
  if (Array.isArray(ruleNames)) {
    return ruleNames[0];
  }

  if (typeof ruleNames === 'string') {
    return ruleNames;
  }

  return undefined;
}

function toMarkdownlintMessage(issue: MarkdownlintIssue): string {
  const code = toMarkdownlintCode(issue.ruleNames);
  const detail = [issue.ruleDescription, issue.errorDetail, issue.errorContext]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(': ');

  if (detail.length > 0) {
    return detail;
  }

  return code ? `markdownlint ${code}` : 'markdownlint violation';
}

function buildLineOffsets(text: string): number[] {
  const offsets = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

function lineAndColumnToOffset(lineOffsets: number[], lineNumber: number, column: number): number {
  const lineStart = lineOffsets[Math.max(0, lineNumber - 1)] ?? 0;
  return lineStart + Math.max(0, column);
}

function offsetToLineAndCharacter(
  lineOffsets: number[],
  offset: number
): { line: number; character: number } {
  let lo = 0;
  let hi = lineOffsets.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if ((lineOffsets[mid] ?? 0) <= offset) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return {
    line: lo,
    character: offset - (lineOffsets[lo] ?? 0),
  };
}

function toDiagnostic(issue: MarkdownlintIssue, cleanedInput: MarkdownlintCleanedInput) {
  const lineNumber = Math.max(1, issue.lineNumber ?? 1);
  const rangeStart = Math.max(1, issue.errorRange?.[0] ?? 1);
  const rangeLength = Math.max(1, issue.errorRange?.[1] ?? 1);

  const cleanedLineOffsets = buildLineOffsets(cleanedInput.cleaned);

  const cleanedStartOffset = Math.min(
    cleanedInput.cleaned.length,
    lineAndColumnToOffset(cleanedLineOffsets, lineNumber, rangeStart - 1)
  );
  const cleanedEndOffset = Math.min(cleanedInput.cleaned.length, cleanedStartOffset + rangeLength);
  const start = offsetToLineAndCharacter(cleanedLineOffsets, cleanedStartOffset);
  const end = offsetToLineAndCharacter(
    cleanedLineOffsets,
    Math.max(cleanedStartOffset, cleanedEndOffset)
  );

  const severity: 1 | 2 | 3 | 4 = 2;

  return {
    message: toMarkdownlintMessage(issue),
    severity,
    source: 'markdownlint',
    code: toMarkdownlintCode(issue.ruleNames),
    range: {
      start,
      end,
    },
  };
}

function extractIssuesFromResult(result: unknown, tempFilePath: string): MarkdownlintIssue[] {
  if (Array.isArray(result)) {
    return result as MarkdownlintIssue[];
  }

  if (!result || typeof result !== 'object') {
    return [];
  }

  const byFile = result as Record<string, unknown>;
  if (Array.isArray(byFile[tempFilePath])) {
    return byFile[tempFilePath] as MarkdownlintIssue[];
  }

  const normalizedTarget = path.normalize(tempFilePath);
  for (const [filePath, issues] of Object.entries(byFile)) {
    if (!Array.isArray(issues)) {
      continue;
    }

    if (
      path.normalize(filePath) === normalizedTarget ||
      filePath.endsWith(path.basename(tempFilePath))
    ) {
      return issues as MarkdownlintIssue[];
    }
  }

  return Object.values(byFile).flatMap((issues) =>
    Array.isArray(issues) ? issues : []
  ) as MarkdownlintIssue[];
}

function parseTextDiagnostics(stdout: string): MarkdownlintIssue[] {
  const issues: MarkdownlintIssue[] = [];

  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const parsed = trimmed.match(/:(\d+)(?::(\d+))?\s+([^\s]+)\s+(.*)$/);
    if (!parsed) {
      continue;
    }

    issues.push({
      lineNumber: Number(parsed[1]),
      errorRange: [parsed[2] ? Number(parsed[2]) : 1, 1],
      ruleNames: parsed[3],
      errorDetail: parsed[4],
    });
  }

  return issues;
}

function parseMarkdownlintDiagnostics(stdout: string, tempFilePath: string): MarkdownlintIssue[] {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return [];
  }

  try {
    return extractIssuesFromResult(JSON.parse(trimmed), tempFilePath);
  } catch {
    return parseTextDiagnostics(trimmed);
  }
}

async function writeTempMarkdownFile(sourceUri: string, sourceText: string) {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'templjs-markdownlint-'));
  const fileName = (() => {
    if (sourceUri.startsWith('file://')) {
      try {
        const absolutePath = fileURLToPath(sourceUri);
        const baseName = path.basename(absolutePath) || 'document.md';
        return /\.(md|markdown)$/i.test(baseName) ? baseName : `${baseName}.md`;
      } catch {
        return 'document.md';
      }
    }

    return 'document.md';
  })();

  const tempFilePath = path.join(tempDir, fileName);
  await writeFile(tempFilePath, sourceText, 'utf8');

  return {
    tempFilePath,
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
  };
}

function resolveMarkdownlintBinaryCandidates(options: ServicePluginOrchestrationOptions): string[] {
  const resolvedRuntime = getResolvedAdapterRuntime(options, 'templjs-markdownlint-host');
  const runtimeBinaryPath =
    typeof resolvedRuntime?.binaryPath === 'string' && resolvedRuntime.binaryPath.trim().length > 0
      ? resolvedRuntime.binaryPath.trim()
      : undefined;

  return Array.from(new Set([runtimeBinaryPath, 'markdownlint'].filter(Boolean) as string[]));
}

function getSourceFileInfo(context: LanguageServiceContext, uri: string) {
  const decoded = context.decodeEmbeddedDocumentUri(URI.parse(uri));
  if (decoded) {
    const [documentUri] = decoded;
    return context.language.scripts.get(documentUri);
  }

  return context.language.scripts.get(URI.parse(uri));
}

function getSourceUri(context: LanguageServiceContext, uri: string): string {
  return getSourceFileInfo(context, uri)?.id?.toString() ?? uri;
}

function getSourceDocumentText(
  context: LanguageServiceContext,
  document: { uri: string; getText: () => string },
  sourceUri: string
): string {
  if (sourceUri === document.uri) {
    return document.getText();
  }

  const sourceFile =
    getSourceFileInfo(context, document.uri) ?? context.language.scripts.get(URI.parse(sourceUri));
  const snapshot = (sourceFile as { snapshot?: SourceSnapshot } | undefined)?.snapshot;
  if (snapshot?.getText && snapshot?.getLength) {
    return snapshot.getText(0, snapshot.getLength());
  }

  return document.getText();
}

async function collectMarkdownlintDiagnostics(
  options: ServicePluginOrchestrationOptions,
  sourceUri: string,
  sourceText: string,
  cleanedInput: MarkdownlintCleanedInput
) {
  const binaries = resolveMarkdownlintBinaryCandidates(options);
  if (binaries.length === 0) {
    return [];
  }

  const tempFile = await writeTempMarkdownFile(sourceUri, cleanedInput.cleaned);

  try {
    for (const command of binaries) {
      try {
        const { stdout } = await execFileAsync(command, ['--json', tempFile.tempFilePath], {
          cwd: options.workspaceFolder,
          maxBuffer: 1024 * 1024,
          timeout: 10_000,
          killSignal: 'SIGKILL',
        });

        return parseMarkdownlintDiagnostics(String(stdout ?? ''), tempFile.tempFilePath).map(
          (issue) => toDiagnostic(issue, cleanedInput)
        );
      } catch (error) {
        const typedError = error as {
          code?: string | number;
          signal?: string;
          stdout?: string | Buffer;
          stderr?: string | Buffer;
        };

        if (typedError.code === 'ENOENT') {
          options.log?.(`[templjs-runtime] markdownlint binary not found: ${command}`);
          continue;
        }

        if (typedError.code === 'ETIMEDOUT' || typedError.signal === 'SIGKILL') {
          options.log?.(`[templjs-runtime] markdownlint subprocess timed out command=${command}`);
          continue;
        }

        const stdout = String(typedError.stdout ?? '');
        const stderr = String(typedError.stderr ?? '');
        const output = stdout.trim().length > 0 ? stdout : stderr;
        if (output.trim().length > 0) {
          return parseMarkdownlintDiagnostics(output, tempFile.tempFilePath).map((issue) =>
            toDiagnostic(issue, cleanedInput)
          );
        }

        options.log?.(
          `[templjs-runtime] markdownlint subprocess failed command=${command} message=${String(stderr || (typedError.code ?? 'unknown-error'))}`
        );
      }
    }

    return [];
  } finally {
    await tempFile.cleanup();
  }
}

/**
 * Creates the markdown host diagnostics adapter for VS Code markdown language features.
 */
export function createMarkdownHostDiagnosticsAdapter(
  options: ServicePluginOrchestrationOptions
): LanguageServicePlugin | undefined {
  const plan = planMarkdownHostAdapterRuntime(options);
  options.log?.(
    `[templjs-runtime] adapter=templjs-markdown-host enabled=${plan.enabled} reason=${plan.reason}`
  );

  if (!plan.enabled) {
    return undefined;
  }

  const basePlugin = createVolarMarkdownServicePlugin({
    getDiagnosticOptions: async () => DEFAULT_MARKDOWN_DIAGNOSTICS_OPTIONS as never,
  });

  return {
    ...basePlugin,
    name: 'templjs-markdown-host',
  };
}

function cleanMarkdownlintInput(sourceText: string): MarkdownlintCleanedInput {
  return cleanTemplateContent(sourceText, undefined, {
    mode: 'text-only',
    // Keep expression-only lines non-empty for markdownlint blank-line rules.
    expressionPaddingCharacter: '_',
  });
}

/**
 * Creates the dedicated markdownlint host diagnostics adapter.
 *
 * When enabled, diagnostics are collected by invoking markdownlint in a subprocess and mapping
 * markdownlint findings to LSP diagnostics.
 */
export function createMarkdownlintHostDiagnosticsAdapter(
  options: ServicePluginOrchestrationOptions
): LanguageServicePlugin | undefined {
  const plan = planMarkdownlintAdapterRuntime(options);
  options.log?.(
    `[templjs-runtime] adapter=templjs-markdownlint-host enabled=${plan.enabled} reason=${plan.reason}`
  );

  if (!plan.enabled) {
    return undefined;
  }

  return {
    name: 'templjs-markdownlint-host',
    capabilities: {
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
    },
    create(context) {
      return {
        async provideDiagnostics(document) {
          if (!isMarkdownLanguage(document.languageId)) {
            return;
          }

          const sourceUri = getSourceUri(context, document.uri);
          const sourceText = getSourceDocumentText(context, document, sourceUri);
          const cleanedSourceText = cleanMarkdownlintInput(sourceText);

          return collectMarkdownlintDiagnostics(options, sourceUri, sourceText, cleanedSourceText);
        },
      };
    },
  };
}

export const markdownAdapterTesting = {
  isMarkdownLanguage,
  toMarkdownlintCode,
  toMarkdownlintMessage,
  buildLineOffsets,
  lineAndColumnToOffset,
  offsetToLineAndCharacter,
  toDiagnostic,
  extractIssuesFromResult,
  parseTextDiagnostics,
  parseMarkdownlintDiagnostics,
  writeTempMarkdownFile,
  resolveMarkdownlintBinaryCandidates,
  getSourceUri,
  getSourceDocumentText,
  collectMarkdownlintDiagnostics,
  cleanMarkdownlintInput,
};
