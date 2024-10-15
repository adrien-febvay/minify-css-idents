/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  runner: 'jest-runner-eslint',
  displayName: 'lint',
  testMatch: ['<rootDir>/src/**/*.ts'],
  testPathIgnorePatterns: ['/node_modules/', '\.d\.ts$']
};
