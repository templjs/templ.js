import path from 'path';
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../../vitest.config.ts';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      coverage: {
        reportsDirectory: path.resolve(__dirname, 'coverage'),
        exclude: [...configDefaults.exclude, '**/{test,dist}/**', 'src/public-types.ts'],
      },
    },
  })
);
