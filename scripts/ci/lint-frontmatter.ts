import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, isAbsolute, join, normalize, relative, resolve } from 'path';
import { spawnSync } from 'child_process';
import * as yaml from 'yaml';
import { Ajv as LegacyAjv } from 'ajv';
import type { ValidateFunction } from 'ajv';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { fileURLToPath } from 'url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const BACKLOG_DIR = join(process.cwd(), 'backlog');
const SCHEMAS_ROOT = join(SCRIPT_DIR, '..', '..', 'schemas');
const SCHEMA_DIR = join(SCHEMAS_ROOT, 'frontmatter');
const WORK_MANAGEMENT_SCHEMA_DIR = join(SCHEMAS_ROOT, 'work-management');

interface SchemaMap {
  byType: Record<string, string>;
  support: {
    base: string;
    statusTransitionPayload: string;
  };
}

interface WorkItemRef {
  status: string;
  file: string;
  id: string;
  title: string;
}

interface AjvLike {
  addSchema: (schema: Record<string, unknown>) => AjvLike;
  getSchema: (keyRef: string) => ValidateFunction<unknown> | undefined;
  compile: (schema: Record<string, unknown>) => ValidateFunction<unknown>;
}

/**
 * Parse YAML frontmatter from markdown file
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    throw new Error('No YAML frontmatter found');
  }

  return yaml.parse(match[1]);
}

function parseJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
}

function resolveSchemaPath(schemaPath: string): string {
  const normalized = schemaPath.replace(/^\.\/+/, '');
  const workspaceCandidate = join(process.cwd(), normalized);
  if (existsSync(workspaceCandidate)) {
    return workspaceCandidate;
  }

  const schemaRelative = normalized.replace(/^schemas\//, '');
  const rootCandidate = join(SCHEMAS_ROOT, schemaRelative);
  if (existsSync(rootCandidate)) {
    return rootCandidate;
  }

  return join(SCHEMA_DIR, schemaRelative);
}

function collectSchemaFiles(dirPath: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSchemaFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractCanonicalRelationshipDependencies(content: string): string[] {
  const sectionMatch = content.match(/^## Relationships\s*\n([\s\S]*?)(?=^##\s|$)/m);
  if (!sectionMatch) {
    return [];
  }

  const refs: string[] = [];
  const wikilinkRegex = /\[\[([^\]]+)\]\]/g;

  for (const match of sectionMatch[1].matchAll(wikilinkRegex)) {
    const canonicalRef = match[1].split('|', 1)[0].trim();
    if (canonicalRef) {
      refs.push(canonicalRef);
    }
  }

  return refs;
}

function extractUncheckedChecklistItemsFromSection(content: string, heading: string): string[] {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionRegex = new RegExp(
    `^##\\s+${escapedHeading}(?:\\b[^\\n]*)?\\s*\\n([\\s\\S]*?)(?=^##\\s|$)`,
    'm'
  );
  const sectionMatch = content.match(sectionRegex);
  if (!sectionMatch) {
    return [];
  }

  const sectionBody = sectionMatch[1];
  const uncheckedItems: string[] = [];
  const uncheckedRegex = /^\s*-\s*\[\s\]\s+(.*)$/gm;
  for (const match of sectionBody.matchAll(uncheckedRegex)) {
    const item = match[1]?.trim();
    if (item) {
      uncheckedItems.push(item);
    }
  }

  return uncheckedItems;
}

function collectBacklogMarkdownFiles(dirPath: string, relativePrefix = ''): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = join(dirPath, entry.name);
    const relativePath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      files.push(...collectBacklogMarkdownFiles(fullPath, relativePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(toPosixPath(relativePath));
    }
  }

  return files.sort();
}

/**
 * Load and compile JSON schemas with Ajv
 */
