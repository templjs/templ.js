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
          // Rebaselined to the current measured suite after adding direct tests
          // for schema resolution, expression analysis, and scope resolution.
          // These values stay near the measured totals while leaving almost no
          // room for further regression.
          lines: 85,
          functions: 94,
          branches: 71,
          statements: 85,
        },
      },
    },
  })
);
