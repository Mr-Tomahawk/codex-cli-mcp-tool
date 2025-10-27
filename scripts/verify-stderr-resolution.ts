#!/usr/bin/env tsx

/**
 * Manual verification script for US-001: Restore Structured Codex Output in MCP
 * Task: T-018 - Create manual verification script
 *
 * This script demonstrates that the stderr-first resolution logic works correctly.
 * It executes a shell command that writes structured output to stderr and verifies
 * that the executeCommand function correctly identifies and returns the structured
 * content from stderr instead of stdout.
 *
 * Usage:
 *   npx tsx scripts/verify-stderr-resolution.ts
 *
 *   Or with npm:
 *   npm run verify
 *
 * Expected behavior:
 *   - Script executes a command that writes structured output to stderr
 *   - Result should contain the structured sections (--------/thinking/codex markers)
 *   - This proves stderr-first resolution is working as designed
 *   - The script will output PASS if structured markers are detected in the result
 *
 * Background:
 *   US-001 fixed an issue where Codex CLI output was not being captured correctly
 *   in non-TTY (MCP server) contexts. The fix implements stderr-first resolution:
 *   when structured output markers are detected in stderr, use stderr; otherwise
 *   fallback to stdout for backward compatibility.
 */

import { executeCommand } from '../src/utils/commandExecutor.js';

async function verify(): Promise<void> {
  console.log('='.repeat(70));
  console.log('US-001 Manual Verification: Stderr-First Resolution');
  console.log('='.repeat(70));
  console.log();

  // Test 1: Verify stderr with structured markers is used
  console.log('Test 1: Structured output to stderr');
  console.log('-'.repeat(70));

  const structuredOutput = `--------
thinking: This is the reasoning section where Codex analyzes the request
--------
codex: This is the actual response from Codex
--------`;

  try {
    const result = await executeCommand(
      'sh',
      ['-c', `echo "${structuredOutput}" >&2`],
      undefined,
      5000
    );

    console.log('Command executed successfully');
    console.log();
    console.log('Result received:');
    console.log(result);
    console.log();

    const hasThinking = result.includes('thinking');
    const hasCodex = result.includes('codex');
    const hasDivider = result.includes('--------');

    console.log('Verification checks:');
    console.log(`  - Contains 'thinking' section: ${hasThinking ? '✓' : '✗'}`);
    console.log(`  - Contains 'codex' section: ${hasCodex ? '✓' : '✗'}`);
    console.log(`  - Contains '--------' dividers: ${hasDivider ? '✓' : '✗'}`);
    console.log();

    if (hasThinking && hasCodex && hasDivider) {
      console.log('Status: PASS ✓');
      console.log('Stderr-first resolution is working correctly!');
    } else {
      console.log('Status: FAIL ✗');
      console.log('Structured markers not found in result.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Test 1 failed with error:', error);
    process.exit(1);
  }

  console.log();
  console.log('-'.repeat(70));
  console.log();

  // Test 2: Verify fallback to stdout when no structured markers
  console.log('Test 2: Fallback to stdout (no structured markers)');
  console.log('-'.repeat(70));

  try {
    const result = await executeCommand(
      'echo',
      ['Hello from stdout'],
      undefined,
      5000
    );

    console.log('Command executed successfully');
    console.log();
    console.log('Result received:');
    console.log(result);
    console.log();

    const hasExpectedOutput = result.includes('Hello from stdout');
    const hasNoStructuredMarkers = !result.includes('--------') &&
                                   !result.includes('thinking') &&
                                   !result.includes('codex');

    console.log('Verification checks:');
    console.log(`  - Contains expected stdout text: ${hasExpectedOutput ? '✓' : '✗'}`);
    console.log(`  - No structured markers present: ${hasNoStructuredMarkers ? '✓' : '✗'}`);
    console.log();

    if (hasExpectedOutput && hasNoStructuredMarkers) {
      console.log('Status: PASS ✓');
      console.log('Stdout fallback is working correctly!');
    } else {
      console.log('Status: FAIL ✗');
      console.log('Stdout fallback behavior incorrect.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Test 2 failed with error:', error);
    process.exit(1);
  }

  console.log();
  console.log('='.repeat(70));
  console.log('All tests passed! ✓');
  console.log('US-001 stderr-first resolution is working as designed.');
  console.log('='.repeat(70));
}

// Execute verification
verify().catch((error) => {
  console.error('Verification script failed:', error);
  process.exit(1);
});
