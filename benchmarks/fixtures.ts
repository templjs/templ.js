import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  detectFrontmatterRange,
  type JSONSchema,
} from '../src/packages/core/src/index.ts';
import schemaLoadingModule from '../src/extensions/vscode/src/schema-loading.ts';

type InitializeParamsLike = import('../src/extensions/vscode/src/schema-loading.ts').InitializeParamsLike;

const { loadSchemaSourceSync, resolveDocumentSchemaSources } = schemaLoadingModule;

export interface CoreFixtureData {
  release: {
    name: string;
    cycle: string;
  };
  projects: Array<{
    name: string;
    owner: {
      name: string;
      role: string;
    };
    tasks: Array<{
      id: string;
      title: string;
      status: 'todo' | 'doing' | 'done';
      points: number;
      notes: string;
      assignee: {
        name: string;
        role: string;
      };
    }>;
  }>;
  summary: {
    totalPoints: number;
    completedCount: number;
  };
}

const BENCHMARKS_DIR = path.dirname(fileURLToPath(import.meta.url));
const VSCODE_WORKSPACE_ROOT = path.join(BENCHMARKS_DIR, 'fixtures', 'vscode-workspace');
const VSCODE_DOCUMENT_PATH = path.join(
  VSCODE_WORKSPACE_ROOT,
  'backlog',
  'benchmark-fixture.md.templ'
);
const VSCODE_DOCUMENT_URI = pathToFileURL(VSCODE_DOCUMENT_PATH).toString();
const VSCODE_DOCUMENT_TEXT = readFileSync(VSCODE_DOCUMENT_PATH, 'utf-8');

const roles = ['owner', 'reviewer', 'writer', 'maintainer'] as const;
const taskStatuses = ['todo', 'doing', 'done'] as const;

export function buildCoreFixtureData(): CoreFixtureData {
  let totalPoints = 0;
  let completedCount = 0;

  const projects = Array.from({ length: 18 }, (_, projectIndex) => ({
    name: `Project ${projectIndex + 1}`,
    owner: {
      name: `Owner ${projectIndex + 1}`,
      role: roles[projectIndex % roles.length],
    },
    tasks: Array.from({ length: 12 }, (_, taskIndex) => {
      const points = ((projectIndex + taskIndex) % 5) + 1;
      totalPoints += points;

      const status = taskStatuses[(projectIndex + taskIndex) % taskStatuses.length];
      if (status === 'done') {
        completedCount += 1;
      }

      return {
        id: `P${projectIndex + 1}-T${taskIndex + 1}`,
        title: `Task ${taskIndex + 1} for Project ${projectIndex + 1}`,
        status,
        points,
        notes: `Detailed note ${projectIndex + 1}.${taskIndex + 1}`,
        assignee: {
          name: `Contributor ${taskIndex + 1}`,
          role: roles[(projectIndex + taskIndex) % roles.length],
        },
      };
    }),
  }));

  return {
    release: {
      name: 'Optimization Rollup',
      cycle: '2026.03',
    },
    projects,
    summary: {
      totalPoints,
      completedCount,
    },
  };
}

export const coreTemplate = [
  'Release: {{ release.name }} ({{ release.cycle }})',
  '',
  '{% for project in projects %}',
  '## {{ project.name }}',
  'Owner: {{ project.owner.name | upper }}',
  '{% for task in project.tasks %}',
  '- {{ task.id }} {{ task.title }} {{ task.assignee.name | upper }} {{ task.status }} {{ task.points | round(0) }}',
  '  {{ task.notes }}',
  '{% endfor %}',
  '{% endfor %}',
  '',
  'Summary: {{ summary.totalPoints | round(2) }} / {{ summary.completedCount }}',
].join('\n');

export const frontmatterSchema: JSONSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    milestone: { type: 'string' },
    owner: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        role: { type: 'string' },
      },
      required: ['name', 'role'],
    },
    reviewers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
        },
        required: ['name', 'role'],
      },
    },
  },
  required: ['title', 'milestone', 'owner'],
};

export const contentSchema: JSONSchema = {
  type: 'object',
  properties: {
    projects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          owner: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              role: { type: 'string' },
            },
            required: ['name', 'role'],
          },
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                status: {
                  type: 'string',
                  enum: ['todo', 'doing', 'done'],
                },
                points: { type: 'number' },
                notes: { type: 'string' },
                assignee: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    role: { type: 'string' },
                  },
                  required: ['name', 'role'],
                },
              },
              required: ['id', 'title', 'status', 'points', 'notes', 'assignee'],
            },
          },
        },
        required: ['name', 'owner', 'tasks'],
      },
    },
    summary: {
      type: 'object',
      properties: {
        totalPoints: { type: 'number' },
        completedCount: { type: 'number' },
      },
      required: ['totalPoints', 'completedCount'],
    },
  },
  required: ['projects', 'summary'],
};

const vscodeInitParams: InitializeParamsLike = {
  rootUri: pathToFileURL(VSCODE_WORKSPACE_ROOT).toString(),
  initializationOptions: {
    schemaPath: '.templjs/frontmatter.schema.json#/$defs/workItemDefaults',
    contentSchemaPath: '.templjs/content.schema.json#/$defs/body',
    schemaPatterns: {
      'backlog/**': {
        schemaPath: '.templjs/frontmatter.schema.json#/$defs/workItemDefaults',
        contentSchemaPath: '.templjs/content.schema.json#/$defs/body',
      },
    },
    documentContext: {
      uri: VSCODE_DOCUMENT_URI,
      content: VSCODE_DOCUMENT_TEXT,
    },
  },
};

export const vscodeWorkspaceFixture = (() => {
  const resolvedSources = resolveDocumentSchemaSources(vscodeInitParams);
  const frontmatterLoaded = resolvedSources.schemaPath
    ? loadSchemaSourceSync(resolvedSources.schemaPath, VSCODE_WORKSPACE_ROOT, VSCODE_DOCUMENT_URI, {
        cache: new Map<string, unknown>(),
      })
    : {};
  const contentLoaded = resolvedSources.contentSchemaPath
    ? loadSchemaSourceSync(
        resolvedSources.contentSchemaPath,
        VSCODE_WORKSPACE_ROOT,
        VSCODE_DOCUMENT_URI,
        {
          cache: new Map<string, unknown>(),
        }
      )
    : {};
  const frontmatterRange = detectFrontmatterRange(VSCODE_DOCUMENT_TEXT) ?? { start: 0, end: 0 };

  return {
    workspaceRoot: VSCODE_WORKSPACE_ROOT,
    documentPath: VSCODE_DOCUMENT_PATH,
    documentUri: VSCODE_DOCUMENT_URI,
    documentText: VSCODE_DOCUMENT_TEXT,
    initializationOptions: vscodeInitParams.initializationOptions ?? {},
    resolvedSources,
    loadedFrontmatterSchema: (frontmatterLoaded.schema ?? frontmatterSchema) as JSONSchema,
    loadedContentSchema: (contentLoaded.schema ?? contentSchema) as JSONSchema,
    frontmatterRange,
    completionOffset:
      VSCODE_DOCUMENT_TEXT.indexOf('task.') >= 0
        ? VSCODE_DOCUMENT_TEXT.indexOf('task.') + 'task.'.length
        : 0,
    diagnosticsText: `${VSCODE_DOCUMENT_TEXT}\nInvalid: {{ projects[0].missingField }}\nBad filter: {{ summary.totalPoints | nope }}`,
  };
})();
