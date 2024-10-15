/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/src/**/*.test.ts'],
  coveragePathIgnorePatterns: ['\/__jest__\/'],
  moduleNameMapper: {
    "^@/(.*)": "<rootDir>/src/$1"
  },
  preset: 'ts-jest',
  testEnvironment: 'node',
};
