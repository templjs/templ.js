import path from 'path';
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../../vitest.config.ts';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // extension-host tests require @vscode/test-electron; exclude from vitest
      exclude: [...configDefaults.exclude, '**/extension-host/**', '**/.vscode-test/**'],
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