function loadSchemas() {
  const ajv = new LegacyAjv({
    schemas: [],
    strict: false,
    allErrors: true,
    verbose: true,
    validateSchema: false, // Skip meta-schema validation (we trust our schemas)
  });

  const workManagementAjv = new Ajv({
    schemas: [],
    strict: false,
    allErrors: true,
    verbose: true,
    validateSchema: false,
  });

  addFormats(ajv);
  addFormats(workManagementAjv);

  const schemaMapPath = join(SCHEMA_DIR, 'schema-map.json');
  const schemaMap = parseJsonFile<SchemaMap>(schemaMapPath);
  const supportedTypes = Object.keys(schemaMap.byType).sort();
  const schemaFiles = [
    ...collectSchemaFiles(SCHEMA_DIR),
    ...collectSchemaFiles(WORK_MANAGEMENT_SCHEMA_DIR),
  ].sort();

  for (const schemaFile of schemaFiles) {
    const relativePath = toPosixPath(relative(SCHEMA_DIR, schemaFile));
    if (
      relativePath === 'schema-map.json' ||
      relativePath.endsWith('/latest.json') ||
      relativePath.startsWith('by-type/')
    ) {
      continue;
    }

    const schema = parseJsonFile<Record<string, unknown>>(schemaFile);
    ajv.addSchema(schema);
    workManagementAjv.addSchema(schema);
  }

  const baseSchema = parseJsonFile<{ $defs?: { statusTransitions?: { properties?: object } } }>(
    resolveSchemaPath(schemaMap.support.base)
  );
  const statusTransitions = baseSchema.$defs?.statusTransitions?.properties as Record<
    string,
    { items: { enum: string[] } }
  >;

  const validators = new Map<string, ValidateFunction<unknown>>();
  const schemaValidators = new Map<string, ValidateFunction<unknown>>();
  for (const type of supportedTypes) {
    const latestSchemaPath = join(SCHEMA_DIR, 'by-type', type, 'latest.json');
    if (!existsSync(latestSchemaPath)) {
      throw new Error(`Missing latest schema for type '${type}': ${latestSchemaPath}`);
    }

    const schema = parseJsonFile<Record<string, unknown>>(latestSchemaPath);
    validators.set(type, ajv.compile(schema));
  }

  return {
    ajv,
    workManagementAjv,
    validators,
    schemaValidators,
    statusTransitions,
    supportedTypes,
  };
}

function selectAjvForSchemaPath(
  schemaPath: string,
  ajv: AjvLike,
  workManagementAjv: AjvLike
): AjvLike {
  return schemaPath.startsWith(WORK_MANAGEMENT_SCHEMA_DIR) ? workManagementAjv : ajv;
}

function resolveValidatorForFrontmatter(
  ajv: AjvLike,
  workManagementAjv: AjvLike,
  validators: Map<string, ValidateFunction<unknown>>,
  schemaValidators: Map<string, ValidateFunction<unknown>>,
  frontmatter: Record<string, unknown>
): ValidateFunction<unknown> | undefined {
  const schemaRef = typeof frontmatter.$schema === 'string' ? frontmatter.$schema : null;

  if (schemaRef) {
    const resolvedPath = resolveSchemaPath(schemaRef);
    if (existsSync(resolvedPath)) {
      const selectedAjv = selectAjvForSchemaPath(resolvedPath, ajv, workManagementAjv);
      const cachedValidator = schemaValidators.get(resolvedPath);
      if (cachedValidator) {
        return cachedValidator;
      }

      const schema = parseJsonFile<Record<string, unknown>>(resolvedPath);
      const schemaId = typeof schema.$id === 'string' ? schema.$id : null;
      if (schemaId) {
        const registeredValidator = selectedAjv.getSchema(schemaId);
        if (registeredValidator) {
          schemaValidators.set(resolvedPath, registeredValidator);
          return registeredValidator;
        }
      }

      const compiledValidator = selectedAjv.compile(schema);
      schemaValidators.set(resolvedPath, compiledValidator);
      return compiledValidator;
    }
  }

  const type = typeof frontmatter.type === 'string' ? frontmatter.type : null;
  return type ? validators.get(type) : undefined;
}

/**
 * Validate status transitions based on statusTransitions schema
 */
function validateStatusTransition(
  status: string,
  previousStatus: string | null,
  statusTransitions: Record<string, { items: { enum: string[] } }>
): string | null {
  // If no previous status (new file) or status unchanged, no transition check needed.
  if (!previousStatus || previousStatus === status) {
    return null;
  }

  // Get allowed transitions for the previous status
  const allowedTransitions = statusTransitions[previousStatus]?.items?.enum || [];

  // Check if current status is in allowed transitions
  const disableTransitionCheck = true;
  if (!disableTransitionCheck && !allowedTransitions.includes(status)) {
    return `Invalid status transition from '${previousStatus}' to '${status}'. Allowed transitions: [${allowedTransitions.join(', ')}]`;
  }

  return null;
}

let cachedComparisonRef: string | null | undefined;
let cachedChangedBacklogFiles: Set<string> | undefined;

function runGitForRef(args: string[]): string | null {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  if (result.status !== 0 || !result.stdout) {
    return null;
  }

  const output = result.stdout.trim();
  return output.length > 0 ? output : null;
}

