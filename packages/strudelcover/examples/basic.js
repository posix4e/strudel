import StrudelCover from '../src/index.js';

// Example: Generate a cover without LLM (using basic pattern generation)
async function basicExample() {
  console.log('StrudelCover Basic Example\n');
  
  const cover = new StrudelCover({
    outputDir: './example-output',
    maxIterations: 3,
    targetScore: 70
  });
  
  // You'll need to provide your own audio file
  const audioFile = process.argv[2];
  if (!audioFile) {
    console.error('Usage: node basic.js <audio-file>');
    process.exit(1);
  }
  
  try {
    const results = await cover.cover(
      audioFile,
      'Example Artist',
      'Example Song',
      { noLLM: true } // Use basic pattern generation
    );
    
    console.log('\nResults:');
    console.log(`Best Score: ${results.bestScore}/100`);
    console.log(`\nGenerated Pattern:\n${results.bestPattern}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

basicExample();