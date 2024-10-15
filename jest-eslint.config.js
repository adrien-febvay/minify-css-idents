/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  runner: 'jest-runner-eslint',
  displayName: 'lint',
  testMatch: ['<rootDir>/src/**/*.ts'],
  // Do not watch files from ESLint test suite.
  watchPathIgnorePatterns: ['<rootDir>/.*'],
};
