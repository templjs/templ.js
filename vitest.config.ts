import path from 'path';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@templjs/core': path.resolve(__dirname, 'src/packages/core/src/index.ts'),
      '@templjs/volar': path.resolve(__dirname, 'src/packages/volar/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    coverage: {
      reportsDirectory: path.resolve(__dirname, 'coverage'),
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [...configDefaults.exclude, '**/.worktrees/**'],
      thresholds: {
        lines: 98.8,
        functions: 100,
        branches: 98.21,
        statements: 98.86,
        autoUpdate: true,
        perFile: true,
      },
    },
  },
});
