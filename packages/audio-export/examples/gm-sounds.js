#!/usr/bin/env node

// Example showing how to use GM (General MIDI) sounds in audio export

import { exportPattern } from '../src/exporter.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the comprehensive prebake that includes GM sounds
const prebake = readFileSync(join(dirname(__dirname), 'comprehensive-prebake.js'), 'utf8');

// Example patterns using GM sounds
const patterns = [
  {
    name: 'harmonica-waltz',
    description: 'Amelie waltz using GM harmonica',
    pattern: `setDefaultVoicings('legacy')
stack(
  n("[0@2 ~, ~ [[1,2,3] ~]!2]")
  .chord("<[Dm Am]!2 [F C]!2>/4")
  .anchor("<[B3 G3]!2 [C4 B3]!2>/4")
  .voicing().velocity(0.5),
  n("<[3@5.5 2@0.5 1@3 0@3] [3@3.5 [4 3 2 1 2]@2.5 1@3 0@3] [2@5.5 1@0.5 -3@6]!2>/4")
  .scale("a4:minor")
).s("gm_harmonica").lpf(4000).clip(1)
  .attack(0.1).release(0.1)
  .room(1.5)
  .cpm(64).gain(.6)`
  },
  {
    name: 'piano-melody',
    description: 'Simple piano melody using GM piano',
    pattern: `n("0 2 4 7 4 2 0 ~").scale("C:major")
  .s("gm_piano")
  .room(0.5).gain(0.7)`
  },
  {
    name: 'violin-arpeggio',
    description: 'Violin arpeggios using GM violin',
    pattern: `n("[0,2,4,7]".arp("updown").fast(2))
  .scale("D:minor")
  .s("gm_violin")
  .attack(0.1).release(0.3)
  .room(1).gain(0.6)`
  },
  {
    name: 'bass-groove',
    description: 'Electric bass groove using GM bass',
    pattern: `n("0 0 3 5").s("gm_electric_bass_finger")
  .scale("G2:minor")
  .lpf(800).gain(0.8)`
  }
];

// Export a specific pattern
const selectedPattern = patterns[0]; // Change index to try different patterns

console.log(`🎵 Exporting: ${selectedPattern.name}`);
console.log(`   ${selectedPattern.description}`);
console.log('');

exportPattern({
  pattern: selectedPattern.pattern,
  output: `gm-${selectedPattern.name}.webm`,
  duration: 16,
  headless: false,
  prebake
}).then(result => {
  if (result.success) {
    console.log('✅ Export successful!');
    console.log(`   File: ${result.path}`);
    console.log(`   Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Duration: ${result.duration}s`);
  } else {
    console.error('❌ Export failed:', result.error);
  }
}).catch(err => {
  console.error('Error:', err);
});