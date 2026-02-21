import { readFileSync, readdirSync } from 'fs';
import { isAbsolute, join, normalize, relative, resolve } from 'path';
import { spawnSync } from 'child_process';
import * as yaml from 'yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const BACKLOG_DIR = join(process.cwd(), 'backlog');
const SCHEMA_DIR = join(process.cwd(), 'schemas', 'frontmatter');

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

  // Load overlay schemas (base.json references these)
  const overlaysDir = join(SCHEMA_DIR, 'overlays');
  const overlayFiles = [
    'audience-token.vocab.core.json',
    'classification-token.vocab.core.json',
    'governance-mode.vocab.core.json',
    'reconciliation-strategy-token.vocab.core.json',
    'status-reason-token.vocab.core.json',
  ];

  for (const overlayFile of overlayFiles) {
    const overlayPath = join(overlaysDir, overlayFile);

    const overlaySchema = JSON.parse(readFileSync(overlayPath, 'utf-8'));

    ajv.addSchema(overlaySchema, `overlays/${overlayFile}`);
  }

  // Load contract schemas (base.json references these)
  const contractsDir = join(SCHEMA_DIR, 'contracts');
  const contractFiles = [
    'audience-token.contract.json',
    'classification-token.contract.json',
    'governance-mode.contract.json',
    'reconciliation-strategy-token.contract.json',
    'status-reason-token.contract.json',
  ];

  for (const contractFile of contractFiles) {
    const contractPath = join(contractsDir, contractFile);

    const contractSchema = JSON.parse(readFileSync(contractPath, 'utf-8'));

    ajv.addSchema(contractSchema, `contracts/${contractFile}`);
  }

  // Load base schema (contains $defs including statusTransitions)
  const baseSchemaPath = join(SCHEMA_DIR, 'base.json');

  const baseSchema = JSON.parse(readFileSync(baseSchemaPath, 'utf-8'));
  // Register with both the file path and without ./ prefix

  ajv.addSchema(baseSchema, './base.json');

  ajv.addSchema(baseSchema, 'base.json');

  // Extract status transitions for validation

  const statusTransitions = baseSchema.$defs?.statusTransitions?.properties as Record<
    string,
    { items: { enum: string[] } }
  >;

  // Load work-item schema
  const workItemSchemaPath = join(SCHEMA_DIR, 'work-item.json');

  const workItemSchema = JSON.parse(readFileSync(workItemSchemaPath, 'utf-8'));

  const validate = ajv.compile(workItemSchema);
  return { validate, statusTransitions };
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
  if (!allowedTransitions.includes(status)) {
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
function validateWorkItems(): boolean {
  const { validate, statusTransitions } = loadSchemas();
  const allBacklogFiles = readdirSync(BACKLOG_DIR).filter((f) => f.endsWith('.md'));
  const files = resolveFilesToValidate(allBacklogFiles, process.argv.slice(2));
  let hasViolations = false;

  if (files.length === 0) {
    console.log('\nNo backlog work item files to validate.\n');
    return true;
  }

  // First pass: Load all work items into a map for dependency checking
  const workItemsMap = new Map<
    string,
    { status: string; file: string; id: string; title: string }
  >();

  for (const file of allBacklogFiles) {
    try {
      const filePath = join(BACKLOG_DIR, file);
      const content = readFileSync(filePath, 'utf-8');
      const frontmatter = parseFrontmatter(content);

      const id = frontmatter.id as string;

      const status = frontmatter.status as string;

      const title = frontmatter.title as string;

      // Store work item info
      const fileBasename = file.replace(/\.md$/, '');
      workItemsMap.set(fileBasename, { status, file, id, title });
      workItemsMap.set(id, { status, file, id, title });
    } catch {
      // Will be caught in main validation loop
    }
  }

  console.log(`\nValidating ${files.length} work item(s) against JSON schema...\n`);

  // Second pass: Validate each work item
  for (const file of files) {
    try {
      const filePath = join(BACKLOG_DIR, file);
      const content = readFileSync(filePath, 'utf-8');
      const frontmatter = parseFrontmatter(content);

      const valid = validate(frontmatter);
      let hasItemViolations = !valid;

      // Schema validation errors
      if (!valid && validate.errors) {
        hasViolations = true;

        console.error(`❌ ${file}`);

        for (const error of validate.errors) {
          const path = error.instancePath || '(root)';
          const message = error.message || 'validation error';

          console.error(`   ${path}: ${message}`);
          if (error.params && Object.keys(error.params).length > 0) {
            console.error(`      params: ${JSON.stringify(error.params)}`);
          }
        }
      }

      // Additional validations: status transitions and dependencies

      const status = frontmatter.status as string;

      const previousStatus = getPreviousStatusFromGit(file);
      const transitionError = validateStatusTransition(status, previousStatus, statusTransitions);
      if (transitionError) {
        hasViolations = true;
        hasItemViolations = true;
        if (!validate.errors || validate.errors.length === 0) {
          console.error(`❌ ${file}`);
        }

        console.error(`   /status: ${transitionError}`);
      }

      // Validate dependencies

      const dependsOn = (frontmatter.links?.depends_on || []) as string[];

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
              if (!validate.errors || validate.errors.length === 0) {
                console.error(`❌ ${file}`);
              }

              console.error(`   /links/depends_on: Dependency '${dep}' not found in backlog`);
            } else if (status === 'closed' && depItem.status !== 'closed') {
              hasViolations = true;
              hasItemViolations = true;
              if (!validate.errors || validate.errors.length === 0) {
                console.error(`❌ ${file}`);
              }

              console.error(
                `   /links/depends_on: Dependency '${dep}' (${depItem.id}: ${depItem.title}) must be 'closed' but is '${depItem.status}'`
              );
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
    console.log('✅ All work items passed schema validation\n');
  } else {
    console.error('\n❌ Schema validation failed. Please fix the above issues.\n');
  }

  return !hasViolations;
}

// Run validation
const success = validateWorkItems();
process.exit(success ? 0 : 1);
