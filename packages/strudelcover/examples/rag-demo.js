/**
 * Demo of the StrudelCover RAG system
 */

import { rag } from '../src/rag/index.js';
import chalk from 'chalk';

async function main() {
  console.log(chalk.blue('StrudelCover RAG System Demo\n'));
  
  // Initialize the RAG system
  console.log(chalk.gray('Initializing RAG system...'));
  await rag.initialize();
  
  // Get statistics
  const stats = rag.getStats();
  console.log(chalk.green(`\nDatabase loaded with ${stats.totalPatterns} patterns`));
  console.log(chalk.gray(`Pattern types: ${Object.keys(stats.byType).join(', ')}`));
  
  // Example 1: Retrieve drum patterns for a verse
  console.log(chalk.blue('\n1. Retrieving drum patterns for verse section at 120 BPM:'));
  const drumPatterns = await rag.retrieve({
    type: 'drums',
    section: 'verse',
    tempo: 120,
    topK: 3
  });
  
  drumPatterns.forEach((pattern, i) => {
    console.log(chalk.yellow(`\nExample ${i + 1}:`));
    console.log(chalk.gray(pattern.description));
    console.log(pattern.code);
  });
  
  // Example 2: Retrieve bass patterns for electronic style
  console.log(chalk.blue('\n2. Retrieving bass patterns for electronic style:'));
  const bassPatterns = await rag.retrieve({
    type: 'bass',
    style: 'electronic',
    tempo: 130,
    key: 'C minor',
    topK: 2
  });
  
  bassPatterns.forEach((pattern, i) => {
    console.log(chalk.yellow(`\nExample ${i + 1}:`));
    console.log(chalk.gray(pattern.description));
    console.log(pattern.code);
  });
  
  // Example 3: Validate a pattern
  console.log(chalk.blue('\n3. Validating a pattern:'));
  const testPattern = `$: "bd sd bd sd".sound()`;
  const validation = rag.validatePattern(testPattern);
  
  if (validation.valid) {
    console.log(chalk.green('✓ Pattern is valid'));
  } else {
    console.log(chalk.red('✗ Pattern has errors:'));
    validation.errors.forEach(err => console.log(chalk.red(`  - ${err}`)));
  }
  
  if (validation.warnings.length > 0) {
    console.log(chalk.yellow('Warnings:'));
    validation.warnings.forEach(warn => console.log(chalk.yellow(`  - ${warn}`)));
  }
  
  // Example 4: Auto-fix a broken pattern
  console.log(chalk.blue('\n4. Auto-fixing a broken pattern:'));
  const brokenPattern = `.sound(kick).gain(0.8)`;
  console.log(chalk.gray('Original:'), brokenPattern);
  
  const fixed = rag.autoFixPattern(brokenPattern);
  console.log(chalk.green('Fixed:'), fixed);
  
  // Example 5: Build prompt with examples
  console.log(chalk.blue('\n5. Building enhanced prompt:'));
  const basePrompt = 'Generate a drum pattern for a high-energy techno track';
  const examples = await rag.retrieve({
    type: 'drums',
    style: 'electronic',
    tempo: 140,
    topK: 2
  });
  
  const enhancedPrompt = rag.buildPromptWithExamples(basePrompt, examples);
  console.log(chalk.gray('Enhanced prompt preview:'));
  console.log(enhancedPrompt.substring(0, 500) + '...');
  
  // Example 6: Search with natural language
  if (process.env.OPENAI_API_KEY) {
    console.log(chalk.blue('\n6. Natural language search:'));
    const searchResults = await rag.search('ambient pad with reverb', {
      type: 'atmosphere',
      topK: 2
    });
    
    searchResults.forEach((result, i) => {
      console.log(chalk.yellow(`\nResult ${i + 1}:`));
      console.log(chalk.gray(result.description));
      console.log(result.code);
    });
  } else {
    console.log(chalk.yellow('\n6. Skipping natural language search (no OpenAI API key)'));
  }
}

// Run the demo
main().catch(console.error);