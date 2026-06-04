import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  generateStatusReasonCompatibilitySchema,
  main,
  serializeGeneratedSchema,
  StatusReasonCompatibilityGenerationError,
} from './generate-default-work-item-status-reason-compatibility.ts';

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(process.cwd(), path), 'utf8')) as Record<string, unknown>;
}

const TRANSITION_PROFILE_PATH = 'schemas/work-management/workflows/default/transition-profile.json';
const STATUS_DEFINITIONS_SCHEMA_PATH =
  'schemas/work-management/workflows/default/status-definitions.schema.json';
const GENERATED_SCHEMA_PATH =
  'schemas/work-management/workflows/default/generated/status-reason-compatibility.schema.json';

function readDefaultInputs() {
  const profile = readJson(TRANSITION_PROFILE_PATH);
  return { profile, schemas: [profile, readJson(STATUS_DEFINITIONS_SCHEMA_PATH)] };
}

function cloneDefaultProfile(): Record<string, unknown> {
  return structuredClone(readJson(TRANSITION_PROFILE_PATH));
}

function readReasonDomainBy(profile: Record<string, unknown>) {
  return (
    profile.sourceDimensions as {
      reason: {
        domainBy: {
          cases: Record<string, string>;
          requiredCases: string[];
        };
      };
    }
  ).reason.domainBy;
}

describe('default work-item status-reason compatibility generator', () => {
  it('generates status-scoped reason branches and required cases from the profile', () => {
    const { profile, schemas } = readDefaultInputs();
    const generated = generateStatusReasonCompatibilitySchema(profile, schemas) as {
      oneOf: Array<{
        required: string[];
        properties: {
          status: { const: string };
          status_reason: { anyOf: Array<{ $ref: string }> };
        };
      }>;
    };

    expect(generated.oneOf.map((branch) => branch.properties.status.const)).toEqual([
      'proposed',
      'ready',
      'in-progress',
      'ready-for-review',
      'closed',
    ]);
    expect(generated.oneOf.at(-1)?.required).toEqual(['status', 'status_reason']);
    expect(generated.oneOf[0].required).toEqual(['status']);
    expect(generated.oneOf[0].properties.status_reason.anyOf[0].$ref).toBe(
      '/work-management/workflows/default/status-definitions.schema.json#/$defs/proposedReason'
    );
  });

  it('derives emitted field names from source dimension paths', () => {
    const vocabulary = {
      $id: '/consumer/status-definitions.schema.json',
      $defs: {
        status: {
          type: 'string',
          enum: ['todo', 'done'],
        },
        todoReason: {
          type: 'string',
          enum: ['planned'],
        },
        doneReason: {
          type: 'string',
          enum: ['delivered'],
        },
      },
    };
    const profile = {
      sourceDimensions: {
        status: {
          path: '/state',
          domain: '/consumer/status-definitions.schema.json#/$defs/status',
        },
        reason: {
          path: '/state_reason',
          domainBy: {
            dimension: 'status',
            cases: {
              todo: '/consumer/status-definitions.schema.json#/$defs/todoReason',
              done: '/consumer/status-definitions.schema.json#/$defs/doneReason',
            },
            requiredCases: ['done'],
          },
        },
      },
    };

    const generated = generateStatusReasonCompatibilitySchema(profile, [vocabulary]) as {
      oneOf: Array<{ required: string[]; properties: Record<string, unknown> }>;
    };

    expect(generated.oneOf[0].required).toEqual(['state']);
    expect(generated.oneOf[1].required).toEqual(['state', 'state_reason']);
    expect(generated.oneOf[0].properties).toHaveProperty('state');
    expect(generated.oneOf[1].properties).toHaveProperty('state_reason');
  });

  it('rejects required cases that are not declared by the dependent domain', () => {
    const profile = cloneDefaultProfile();
    readReasonDomainBy(profile).requiredCases.push('unknown');

    expect(() =>
      generateStatusReasonCompatibilitySchema(profile, [
        profile,
        readJson(STATUS_DEFINITIONS_SCHEMA_PATH),
      ])
    ).toThrowError(StatusReasonCompatibilityGenerationError);
  });

  it('rejects missing status-to-reason mappings', () => {
    const profile = cloneDefaultProfile();
    delete readReasonDomainBy(profile).cases.ready;

    expect(() =>
      generateStatusReasonCompatibilitySchema(profile, [
        profile,
        readJson(STATUS_DEFINITIONS_SCHEMA_PATH),
      ])
    ).toThrowError(StatusReasonCompatibilityGenerationError);
  });

  it('generates branches from a consumer-defined vocabulary', () => {
    const vocabulary = {
      $id: '/consumer/status-definitions.schema.json',
      $defs: {
        status: {
          type: 'string',
          enum: ['todo', 'done'],
        },
        todoReason: {
          type: 'string',
          enum: ['planned'],
        },
        doneReason: {
          type: 'string',
          enum: ['delivered'],
        },
      },
    };
    const profile = {
      sourceDimensions: {
        status: {
          path: '/status',
          domain: '/consumer/status-definitions.schema.json#/$defs/status',
        },
        reason: {
          path: '/status_reason',
          domainBy: {
            dimension: 'status',
            cases: {
              todo: '/consumer/status-definitions.schema.json#/$defs/todoReason',
              done: '/consumer/status-definitions.schema.json#/$defs/doneReason',
            },
            requiredCases: ['done'],
          },
        },
      },
    };

    const generated = generateStatusReasonCompatibilitySchema(profile, [vocabulary]) as {
      oneOf: Array<{ required: string[]; properties: { status: { const: string } } }>;
    };

    expect(generated.oneOf).toHaveLength(2);
    expect(generated.oneOf[1]).toMatchObject({
      required: ['status', 'status_reason'],
      properties: { status: { const: 'done' } },
    });
  });

  it('serializes generated schemas deterministically with trailing newline', () => {
    const { profile, schemas } = readDefaultInputs();
    const generated = generateStatusReasonCompatibilitySchema(profile, schemas);
    const serialized = serializeGeneratedSchema(generated);

    expect(serialized.endsWith('\n')).toBe(true);
    expect(serialized).toContain('"$schema": "https://json-schema.org/draft/2020-12/schema"');
    expect(serialized).toContain('"oneOf": [');
  });

  it('fails --check when generated schema is stale', () => {
    const generatedPath = join(process.cwd(), GENERATED_SCHEMA_PATH);
    const tempDir = mkdtempSync(join(tmpdir(), 'templjs-schema-check-'));
    const tempGeneratedPath = join(tempDir, 'status-reason-compatibility.schema.json');
    const original = readFileSync(generatedPath, 'utf8');
    const previousOverride = process.env.TEMPLJS_GENERATED_SCHEMA_PATH;

    try {
      writeFileSync(tempGeneratedPath, `${original}\n`, 'utf8');
      process.env.TEMPLJS_GENERATED_SCHEMA_PATH = tempGeneratedPath;
      expect(main(['--check'])).toBe(1);
    } finally {
      if (previousOverride === undefined) {
        delete process.env.TEMPLJS_GENERATED_SCHEMA_PATH;
      } else {
        process.env.TEMPLJS_GENERATED_SCHEMA_PATH = previousOverride;
      }
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
