import path from 'path';
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../../vitest.config.ts';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['**/test/**/*.test.ts', '**/src/**/*.test.ts'],
      coverage: {
        reportsDirectory: path.resolve(__dirname, 'coverage'),
        exclude: [
          ...configDefaults.exclude,
          '**/{test,dist}/**',
          '**/*.spec.ts',
          'src/index.ts',
          'src/parser/types.ts',
          'src/query-engine/types.ts',
          'src/schema/types.ts',
          'src/renderer/types.ts',
          'test/query-engine/catalog.ts',
          'test/renderer/renderer.test-helpers.ts',
        ],
        thresholds: {
          lines: 95,
          functions: 95,
          branches: 95,
          statements: 95,
          perFile: true,
        },
      },
    },
  })
);
