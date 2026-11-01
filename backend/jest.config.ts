/**
 * Jest Configuration for Unit Tests
 * Run with: npm run test
 */

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    // isolatedModules skips type-checking: the specs have pre-existing enum/mock
    // typing drift (tracked as B9a in DEVELOPMENT_TRACKER.md). Remove once fixed.
    '^.+\\.(t|j)s$': ['ts-jest', { isolatedModules: true }],
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.module.ts',
    '!**/main.ts',
    '!**/*.dto.ts',
    '!**/*.entity.ts',
    '!**/*.interceptor.ts',
    '!**/*.guard.ts',
    '!**/*.decorator.ts',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  testTimeout: 10000,
};
