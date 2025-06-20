import StrudelAudioExport from './src/index.js';

const exporter = new StrudelAudioExport({ 
  headless: false  // This will show the browser window
});

const pattern = `s("bd hh*2 sd hh*2")
  .speed("1 1.5 1 2")
  .gain(".8 .6")`;

console.log('🎬 Starting export with visualization...');
console.log('Watch the browser window for the enhanced interface!');

try {
  const result = await exporter.exportToFile(
    pattern,
    'test-visual.webm',
    { duration: 10 }
  );
  
  console.log('✅ Export complete:', result);
} catch (error) {
  console.error('❌ Export failed:', error);
}