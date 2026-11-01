/**
 * Test Report Generator
 * Runs all tests and generates a comprehensive report
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface TestResult {
  name: string;
  command: string;
  success: boolean;
  output: string;
  duration: number;
}

const results: TestResult[] = [];

function runTest(name: string, command: string): TestResult {
  console.log(`\n🧪 Running: ${name}`);
  const start = Date.now();
  let output = '';
  let success = false;

  try {
    output = execSync(command, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      cwd: join(__dirname, '..'),
    });
    success = true;
    console.log(`✅ ${name} - PASSED`);
  } catch (error: any) {
    output = error.stdout || error.stderr || error.message;
    success = false;
    console.log(`❌ ${name} - FAILED`);
    console.log(output.substring(0, 2000));
  }

  const duration = Date.now() - start;
  const result: TestResult = { name, command, success, output, duration };
  results.push(result);
  return result;
}

function generateReport() {
  const total = results.length;
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  let report = `
================================================================================
                    BACKEND TEST REPORT - SAAS CRM
================================================================================
Date: ${new Date().toISOString()}
Total Test Suites: ${total}
Passed: ${passed} (${((passed / total) * 100).toFixed(1)}%)
Failed: ${failed} (${((failed / total) * 100).toFixed(1)}%)
Total Duration: ${(totalDuration / 1000).toFixed(2)}s
================================================================================

DETAILED RESULTS:
--------------------------------------------------------------------------------
`;

  results.forEach((r, i) => {
    report += `
${i + 1}. ${r.name}
   Status: ${r.success ? '✅ PASSED' : '❌ FAILED'}
   Duration: ${(r.duration / 1000).toFixed(2)}s
   Command: ${r.command}
`;
    if (!r.success) {
      report += `   Error Output:\n${r.output.substring(0, 1500)}\n`;
    }
  });

  report += `
================================================================================
SUMMARY
================================================================================
${failed === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failed} TEST SUITE(S) FAILED`}
--------------------------------------------------------------------------------
`;

  writeFileSync('test-report.txt', report);
  console.log(report);

  process.exit(failed > 0 ? 1 : 0);
}

// Run all tests
async function main() {
  console.log('🚀 Starting Backend Test Suite\n');

  // 1. Unit tests (Jest)
  runTest('Unit Tests (Jest)', 'npx jest --config jest.config.ts --passWithNoTests');

  // 2. E2E tests
  runTest('E2E Tests', 'npx jest --config test/jest-e2e.json --passWithNoTests');

  generateReport();
}

main();
