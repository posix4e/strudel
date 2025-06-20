import StrudelCover from '../src/index.js';
import { config } from 'dotenv';

// Load environment variables
config();

// Example: Generate a cover using AI
async function example() {
  console.log('StrudelCover Example\n');
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable required');
    process.exit(1);
  }
  
  const audioFile = process.argv[2];
  if (!audioFile) {
    console.error('Usage: node basic.js <audio-file>');
    process.exit(1);
  }
  
  const cover = new StrudelCover({
    openaiKey: apiKey,
    outputDir: './example-output',
    maxIterations: 3,
    targetScore: 70
  });
  
  try {
    const results = await cover.cover(
      audioFile,
      'Example Artist',
      'Example Song'
    );
    
    console.log('\nResults:');
    console.log(`Best Score: ${results.bestScore}/100`);
    console.log(`\nGenerated Pattern:\n${results.bestPattern}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

example();