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
    coverage: {
      reportsDirectory: path.resolve(__dirname, 'coverage'),
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [...configDefaults.include],
      exclude: [...configDefaults.exclude, '**/.worktrees/**'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
        autoUpdate: true,
        perFile: true,
      },
    },
  },
});
