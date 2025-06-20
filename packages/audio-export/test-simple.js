import { exportPattern } from './src/exporter.js';

console.log('Testing simple export...');

try {
  const result = await exportPattern({
    pattern: "s('bd*4')",
    output: 'test-simple.webm',
    duration: 2,
    format: 'webm',
    headless: false // Show browser to debug
  });
  
  console.log('Success!', result);
} catch (error) {
  console.error('Error:', error);
}