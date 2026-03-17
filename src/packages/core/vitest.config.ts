import path from 'path';
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../../vitest.config.ts';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['**/test/**/*.test.ts', '**/src/**/*.test.ts'],
      coverage: {
        reportsDirectory: path.resolve(__dirname, 'coverage'),
        exclude: [
          ...configDefaults.exclude,
          '**/{test,dist}/**',
          '**/*.spec.ts',
          'src/index.ts',
          'src/parser/types.ts',
          'src/query-engine/types.ts',
          'src/schema/types.ts',
          'src/renderer/types.ts',
          'test/query-engine/catalog.ts',
          'test/renderer/renderer.test-helpers.ts',
        ],
        thresholds: {
          // Core package thresholds baselined to measured coverage during WI-031.
          // Functions: 99% (measured 99.02% in core/schema tests)
          // Branches: 88% (measured 93.04% - set 5% margin for edge case variations)
          // Lines/Statements: 96% (measured 97.55% - 1% margin)
          // These realistic baselines ensure coverage gates catch real regressions
          // without generating false failures from normal test variation.
          lines: 96,
          functions: 99,
          branches: 88,
          statements: 96,
        },
      },
    },
  })
);
