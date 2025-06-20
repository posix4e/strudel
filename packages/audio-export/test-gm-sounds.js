#!/usr/bin/env node

import { exportPattern } from './src/exporter.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the comprehensive prebake
const prebake = readFileSync(join(__dirname, 'comprehensive-prebake.js'), 'utf8');

// Test pattern using GM sounds (ameliewaltz pattern)
const pattern = `setDefaultVoicings('legacy')
stack(
  n("[0@2 ~, ~ [[1,2,3] ~]!2]")
  .chord("<[Dm Am]!2 [F C]!2>/4")
  .anchor("<[B3 G3]!2 [C4 B3]!2>/4")
  .voicing().velocity(0.5)
  ,
  n("<[3@5.5 2@0.5 1@3 0@3] [3@3.5 [4 3 2 1 2]@2.5 1@3 0@3] [2@5.5 1@0.5 -3@6]!2>/4")
  .scale("a4:minor")
  
).s("gm_harmonica").lpf(4000).clip(1)
  .attack(0.1).release(0.1)
  .room(1.5)
  .cpm(64).gain(.6)
  .pianoroll()`;

console.log('Testing GM sound loading...');
console.log('Pattern: ameliewaltz (uses gm_harmonica)');

exportPattern({
  pattern,
  output: 'test-gm-output.webm',
  duration: 10,
  headless: false,
  prebake
}).then(result => {
  if (result.success) {
    console.log('✅ Export successful!');
    console.log(`File saved to: ${result.path}`);
    console.log(`Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
  } else {
    console.error('❌ Export failed:', result.error);
    if (result.details) {
      console.error('Details:', result.details);
    }
  }
}).catch(err => {
  console.error('Error:', err);
});