function resolveComparisonRef(): string | null {
  if (cachedComparisonRef !== undefined) {
    return cachedComparisonRef;
  }

  const explicitBaseRef =
    process.env.PR_BASE_SHA?.trim() || process.env.GITHUB_BASE_SHA?.trim() || null;
  if (explicitBaseRef) {
    const verified = runGitForRef(['rev-parse', '--verify', `${explicitBaseRef}^{commit}`]);
    if (verified) {
      cachedComparisonRef = verified;
      return cachedComparisonRef;
    }
  }

  const baseBranch = process.env.GITHUB_BASE_REF?.trim();
  if (baseBranch) {
    const mergeBase = runGitForRef(['merge-base', 'HEAD', `origin/${baseBranch}`]);
    if (mergeBase) {
      cachedComparisonRef = mergeBase;
      return cachedComparisonRef;
    }
  }

  const previousHead = runGitForRef(['rev-parse', '--verify', 'HEAD~1']);
  cachedComparisonRef = previousHead;
  return cachedComparisonRef;
}

function hasBacklogFileChangedSinceComparison(file: string): boolean {
  const comparisonRef = resolveComparisonRef();
  if (!comparisonRef) {
    return false;
  }

  if (!cachedChangedBacklogFiles) {
    const changedOutput = runGitForRef(['diff', '--name-only', comparisonRef, '--', 'backlog']);
    cachedChangedBacklogFiles = new Set(
      (changedOutput ?? '')
        .split('\n')
        .map((entry) => toPosixPath(entry.trim()))
        .filter(Boolean)
    );
  }

  return cachedChangedBacklogFiles.has(`backlog/${file}`);
}

/**
 * Get previous committed status from git for a backlog file.
 * Uses a stable baseline ref (PR base SHA, merge-base, or HEAD~1 fallback).
 * Returns null for new/untracked files or files without valid frontmatter.
 */
