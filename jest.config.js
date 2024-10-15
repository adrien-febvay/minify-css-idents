/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  projects: [
    '<rootDir>/jest-tests.config.js',
    '<rootDir>/jest-eslint.config.js',
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
