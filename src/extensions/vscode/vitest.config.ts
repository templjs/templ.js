import path from 'path';
import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../../vitest.config.ts';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['test/**/*.test.ts'],
      coverage: {
        reportsDirectory: path.resolve(__dirname, 'coverage'),
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.spec.ts'],
        thresholds: {
          // VS Code extension thresholds baselined to measured coverage during WI-031.
          // Functions: 99% (measured exactly 100% - using 99% to allow for variation)
          // Branches: 75% (measured 75% - exact match)
          // Lines/Statements: 96% (measured 97.14% - 1% margin)
          // Extension tests consolidated in test/ directory (not published in npm).
          lines: 96,
          functions: 99,
          branches: 75,
          statements: 96,
        },
      },
    },
  })
);
