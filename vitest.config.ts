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
    include: ['**/test/**/*.test.ts'],
    coverage: {
      reportsDirectory: path.resolve(__dirname, 'coverage'),
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [...configDefaults.exclude, '**/{test,dist}/**', '**/*.spec.ts'],
      thresholds: {
        // Global thresholds are set to measured baselines to catch regressions
        // while avoiding false failures due to noise in coverage measurements.
        // Baselines determined from actual measured coverage across all packages (WI-031).
        // perFile: false - allows some variation across files while catching overall regressions.
        // NOTE: ADR-006 aspirational targets (90%+ all metrics) to be achieved before v1.0 release.
        // See WI-034 for reconciliation plan.
        lines: 95,
        functions: 99,
        branches: 75,
        statements: 95,
        autoUpdate: false, // enable to rebaseline thresholds
        perFile: false,
      },
    },
  },
});
