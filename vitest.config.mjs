import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Enable global test APIs (describe, test, expect, etc.)
    globals: true,

    // Use Node.js environment
    environment: 'node',

    // Test file patterns
    include: [
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.d.ts',
        'src/index.ts',
        'tests/',
        '*.config.*',
        'rollup.config.js'
      ],
      thresholds: {
        global: {
          branches: 79,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },

    // Test timeout
    testTimeout: 10000,

    // Reporter configuration - updated to avoid deprecated 'basic' reporter
    reporters: [
      [
        'default',
        {
          summary: false
        }
      ]
    ]
  },

  // Resolve configuration for better module resolution
  resolve: {
    alias: {
      '@': './src'
    }
  }
});
