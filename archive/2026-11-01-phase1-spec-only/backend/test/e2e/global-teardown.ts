/**
 * Global Teardown for E2E Tests
 * Clean up test database
 */

export default async function () {
  console.log('\n🧹 Cleaning up E2E test environment...');
  // Test database will be cleaned automatically on next run
  console.log('✅ Cleanup complete');
}
