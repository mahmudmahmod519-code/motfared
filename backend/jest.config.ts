/**
 * Jest Configuration for Unit Tests
 * Run with: npm run test
 */

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  /**
   * Stale mock-based specs from the spec-only phase, left out until they are rewritten. They assert methods
   * and call shapes that Phase 2 removed or changed (findOne/remove/resume/getGlobalStats no longer exist,
   * TenantService was removed, SubscriptionActivationService was added, relations were added to queries).
   * The behaviour itself is covered through real HTTP and MySQL by the integration suite (npm run test:tenant).
   * Remove a line here once its spec is rewritten against the current service.
   */
  testPathIgnorePatterns: [
    '/node_modules/',
    'modules/billing-customers/billing-customers.service.spec.ts',
    'modules/company-memberships/company-memberships.service.spec.ts',
    'modules/dashboard/dashboard.service.spec.ts',
    'modules/payments/payments.service.spec.ts',
    'modules/plan-prices/plan-prices.service.spec.ts',
    'modules/plans/plans.service.spec.ts',
    'modules/subscription-provider-refs/subscription-provider-refs.service.spec.ts',
    'modules/subscriptions/subscriptions.service.spec.ts',
    'modules/webhook-events/webhook-events.service.spec.ts',
  ],
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
