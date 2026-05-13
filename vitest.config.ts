import path from 'path';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@templjs/core': path.resolve(__dirname, 'src/packages/core/src/index.ts'),
      '@templjs/volar': path.resolve(__dirname, 'src/packages/volar/src/index.ts'),
      '@templjs/language-core': path.resolve(__dirname, 'src/packages/language-core/src/index.ts'),
      '@templjs/language-service': path.resolve(
        __dirname,
        'src/packages/language-service/src/index.ts'
      ),
      '@templjs/semantify': path.resolve(__dirname, 'src/packages/semantify/src/index.ts'),
      '@templjs/language-server': path.resolve(
        __dirname,
        'src/packages/language-server/src/index.ts'
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    include: ['**/*.test.ts'],
    coverage: {
      reportsDirectory: path.resolve(__dirname, 'coverage'),
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [...configDefaults.exclude, '**/{test,dist}/**', '**/*.{test,spec}.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
        autoUpdate: false,
        perFile: true,
      },
    },
  },
});
