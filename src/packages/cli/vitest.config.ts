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
          lines: 85,
          functions: 85,
          branches: 85,
          statements: 85,
          perFile: true,
        },
      },
    },
  })
);
