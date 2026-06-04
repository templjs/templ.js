import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { evaluateTransition, type TransitionContract } from './state-transition-evaluator.ts';
import {
  compileTransitionProfile,
  resolveStateVector,
  TransitionProfileError,
} from './transition-profile.ts';

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(process.cwd(), path), 'utf-8')) as Record<string, unknown>;
}

const TRANSITION_PROFILE_PATH = 'schemas/work-management/workflows/default/transition-profile.json';
const STATUS_DEFINITIONS_SCHEMA_PATH =
  'schemas/work-management/workflows/default/status-definitions.schema.json';
const TRANSITION_PROFILE_SHAPE_PATH =
  'schemas/work-management/support/transition-profile.schema.json';

function loadWorkItemProfile() {
  const profile = readJson(TRANSITION_PROFILE_PATH);
  return compileTransitionProfile(profile, readJson(TRANSITION_PROFILE_SHAPE_PATH), [
    profile,
    readJson(STATUS_DEFINITIONS_SCHEMA_PATH),
  ]);
}

function cloneWorkItemProfile(): Record<string, unknown> {
  return structuredClone(readJson(TRANSITION_PROFILE_PATH));
}

function collectJsonFiles(path: string): string[] {
  return readdirSync(join(process.cwd(), path), { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) {
      return collectJsonFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'latest.json'
      ? [entryPath]
      : [];
  });
}

describe('state transition evaluator', () => {
  it('evaluates rules over arbitrary dimensions', () => {
    const contract: TransitionContract = {
      precedence: ['review', 'publication'],
      rules: [
        {
          id: 'publish-approved-draft',
          from: { publication: 'draft', review: 'approved' },
          to: { publication: 'published' },
          decision: 'allow',
        },
      ],
    };

    expect(
      evaluateTransition(
        { publication: 'draft', review: 'approved' },
        { publication: 'published', review: 'approved' },
        contract
      )
    ).toEqual({ allowed: true, matchedRuleId: 'publish-approved-draft' });
  });

  it('uses configured dimension precedence when multiple rules match', () => {
    const contract: TransitionContract = {
      precedence: ['reason', 'status'],
      rules: [
        {
          id: 'status-only',
          from: { status: 'ready' },
          to: { status: 'closed' },
          decision: 'allow',
        },
        {
          id: 'reason-specific',
          from: { status: 'ready' },
          to: { status: 'closed', reason: 'completed' },
          decision: 'allow',
        },
      ],
    };

    expect(
      evaluateTransition(
        { status: 'ready', reason: 'prioritized' },
        { status: 'closed', reason: 'completed' },
        contract
      )
    ).toEqual({ allowed: true, matchedRuleId: 'reason-specific' });
  });
});

