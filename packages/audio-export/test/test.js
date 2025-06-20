import StrudelAudioExport from '../src/index.js';
import { existsSync, unlinkSync } from 'fs';

console.log('🧪 Running audio export tests...\n');

const exporter = new StrudelAudioExport({ headless: true });
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    failed++;
  }
}

// Test 1: Basic WebM export
await test('Basic WebM export', async () => {
  const result = await exporter.exportToFile(
    "s('bd')",
    'test-output.webm',
    { duration: 1 }
  );
  if (!existsSync('test-output.webm')) {
    throw new Error('Output file not created');
  }
  unlinkSync('test-output.webm');
});

// Test 2: Export to buffer
await test('Export to buffer', async () => {
  const buffer = await exporter.exportToBuffer(
    "s('hh')",
    { duration: 1 }
  );
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Invalid buffer');
  }
});

// Test 3: Invalid pattern handling
await test('Invalid pattern handling', async () => {
  try {
    await exporter.exportToBuffer("invalid((", { duration: 1 });
    throw new Error('Should have thrown error');
  } catch (error) {
    if (!error.message.includes('Pattern error')) {
      throw error;
    }
  }
});

// Test 4: Batch export
await test('Batch export', async () => {
  const results = await exporter.exportBatch([
    { pattern: "s('bd')", output: 'test-bd.webm' },
    { pattern: "s('hh')", output: 'test-hh.webm' }
  ]);
  
  if (results.length !== 2 || !results[0].success) {
    throw new Error('Batch export failed');
  }
  
  // Clean up
  if (existsSync('test-bd.webm')) unlinkSync('test-bd.webm');
  if (existsSync('test-hh.webm')) unlinkSync('test-hh.webm');
});

// Summary
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);