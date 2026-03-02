import path from 'path';
import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.ts';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['src/**/*.test.ts'],
      coverage: {
        reportsDirectory: path.resolve(__dirname, 'coverage'),
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
        thresholds: {
          lines: 90,
          functions: 90,
          branches: 50,
          statements: 90,
        },
      },
    },
  })
);
