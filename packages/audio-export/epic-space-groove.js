import StrudelAudioExport from './src/index.js';

const exporter = new StrudelAudioExport({ 
  headless: false  // Show the browser window
});

// Epic space groove pattern
const pattern = `stack(
  // Pulsing bass
  s("bd*4").gain("1 0.8 0.9 0.7").speed("0.8 1 0.9 1.1"),
  
  // Glitchy hi-hats
  s("hh*16").gain(sine.range(0.3, 0.8).fast(4))
    .pan(sine.range(-0.8, 0.8).slow(2))
    .speed("1 2 1.5 0.8".fast(2)),
  
  // Snare with reverb
  s("sd ~ sd ~").room(0.8).size(0.9),
  
  // Ambient pad
  s("pad").note("c2 eb2 g2 bb2".slow(4))
    .gain(0.3).room(0.95).size(0.98),
  
  // Laser effects
  s("laser*8?").speed(rand.range(2, 8))
    .gain(0.4).pan(rand.range(-1, 1)),
  
  // Rhythmic clicks
  s("click*32?").gain(0.2).speed("4 8 6 2".fast(4))
    .cutoff(sine.range(800, 4000).fast(8))
)
.slow(2)`;

console.log('🚀 Starting epic space groove export...');
console.log('🎛️  Watch the visualizer for some wild action!');

try {
  const result = await exporter.exportToFile(
    pattern,
    'epic-space-groove-' + new Date().toISOString().slice(0,10) + '.webm',
    { duration: 15 }
  );
  
  console.log('✨ Export complete:', result);
  console.log(`🎵 File saved as: ${result.path}`);
  console.log(`📦 Size: ${(result.size / 1024).toFixed(1)} KB`);
} catch (error) {
  console.error('❌ Export failed:', error);
}