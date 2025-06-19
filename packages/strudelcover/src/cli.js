#!/usr/bin/env node

import { program } from 'commander';
import { StrudelCover } from './index.js';
import chalk from 'chalk';
import ora from 'ora';
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from project root
config({ path: resolve(__dirname, '../../../.env') });

// Main program
program
  .name('strudelcover')
  .description('AI-powered tool to recreate songs as Strudel patterns')
  .version('0.1.0');

// Removed Spotify commands - using SoundCloud instead

// Default cover generation command
const coverCommand = program
  .command('cover <input> <artist> <song>', { isDefault: true })
  .description('Generate a Strudel cover of a song')
  .option('-k, --api-key <key>', 'OpenAI API key (or set OPENAI_API_KEY env var)')
  .option('-o, --output <dir>', 'Output directory', './strudelcover-output')
  .option('-i, --iterations <n>', 'Max refinement iterations', '5')
  .option('-t, --target <score>', 'Target similarity score (0-100)', '80')
  .option('-d, --duration <seconds>', 'Max duration to analyze', '30')
  .option('-m, --manual', 'Use manual threshold mode instead of auto score mode')
  .option('--llm <provider>', 'LLM provider: openai, anthropic, ollama', 'openai')
  .option('--model <model>', 'LLM model to use')
  .option('--llm-base-url <url>', 'Custom LLM API endpoint')
  .option('--tempo-threshold <bpm>', 'Max tempo difference (BPM)', '5')
  .option('--energy-threshold <diff>', 'Max energy difference', '0.1')
  .option('--brightness-threshold <diff>', 'Max brightness difference', '0.2')
  .option('--kick-threshold <similarity>', 'Min kick pattern similarity', '0.7')
  .option('--snare-threshold <similarity>', 'Min snare pattern similarity', '0.7')
  .option('--require-key-match', 'Require exact key match')
  .option('-s, --sparkle', 'SPARKLE MODE: Maximum visual effects and cyber aesthetics')
  .option('-c, --complex', 'COMPLEX MODE: Generate full-length songs with multiple sections')
  .action(async (input, artist, song, options) => {
    console.log(chalk.blue.bold('\n🎸 StrudelCover - AI Song Recreation\n'));
    
    const spinner = ora('Initializing...').start();
    
    try {
      // Configure LLM
      const llmProvider = options.llm || 'openai';
      const envKeyName = `${llmProvider.toUpperCase()}_API_KEY`;
      const apiKey = options.apiKey || process.env[envKeyName] || process.env.OPENAI_API_KEY;
      
      if (!apiKey && llmProvider !== 'ollama') {
        spinner.fail(`${llmProvider} API key required (use --api-key or set ${envKeyName})`);
        process.exit(1);
      }
      
      // Input should be a local audio file
      const audioPath = input;
      if (!existsSync(audioPath)) {
        spinner.fail(`File not found: ${audioPath}`);
        process.exit(1);
      }
      
      spinner.succeed('Ready to create cover!');
      
      // Create StrudelCover instance
      const coverOptions = {
        llm: llmProvider,
        llmConfig: {
          apiKey,
          model: options.model,
          baseURL: options.llmBaseUrl
        },
        outputDir: options.output,
        maxIterations: parseInt(options.iterations),
        targetScore: parseInt(options.target),
        autoMode: !options.manual,
        sparkle: options.sparkle,
        complex: options.complex
      };
      
      // Add manual mode thresholds if specified
      if (options.manual) {
        coverOptions.thresholds = {
          tempo: parseFloat(options.tempoThreshold || 5),
          key: options.requireKeyMatch || false,
          energy: parseFloat(options.energyThreshold || 0.1),
          brightness: parseFloat(options.brightnessThreshold || 0.2),
          kickSimilarity: parseFloat(options.kickThreshold || 0.7),
          snareSimilarity: parseFloat(options.snareThreshold || 0.7)
        };
      }
      
      const cover = new StrudelCover(coverOptions);
      
      // Generate cover
      const results = await cover.cover(audioPath, artist, song, {
        duration: parseInt(options.duration)
      });
      
      // Success!
      console.log(chalk.green.bold('\n🎉 Cover generation complete!\n'));
      
    } catch (error) {
      spinner.fail('Cover generation failed');
      console.error(chalk.red('Error:'), error.message);
      console.error(chalk.gray(error.stack));
      process.exit(1);
    }
  });

// Add examples to help
program.on('--help', () => {
  console.log('');
  console.log('Commands:');
  console.log('  cover <input> <artist> <song>  Generate a Strudel cover (default)');
  console.log('');
  console.log('Examples:');
  console.log('  # Basic usage (auto mode with default target score of 80)');
  console.log('  $ strudelcover song.mp3 "The Beatles" "Hey Jude"');
  console.log('');
  console.log('  # Using different LLM providers');
  console.log('  $ strudelcover song.mp3 "Artist" "Song" --llm anthropic');
  console.log('  $ strudelcover song.mp3 "Artist" "Song" --llm ollama --model llama2');
  console.log('');
  console.log('  # Custom target score and iterations');
  console.log('  $ strudelcover audio.wav "Daft Punk" "Get Lucky" --iterations 10 --target 90');
  console.log('');
  console.log('  # Manual threshold mode');
  console.log('  $ strudelcover song.mp3 "Artist" "Song" --manual --tempo-threshold 3 --require-key-match');
  console.log('');
  console.log('  # SPARKLE MODE - Maximum visual effects');
  console.log('  $ strudelcover song.mp3 "Artist" "Song" --sparkle');
  console.log('');
  console.log('Modes:');
  console.log('  Auto Mode (default):   Uses overall similarity score (0-100)');
  console.log('  Manual Mode (--manual): Must meet all specified thresholds');
  console.log('');
  console.log('LLM Providers:');
  console.log('  openai (default)  - GPT-4o, requires OPENAI_API_KEY');
  console.log('  anthropic         - Claude, requires ANTHROPIC_API_KEY');
  console.log('  ollama            - Local models, no API key needed');
  console.log('');
  console.log('Environment Variables:');
  console.log('  OPENAI_API_KEY        OpenAI API key');
  console.log('  ANTHROPIC_API_KEY     Anthropic API key');
});

program.parse();