import StrudelAudioExport from '../src/index.js';

// Create exporter
const exporter = new StrudelAudioExport({
  duration: 4,
  format: 'wav',
  quality: 'high'
});

console.log('🎵 Strudel Audio Export - Batch Processing\n');

// Define a drum kit to export
const drumKit = [
  { 
    pattern: "s('bd').gain(1.2)", 
    output: 'drums/kick.wav',
    options: { duration: 2 }
  },
  { 
    pattern: "s('sn').shape(0.5)", 
    output: 'drums/snare.wav',
    options: { duration: 2 }
  },
  { 
    pattern: "s('hh').gain(0.8)", 
    output: 'drums/hihat.wav',
    options: { duration: 1 }
  },
  { 
    pattern: "s('oh').gain(0.7)", 
    output: 'drums/openhihat.wav',
    options: { duration: 2 }
  },
  { 
    pattern: "s('cp')", 
    output: 'drums/clap.wav',
    options: { duration: 1 }
  }
];

// Create drums directory
import { mkdirSync, existsSync } from 'fs';
if (!existsSync('drums')) {
  mkdirSync('drums');
}

// Export all drum sounds
console.log('Exporting drum kit...\n');
const results = await exporter.exportBatch(drumKit);

// Show results
results.forEach((result, i) => {
  if (result.success) {
    console.log(`✓ ${drumKit[i].output} - ${(result.size / 1024).toFixed(1)} KB`);
  } else {
    console.log(`✗ ${drumKit[i].output} - Error: ${result.error}`);
  }
});

// Example 2: Export variations of a pattern
console.log('\n\nExporting pattern variations...\n');

const basePattern = "note('c3 e3 g3 b3')";
const variations = [
  { pattern: `${basePattern}.s('sawtooth')`, output: 'variations/saw.wav' },
  { pattern: `${basePattern}.s('square')`, output: 'variations/square.wav' },
  { pattern: `${basePattern}.s('triangle')`, output: 'variations/triangle.wav' },
  { pattern: `${basePattern}.s('sine').vibrato(4)`, output: 'variations/sine-vibrato.wav' }
];

if (!existsSync('variations')) {
  mkdirSync('variations');
}

const varResults = await exporter.exportBatch(variations);
varResults.forEach((result, i) => {
  if (result.success) {
    console.log(`✓ ${variations[i].output}`);
  }
});

console.log('\n🎉 Batch export complete!');