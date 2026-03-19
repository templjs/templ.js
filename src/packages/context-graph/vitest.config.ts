import path from 'path';
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../../vitest.config.ts';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      coverage: {
        reportsDirectory: path.resolve(__dirname, 'coverage'),
        exclude: [
          ...configDefaults.exclude,
          '**/{test,dist}/**',
          '**/*.spec.ts',
          'src/public-types.ts',
        ],
        thresholds: {
          lines: 95,
          functions: 95,
          branches: 90,
          statements: 95,
        },
      },
    },
  })
);
