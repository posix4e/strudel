// Simple test to verify audio export works
import StrudelAudioExport from '@strudel/audio-export';

const exporter = new StrudelAudioExport({ 
  headless: false,
  duration: 5
});

const simplePattern = `$: s("bd*4, hh*8").room(0.2)`;

console.log('Testing simple pattern:', simplePattern);

try {
  await exporter.exportToFile(simplePattern, 'test-simple.wav', {
    duration: 5,
    format: 'wav'
  });
  console.log('✅ Simple pattern worked!');
} catch (error) {
  console.error('❌ Simple pattern failed:', error.message);
}

await exporter.close();