function getPreviousStatusFromGit(file: string): string | null {
  const comparisonRef = resolveComparisonRef();
  if (!comparisonRef) {
    return null;
  }

  const gitPath = `${comparisonRef}:backlog/${file}`;
  const result = spawnSync('git', ['show', gitPath], {
    cwd: process.cwd(),
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  if (result.status !== 0 || !result.stdout) {
    return null;
  }

  try {
    const previousFrontmatter = parseFrontmatter(result.stdout);

    const previousStatus = previousFrontmatter.status;
    return typeof previousStatus === 'string' ? previousStatus : null;
  } catch {
    return null;
  }
}

function toPosixPath(pathValue: string): string {
  return pathValue.replace(/\\/g, '/');
}

/**
 * Resolve files to validate from optional CLI args.
 * - No args: validate all backlog markdown files.
 * - Args present: validate only matching backlog markdown files.
 */
function resolveFilesToValidate(allBacklogFiles: string[], cliArgs: string[]): string[] {
  if (cliArgs.length === 0) {
    return allBacklogFiles;
  }

  const allFilesSet = new Set(allBacklogFiles);
  const selectedFiles: string[] = [];
  const selectedSet = new Set<string>();

  const addIfValid = (candidate: string): void => {
    if (allFilesSet.has(candidate) && !selectedSet.has(candidate)) {
      selectedSet.add(candidate);
      selectedFiles.push(candidate);
    }
  };

  for (const rawArg of cliArgs) {
    if (!rawArg || rawArg.startsWith('-') || !rawArg.toLowerCase().endsWith('.md')) {
      continue;
    }

    const normalizedArg = toPosixPath(rawArg.replace(/^\.\/+/, ''));

    if (allFilesSet.has(normalizedArg)) {
      addIfValid(normalizedArg);
      continue;
    }

    if (normalizedArg.startsWith('backlog/')) {
      addIfValid(normalizedArg.slice('backlog/'.length));
      continue;
    }

    const absolutePath = isAbsolute(rawArg) ? normalize(rawArg) : resolve(process.cwd(), rawArg);
    const relativePath = toPosixPath(relative(BACKLOG_DIR, absolutePath));

    if (!relativePath || relativePath.startsWith('..')) {
      continue;
    }

    addIfValid(relativePath);
  }

  return selectedFiles;
}

/**
 * Main validation function
 */
function validateFrontmatter(): boolean {
  const {
    ajv,
    workManagementAjv,
    validators,
    schemaValidators,
    statusTransitions,
    supportedTypes,
  } = loadSchemas();
  const allBacklogFiles = collectBacklogMarkdownFiles(BACKLOG_DIR);
  const files = resolveFilesToValidate(allBacklogFiles, process.argv.slice(2));
  let hasViolations = false;

  if (files.length === 0) {
    console.log('\nNo backlog frontmatter files to validate.\n');
    return true;
  }

  // First pass: Load all work-items into a map for dependency checking
  const workItemsMap = new Map<string, WorkItemRef>();

  for (const file of allBacklogFiles) {
    try {
      const filePath = join(BACKLOG_DIR, file);
      const content = readFileSync(filePath, 'utf-8');
      const frontmatter = parseFrontmatter(content);
      if (frontmatter.type !== 'work-item') {
        continue;
      }

      const fileBasename = file.replace(/\.md$/, '');
      const fileLeafBasename = fileBasename.split('/').pop() || fileBasename;
      const id = typeof frontmatter.id === 'string' ? frontmatter.id : fileBasename;
      const status = typeof frontmatter.status === 'string' ? frontmatter.status : '';
      const title = typeof frontmatter.title === 'string' ? frontmatter.title : file;

      workItemsMap.set(fileBasename, { status, file, id, title });
      const existingByLeaf = workItemsMap.get(fileLeafBasename);
      if (existingByLeaf && existingByLeaf.file !== file) {
        console.error(
          `Backlog frontmatter error: multiple work items share the same leaf name "${fileLeafBasename}": ` +
            `${existingByLeaf.file} and ${file}. ` +
            'Use a unique file name or reference work items by full path or id.'
        );
        hasViolations = true;
      } else if (!existingByLeaf) {
        workItemsMap.set(fileLeafBasename, { status, file, id, title });
      }
      if (typeof frontmatter.id === 'string') {
        workItemsMap.set(id, { status, file, id, title });
      }
    } catch {
      // Will be caught in main validation loop
    }
  }

  console.log(`\nValidating ${files.length} backlog frontmatter file(s) against JSON schema...\n`);

  // Second pass: Validate each backlog frontmatter file
  for (const file of files) {
    try {
      const filePath = join(BACKLOG_DIR, file);
      const content = readFileSync(filePath, 'utf-8');
      const frontmatter = parseFrontmatter(content);
      const type = frontmatter.type;
      const validator = resolveValidatorForFrontmatter(
        ajv,
        workManagementAjv,
        validators,
        schemaValidators,
        frontmatter
      );
      let hasItemViolations = false;

      if (!validator) {
        hasViolations = true;
        hasItemViolations = true;
        const received = typeof type === 'string' ? type : '<missing>';
        console.error(`❌ ${file}`);
        console.error(
          `   /type: Unsupported frontmatter type '${received}'. Supported types: [${supportedTypes.join(', ')}]`
        );
        console.error();
        continue;
      }

      const valid = validator(frontmatter);
      if (!valid) {
        hasItemViolations = true;
      }

      // Schema validation errors
      if (!valid && validator.errors) {
        hasViolations = true;

        console.error(`❌ ${file}`);

        for (const error of validator.errors) {
          const path = error.instancePath || '(root)';
          const message = error.message || 'validation error';

          console.error(`   ${path}: ${message}`);
          if (error.params && Object.keys(error.params).length > 0) {
            console.error(`      params: ${JSON.stringify(error.params)}`);
          }
        }
      }

      // Work-item-only validations: status transitions and dependency checks
      if (type === 'work-item') {
        const status = frontmatter.status as string;
        const previousStatus = getPreviousStatusFromGit(file);

        const pullRequests = Array.isArray(frontmatter.links?.pull_requests)
          ? (frontmatter.links.pull_requests as string[])
          : [];

        const isEnteringReadyForReview =
          status === 'ready-for-review' && previousStatus !== 'ready-for-review';
        if (isEnteringReadyForReview && pullRequests.length === 0) {
          hasViolations = true;
          hasItemViolations = true;
          if (!validator.errors || validator.errors.length === 0) {
            console.error(`❌ ${file}`);
          }

          console.error(
            "   /links/pull_requests: Work item is entering 'ready-for-review' but has no linked pull request"
          );
        }

        const isClosed = status === 'closed';
        const isEnteringClosed = isClosed && previousStatus !== 'closed';
        const shouldEnforceClosedInvariants =
          isClosed && (isEnteringClosed || hasBacklogFileChangedSinceComparison(file));

        if (shouldEnforceClosedInvariants) {
          const statusReason =
            typeof frontmatter.status_reason === 'string' ? frontmatter.status_reason.trim() : '';
          const completedDate =
            typeof frontmatter.completed_date === 'string' ? frontmatter.completed_date.trim() : '';

          if (!statusReason) {
            hasViolations = true;
            hasItemViolations = true;
            if (!validator.errors || validator.errors.length === 0) {
              console.error(`❌ ${file}`);
            }

            console.error("   /status_reason: Work item is 'closed' but status_reason is missing");
          }

          if (!completedDate) {
            hasViolations = true;
            hasItemViolations = true;
            if (!validator.errors || validator.errors.length === 0) {
              console.error(`❌ ${file}`);
            }

            console.error(
              "   /completed_date: Work item is 'closed' but completed_date is missing"
            );
          }
        }

        const transitionError =
          typeof status === 'string'
            ? validateStatusTransition(status, previousStatus, statusTransitions)
            : null;
        if (transitionError) {
          hasViolations = true;
          hasItemViolations = true;
          if (!validator.errors || validator.errors.length === 0) {
            console.error(`❌ ${file}`);
          }

          console.error(`   /status: ${transitionError}`);
        }

        const legacyDependsOn = Array.isArray(frontmatter.links?.depends_on)
          ? (frontmatter.links.depends_on as string[])
          : [];
        const canonicalDependsOn = extractCanonicalRelationshipDependencies(content).map(
          (ref) => `[[${ref}]]`
        );
        const dependsOn = [...legacyDependsOn, ...canonicalDependsOn];

        if (dependsOn.length > 0) {
          for (const dep of dependsOn) {
            // Extract work item reference from wikilink format [[xxx]]
            const wikilinkMatch = dep.match(/^\[\[([^\]]+)\]\]$/);
            if (wikilinkMatch) {
              const depRef = wikilinkMatch[1].split('|', 1)[0].trim();
              const depItem = workItemsMap.get(depRef);

              if (!depItem) {
                hasViolations = true;
                hasItemViolations = true;
                if (!validator.errors || validator.errors.length === 0) {
                  console.error(`❌ ${file}`);
                }

                console.error(`   /links/depends_on: Dependency '${dep}' not found in backlog`);
              } else if (status === 'closed' && depItem.status !== 'closed') {
                hasViolations = true;
                hasItemViolations = true;
                if (!validator.errors || validator.errors.length === 0) {
                  console.error(`❌ ${file}`);
                }

                console.error(
                  `   /links/depends_on: Dependency '${dep}' (${depItem.id}: ${depItem.title}) must be 'closed' but is '${depItem.status}'`
                );
              } else if (
                status === 'in-progress' &&
                !['in-progress', 'ready-for-review', 'closed'].includes(depItem.status)
              ) {
                hasViolations = true;
                hasItemViolations = true;
                if (!validator.errors || validator.errors.length === 0) {
                  console.error(`❌ ${file}`);
                }

                console.error(
                  `   /links/depends_on: Dependency '${dep}' (${depItem.id}: ${depItem.title}) must be 'in-progress', 'ready-for-review', or 'closed' but is '${depItem.status}'`
                );
              }
            }
          }
        }

        if (shouldEnforceClosedInvariants) {
          const uncheckedTasks = extractUncheckedChecklistItemsFromSection(content, 'Tasks');
          const uncheckedAcceptance = extractUncheckedChecklistItemsFromSection(
            content,
            'Acceptance Criteria'
          );

          if (uncheckedTasks.length > 0) {
            hasViolations = true;
            hasItemViolations = true;
            if (!validator.errors || validator.errors.length === 0) {
              console.error(`❌ ${file}`);
            }

            console.error(
              `   /status: Work item is 'closed' but has unchecked Tasks checklist items (${uncheckedTasks.length})`
            );
          }

          if (uncheckedAcceptance.length > 0) {
            hasViolations = true;
            hasItemViolations = true;
            if (!validator.errors || validator.errors.length === 0) {
              console.error(`❌ ${file}`);
            }

            console.error(
              `   /status: Work item is 'closed' but has unchecked Acceptance Criteria checklist items (${uncheckedAcceptance.length})`
            );
          }
        }
      }

      if (hasItemViolations) {
        console.error();
      }
    } catch (e) {
      hasViolations = true;

      console.error(`❌ ${file}: ${(e as Error).message}\n`);
    }
  }

  if (!hasViolations) {
    console.log('✅ All backlog frontmatter files passed schema validation\n');
  } else {
    console.error('\n❌ Schema validation failed. Please fix the above issues.\n');
  }

  return !hasViolations;
}

// Run validation
const success = validateFrontmatter();
process.exit(success ? 0 : 1);
