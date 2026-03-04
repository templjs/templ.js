import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../../vitest.config.ts';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          // Volar package thresholds baselined to measured coverage during WI-031.
          // Lines: 97% (measured 97% - very tight alignment with actual coverage)
          // Functions: 96% (measured 98.55% - 2% margin for edge cases)
          // Branches: 79% (measured 86.86% - 7% margin for complex control flow)
          // Statements: 94% (measured 96.9% - 2% margin)
          // Volar provides language features (completions, hover, diagnostics).
          lines: 97,
          functions: 96,
          branches: 79,
          statements: 94,
        },
      },
    },
  })
);