describe('transition profile compiler', () => {
  it('resolves source and computed dimensions from scalar frontmatter', () => {
    const profile = loadWorkItemProfile();

    expect(
      resolveStateVector(profile, {
        status: 'ready-for-review',
        status_reason: 'implementation-complete',
      })
    ).toEqual({
      status: 'ready-for-review',
      reason: 'implementation-complete',
      category: 'review',
      connectivity: 'intermediate',
    });

    expect(
      resolveStateVector(profile, {
        status: 'closed',
        status_reason: 'success',
      })
    ).toEqual({
      status: 'closed',
      reason: 'success',
      category: 'completed',
      connectivity: 'end',
    });
  });

  it('evaluates work-item transitions using the compiled profile', () => {
    const profile = loadWorkItemProfile();
    const previous = resolveStateVector(profile, {
      status: 'ready',
      status_reason: 'prioritized',
    });
    const current = resolveStateVector(profile, {
      status: 'in-progress',
      status_reason: 'implementation',
    });

    expect(evaluateTransition(previous, current, profile.transitions)).toEqual({
      allowed: true,
      matchedRuleId: 'forward-ready-to-in-progress',
    });
  });

  it('rejects lookup reason keys outside the status-scoped reason domain', () => {
    const profile = cloneWorkItemProfile() as {
      lookupTables: {
        statusReasonCategories: {
          map: Record<string, Record<string, string>>;
        };
      };
    };
    profile.lookupTables.statusReasonCategories.map['ready-for-review'].implemented = 'review';

    expect(() =>
      compileTransitionProfile(profile, readJson(TRANSITION_PROFILE_SHAPE_PATH), [
        profile,
        readJson(STATUS_DEFINITIONS_SCHEMA_PATH),
      ])
    ).toThrowError(TransitionProfileError);
  });

  it('rejects lookup values outside the declared table enum', () => {
    const profile = cloneWorkItemProfile() as {
      lookupTables: {
        statusReasonCategories: {
          map: Record<string, Record<string, string>>;
        };
      };
    };
    profile.lookupTables.statusReasonCategories.map.closed.completed = 'unknown';

    expect(() =>
      compileTransitionProfile(profile, readJson(TRANSITION_PROFILE_SHAPE_PATH), [
        profile,
        readJson(STATUS_DEFINITIONS_SCHEMA_PATH),
      ])
    ).toThrowError(TransitionProfileError);
  });

  it('rejects transition selector values outside configured domains', () => {
    const profile = cloneWorkItemProfile() as {
      transitions: {
        rules: Array<{ from: Record<string, string> }>;
      };
    };
    profile.transitions.rules[0].from.status = 'unknown';

    expect(() =>
      compileTransitionProfile(profile, readJson(TRANSITION_PROFILE_SHAPE_PATH), [
        profile,
        readJson(STATUS_DEFINITIONS_SCHEMA_PATH),
      ])
    ).toThrowError(TransitionProfileError);
  });

  it('compiles consumer-defined statuses and transitions from a separate vocabulary', () => {
    const vocabulary = {
      $id: '/consumer/status-definitions.schema.json',
      $defs: {
        status: {
          type: 'string',
          enum: ['queued', 'building', 'shipped'],
        },
      },
    };
    const profile = {
      version: '1.0.0',
      sourceDimensions: {
        status: {
          path: '/status',
          domain: '/consumer/status-definitions.schema.json#/$defs/status',
        },
      },
      derivedDimensions: {},
      lookupTables: {},
      transitions: {
        precedence: ['status'],
        rules: [
          {
            id: 'start-building',
            from: { status: 'queued' },
            to: { status: 'building' },
            decision: 'allow',
          },
          {
            id: 'ship',
            from: { status: 'building' },
            to: { status: 'shipped' },
            decision: 'allow',
          },
        ],
      },
    };

    const compiled = compileTransitionProfile(profile, readJson(TRANSITION_PROFILE_SHAPE_PATH), [
      vocabulary,
    ]);

    expect(
      evaluateTransition(
        resolveStateVector(compiled, { status: 'building' }),
        resolveStateVector(compiled, { status: 'shipped' }),
        compiled.transitions
      )
    ).toEqual({ allowed: true, matchedRuleId: 'ship' });
  });

  it('composes workflow-neutral work-item structure with consumer-defined statuses', () => {
    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    for (const path of [
      ...collectJsonFiles('schemas/frontmatter'),
      'schemas/work-management/support/common.json',
      'schemas/work-management/contracts/work-item-structure.schema.json',
      'schemas/work-management/workflows/default/generated/status-reason-compatibility.schema.json',
      'schemas/work-management/workflows/default/status-definitions.schema.json',
      'schemas/work-management/workflows/default/status-policy.schema.json',
      'schemas/work-management/frontmatter/work-item.json',
    ]) {
      ajv.addSchema(readJson(path));
    }

    const consumerStatusSchema = {
      $id: '/consumer/workflows/status-policy.schema.json',
      type: 'object',
      properties: {
        status: {
          enum: ['queued', 'building', 'shipped'],
        },
      },
    };
    ajv.addSchema(consumerStatusSchema);
    const validateConsumer = ajv.compile({
      $id: '/consumer/frontmatter/work-item.json',
      type: 'object',
      unevaluatedProperties: false,
      allOf: [
        { $ref: '/work-management/contracts/work-item-structure.schema.json' },
        { $ref: consumerStatusSchema.$id },
      ],
    });
    const workItem = {
      $schema: '/consumer/frontmatter/work-item.json',
      id: 'work-item:consumer-example',
      title: 'Consumer workflow example',
      type: 'work-item',
      subtype: 'task',
      lifecycle: 'active',
      status: 'building',
      summary: 'Validate consumer-defined statuses',
      priority: 'medium',
      estimated: 1,
    };

    expect(validateConsumer(workItem), JSON.stringify(validateConsumer.errors)).toBe(true);
    const validateDefault = ajv.getSchema('/work-management/frontmatter/work-item.json');
    expect(
      validateDefault?.({
        ...workItem,
        $schema: 'schemas/work-management/frontmatter/work-item.json',
      })
    ).toBe(false);
  });
});
