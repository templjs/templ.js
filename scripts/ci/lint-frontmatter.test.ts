import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyStrictSeverity, evaluateTransition } from './lint-frontmatter.ts';

describe('lint-frontmatter transition contract', () => {
  const transitionProfile = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        'schemas',
        'work-management',
        'workflows',
        'default',
        'transition-profile.json'
      ),
      'utf-8'
    )
  ) as {
    transitions: Parameters<typeof evaluateTransition>[2];
  };
  const contract = transitionProfile.transitions;

  it('allows canonical forward transition with reason-level fidelity', () => {
    const result = evaluateTransition(
      { status: 'ready', reason: 'prioritized', category: 'planning' },
      { status: 'in-progress', reason: 'implementation', category: 'execution' },
      contract
    );

    expect(result.allowed).toBe(true);
    expect(result.matchedRuleId).toBe('forward-ready-to-in-progress');
  });

  it('rejects disallowed reason-aware transition', () => {
    const result = evaluateTransition(
      { status: 'ready', reason: 'prioritized', category: 'planning' },
      {
        status: 'ready-for-review',
        reason: 'implementation-complete',
        category: 'review',
      },
      contract
    );

    expect(result.allowed).toBe(false);
    expect(result.matchedRuleId).toBeNull();
  });
});

describe('lint-frontmatter strict severity composition', () => {
  it('promotes semantic warnings to errors in strict mode by default', () => {
    const result = applyStrictSeverity(
      {
        code: 'transition-reason-churn',
        path: '/status_reason',
        message: 'reason churn',
        severity: 'warn',
        semantic: true,
      },
      true,
      {}
    );

    expect(result.severity).toBe('error');
    expect(result.masked).toBe(false);
  });

  it('keeps warning severity when consumer policy explicitly sets warn', () => {
    const result = applyStrictSeverity(
      {
        code: 'transition-reason-churn',
        path: '/status_reason',
        message: 'reason churn',
        severity: 'warn',
        semantic: true,
      },
      true,
      {
        automation: {
          prePushValidation: {
            severity: {
              'transition-reason-churn': 'warn',
            },
          },
        },
      }
    );

    expect(result.severity).toBe('warn');
    expect(result.masked).toBe(true);
  });

  it('keeps warning severity when semantic category is configured as warn', () => {
    const result = applyStrictSeverity(
      {
        code: 'transition-reason-churn',
        path: '/status_reason',
        message: 'reason churn',
        severity: 'warn',
        semantic: true,
      },
      true,
      {
        automation: {
          prePushValidation: {
            severity: {
              semantic: 'warn',
            },
          },
        },
      }
    );

    expect(result.severity).toBe('warn');
    expect(result.masked).toBe(true);
  });
});
