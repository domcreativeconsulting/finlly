/**
 * Jest configuration for integration tests.
 *
 * This config runs only *.integration.test.js files so that unit tests
 * (which use Prisma mocks) and integration tests (which need a real
 * PostgreSQL database) never execute in the same Jest run.
 *
 * Prerequisites:
 *   - DATABASE_TEST_URL env var pointing to a live PostgreSQL test database
 *   - Migrations applied:  npx prisma db push --schema=prisma/schema.prisma
 *
 * Usage:
 *   npm run test:integration --workspace=apps/api
 *   # or directly:
 *   node --experimental-vm-modules ../../node_modules/jest/bin/jest.js \
 *     --config jest.integration.config.js
 */

export default {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/*.integration.test.js'],
  testTimeout: 30000,
  // ESM support — same flags as the unit-test configuration
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Integration tests must not share module state with unit tests
  // Each file gets its own module registry
  resetModules: false,
};
