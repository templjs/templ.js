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
          lines: 92,
          functions: 92,
          branches: 92,
          statements: 92,
          perFile: true,
        },
      },
    },
  })
);
