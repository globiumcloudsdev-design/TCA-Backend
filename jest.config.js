export default {
  testEnvironment: 'node',
  transform: {},
  testTimeout: 30000,
  verbose: true,
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],
};
