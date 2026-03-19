import path from 'path';
import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../../vitest.config.ts';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      coverage: {
        reportsDirectory: path.resolve(__dirname, 'coverage'),
        thresholds: {
          // CLI package thresholds baselined to measured coverage during WI-031.
          // Functions: 100% (measured exactly 100% in CLI command tests)
          // Branches: 78% (measured 78.94% - exact match for current code)
          // Lines/Statements: 95% (measured 95.23% - tight margin due to CLI specificity)
          // CLI tests are consolidated in test/ directory (not published in npm).
          lines: 95,
          functions: 100,
          branches: 78,
          statements: 95,
        },
      },
    },
  })
);
