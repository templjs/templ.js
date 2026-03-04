import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../../vitest.config.ts';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      coverage: {
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
