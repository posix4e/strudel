import StrudelAudioExport from '../src/index.js';

// Create exporter and queue
const exporter = new StrudelAudioExport({
  headless: true,
  quality: 'high'
});
const queue = exporter.createRenderQueue();

console.log('🎵 Strudel Audio Export - Render Queue Example\n');

// Define patterns to render
const patterns = [
  { name: 'Ambient Pad', pattern: "note('c2 f2 g2').s('pad').slow(4)", file: 'ambient.wav', duration: 16 },
  { name: 'Drum Loop', pattern: "s('bd*4, [~ cp], hh*8')", file: 'drums.wav', duration: 8 },
  { name: 'Bass Line', pattern: "note('c2 eb2 g2 bb2').s('bass')", file: 'bass.wav', duration: 8 },
  { name: 'Lead Melody', pattern: "note('c4 d4 eb4 g4').s('lead').cutoff(2000)", file: 'lead.wav', duration: 8 },
  { name: 'Percussion', pattern: "s('shaker*16').gain(0.5).pan(sine)", file: 'percussion.wav', duration: 4 }
];

// Add all patterns to queue
console.log('Adding patterns to render queue...\n');

const promises = patterns.map(({ name, pattern, file, duration }) => {
  console.log(`📝 Queued: ${name}`);
  return queue.add(pattern, file, { duration });
});

// Monitor queue status
const statusInterval = setInterval(() => {
  const status = queue.getStatus();
  if (status.processing) {
    process.stdout.write(`\r⏳ Processing... ${status.pending} patterns remaining`);
  }
}, 100);

// Wait for all renders to complete
try {
  const results = await Promise.all(promises);
  clearInterval(statusInterval);
  
  console.log('\n\n✅ All patterns rendered successfully!\n');
  
  results.forEach((result, i) => {
    console.log(`📁 ${patterns[i].name}: ${result.path} (${(result.size / 1024).toFixed(1)} KB)`);
  });
  
} catch (error) {
  clearInterval(statusInterval);
  console.error('\n❌ Rendering error:', error.message);
}

// Example: Dynamic queue with error handling
console.log('\n\n--- Dynamic Queue Example ---\n');

// Function to add pattern with retry
async function renderWithRetry(pattern, output, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`🎹 Rendering: ${output} (attempt ${i + 1})`);
      const result = await queue.add(pattern, output, { duration: 4 });
      console.log(`✓ Success: ${output}`);
      return result;
    } catch (error) {
      console.log(`✗ Failed: ${output} - ${error.message}`);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
    }
  }
}

// Render some patterns with error handling
const dynamicPatterns = [
  renderWithRetry("s('jazz').chop(8)", 'jazz-chop.wav'),
  renderWithRetry("s('birds').speed(0.5)", 'birds-slow.wav'),
  renderWithRetry("invalidPattern(", 'error.wav') // This will fail
];

const dynamicResults = await Promise.allSettled(dynamicPatterns);

console.log('\nDynamic queue results:');
dynamicResults.forEach((result, i) => {
  if (result.status === 'fulfilled') {
    console.log(`✅ Pattern ${i + 1}: Success`);
  } else {
    console.log(`❌ Pattern ${i + 1}: ${result.reason.message}`);
  }
});

console.log('\n🎉 Queue example complete!');