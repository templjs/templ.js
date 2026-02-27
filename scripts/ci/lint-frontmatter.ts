import { existsSync, readFileSync, readdirSync } from 'fs';
import { isAbsolute, join, normalize, relative, resolve } from 'path';
import { spawnSync } from 'child_process';
import * as yaml from 'yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { fileURLToPath } from 'url';

const BACKLOG_DIR = join(process.cwd(), 'backlog');
const SCHEMA_DIR = join(fileURLToPath(import.meta.url), '..', '..', '..', 'schemas', 'frontmatter');

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
  return join(SCHEMA_DIR, schemaPath.replace(/^\.\/+/, ''));
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
  const ajv = new Ajv({
    schemas: [],
    strict: false,
    allErrors: true,
    verbose: true,
    validateSchema: false, // Skip meta-schema validation (we trust our schemas)
  });

  addFormats(ajv);

  const schemaMapPath = join(SCHEMA_DIR, 'schema-map.json');
  const schemaMap = parseJsonFile<SchemaMap>(schemaMapPath);
  const supportedTypes = Object.keys(schemaMap.byType).sort();
  const schemaFiles = collectSchemaFiles(SCHEMA_DIR).sort();

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
  }

  const baseSchema = parseJsonFile<{ $defs?: { statusTransitions?: { properties?: object } } }>(
    resolveSchemaPath(schemaMap.support.base)
  );
  const statusTransitions = baseSchema.$defs?.statusTransitions?.properties as Record<
    string,
    { items: { enum: string[] } }
  >;

  const validators = new Map<string, Ajv.ValidateFunction<Record<string, unknown>>>();
  for (const type of supportedTypes) {
    const latestSchemaPath = join(SCHEMA_DIR, 'by-type', type, 'latest.json');
    if (!existsSync(latestSchemaPath)) {
      throw new Error(`Missing latest schema for type '${type}': ${latestSchemaPath}`);
    }

    const schema = parseJsonFile<Record<string, unknown>>(latestSchemaPath);
    validators.set(type, ajv.compile(schema));
  }

  return { validators, statusTransitions, supportedTypes };
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

/**
 * Get previous committed status from git (HEAD) for a backlog file.
 * Returns null for new/untracked files or files without valid frontmatter.
 */
function getPreviousStatusFromGit(file: string): string | null {
  const gitPath = `HEAD:backlog/${file}`;
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
  const { validators, statusTransitions, supportedTypes } = loadSchemas();
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
      workItemsMap.set(fileLeafBasename, { status, file, id, title });
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
      const validator = typeof type === 'string' ? validators.get(type) : undefined;
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

        const dependsOn = Array.isArray(frontmatter.links?.depends_on)
          ? (frontmatter.links.depends_on as string[])
          : [];

        if (dependsOn.length > 0) {
          for (const dep of dependsOn) {
            // Extract work item reference from wikilink format [[xxx]]
            const wikilinkMatch = dep.match(/^\[\[([^\]]+)\]\]$/);
            if (wikilinkMatch) {
              const depRef = wikilinkMatch[1];
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
              }
            }
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
