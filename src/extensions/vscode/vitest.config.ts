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
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
          perFile: true,
        },
      },
    },
  })
);
