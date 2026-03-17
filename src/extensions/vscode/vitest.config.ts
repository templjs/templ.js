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
          // Rebaselined to the current measured suite after activation and
          // middleware coverage expansion in the coverage remediation branch.
          // Keep thresholds pinned close to the measured totals so future
          // regressions still fail quickly.
          lines: 83,
          functions: 91,
          branches: 70,
          statements: 83,
        },
      },
    },
  })
);
