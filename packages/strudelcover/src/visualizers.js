/**
 * Strudel visualizer patterns for sparkle mode
 */

export const visualizerPatterns = {
  // Matrix rain effect
  matrix: `
// MATRIX RAIN VISUALIZER
.analyze()
.onTrigger((t, e) => {
  const freq = e.value?.spectralCentroid || 1000;
  const energy = e.value?.energy || 0.5;
  console.log(\`[MATRIX] freq: \${freq.toFixed(0)}Hz energy: \${(energy*100).toFixed(0)}%\`);
})`,

  // Spectrum analyzer
  spectrum: `
// SPECTRUM ANALYZER
.fft(2048)
.onTrigger((t, e) => {
  const spectrum = e.value?.spectrum || [];
  const bars = spectrum.slice(0, 16).map(v => '█'.repeat(Math.floor(v * 10)));
  console.log('[SPECTRUM]', bars.join(''));
})`,

  // Beat detector
  beatDetector: `
// BEAT DETECTOR
.analyze(['energy', 'rms'])
.onTrigger((t, e) => {
  const beat = e.value?.energy > 0.7 ? '🔥' : '·';
  process.stdout.write(beat);
})`,

  // Waveform visualizer
  waveform: `
// WAVEFORM VISUALIZER
.analyze(['waveform'])
.onTrigger((t, e) => {
  const wave = e.value?.waveform || [];
  const visual = wave.slice(0, 40).map(v => {
    const height = Math.floor((v + 1) * 4);
    return '▁▂▃▄▅▆▇█'[height] || '█';
  }).join('');
  console.log('[WAVE]', visual);
})`,

  // Cyber data stream
  cyber: `
// CYBER DATA STREAM
.analyze()
.onTrigger((t) => {
  const data = Array(20).fill(0).map(() => Math.random() > 0.5 ? '1' : '0').join('');
  console.log(\`[CYBER] \${data} t:\${t.toFixed(2)}\`);
})`,

  // Neural network simulation
  neural: `
// NEURAL NETWORK SIMULATION
.analyze(['mfcc'])
.onTrigger((t, e) => {
  const neurons = ['◉', '○', '◎', '◈'];
  const activity = Array(8).fill(0).map(() => 
    neurons[Math.floor(Math.random() * neurons.length)]
  ).join(' ');
  console.log(\`[NEURAL] \${activity}\`);
})`
};

/**
 * Add random visualizers to a pattern
 */
export function addVisualizers(pattern, count = 3) {
  const visualizers = Object.values(visualizerPatterns);
  const selected = [];
  
  // Select random visualizers
  for (let i = 0; i < count && i < visualizers.length; i++) {
    const index = Math.floor(Math.random() * visualizers.length);
    if (!selected.includes(visualizers[index])) {
      selected.push(visualizers[index]);
    }
  }
  
  // Add visualizers to the pattern
  const lines = pattern.split('\n');
  const lastLine = lines[lines.length - 1];
  
  // Insert visualizers before the last line
  lines.splice(lines.length - 1, 0, ...selected);
  
  return lines.join('\n');
}

/**
 * Create a sparkle-enhanced pattern
 */
export function sparkleEnhance(pattern) {
  // Add visualizers
  let enhanced = addVisualizers(pattern, 2);
  
  // Add some visual effects to the code
  enhanced = enhanced
    // Add comment indicators instead of emojis (to avoid syntax errors)
    .replace(/setcps/g, 'setcps /* ⚡ TEMPO SYNC */')
    .replace(/stack/g, 'stack /* 📊 PATTERN STACK */')
    .replace(/room/g, 'room /* 🌌 SPACE EFFECT */')
    .replace(/gain/g, 'gain /* 🔊 VOLUME CONTROL */')
    // Add cyber comments
    .replace(/\n/g, (match, offset) => {
      if (Math.random() < 0.3 && offset > 0) {
        const cyberComments = [
          '\n// [QUANTUM FLUX DETECTED]',
          '\n// [HARMONIC RESONANCE ACTIVE]',
          '\n// [NEURAL SYNTHESIS ENGAGED]',
          '\n// [PATTERN MATRIX INITIALIZED]',
          '\n// [AUDIO PIPELINE OPTIMIZED]'
        ];
        return cyberComments[Math.floor(Math.random() * cyberComments.length)] + match;
      }
      return match;
    });
  
  // Add header
  const header = `// ═══════════════════════════════════════════
// ║ STRUDELCOVER PATTERN SYNTHESIS v2.0     ║
// ║ [SPARKLE MODE ACTIVE]                   ║
// ║ Neural Pattern ID: ${Math.random().toString(36).substring(7).toUpperCase()} ║
// ═══════════════════════════════════════════

`;
  
  return header + enhanced;
}