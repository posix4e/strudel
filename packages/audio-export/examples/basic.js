import StrudelAudioExport from '../src/index.js';

// Create exporter instance
const exporter = new StrudelAudioExport();

console.log('🎵 Strudel Audio Export - Basic Examples\n');

// Example 1: Simple drum pattern to WAV
console.log('1. Exporting drum pattern to WAV...');
await exporter.exportToFile(
  "s('bd*4, hh*8')",
  'drums.wav',
  { duration: 8 }
);
console.log('✓ Saved to drums.wav\n');

// Example 2: Melodic pattern to MP3
console.log('2. Exporting melody to MP3...');
await exporter.exportToFile(
  "note('c3 e3 g3 b3').s('sawtooth').cutoff(1000)",
  'melody.mp3',
  { duration: 8, bitRate: '256k' }
);
console.log('✓ Saved to melody.mp3\n');

// Example 3: Complex pattern to high-quality WAV
console.log('3. Exporting complex pattern...');
await exporter.exportToFile(
  `stack(
    s('bd*4'),
    s('hh*8').gain(0.5),
    note('c2 eb2 g2 bb2').s('bass').slow(2)
  ).room(0.5)`,
  'complex.wav',
  { 
    duration: 16,
    sampleRate: 48000,
    quality: 'high'
  }
);
console.log('✓ Saved to complex.wav\n');

// Example 4: Export to buffer
console.log('4. Exporting to buffer...');
const buffer = await exporter.exportToBuffer(
  "s('cp').every(4, rev)",
  { format: 'webm', duration: 4 }
);
console.log(`✓ Buffer size: ${(buffer.length / 1024).toFixed(1)} KB\n`);

console.log('🎉 All exports complete!');