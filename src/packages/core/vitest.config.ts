import path from 'path';
import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../../vitest.config.ts';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
      coverage: {
        reportsDirectory: path.resolve(__dirname, 'coverage'),
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'test/**/*.ts'],
        thresholds: {
          lines: 96,
          functions: 95,
          branches: 90,
          statements: 96,
          autoUpdate: false,
          perFile: false,
        },
      },
    },
  })
);
