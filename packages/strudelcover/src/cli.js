#!/usr/bin/env node

import { program } from 'commander';
import { StrudelCover } from './index.js';
import chalk from 'chalk';
import ora from 'ora';
import { config } from 'dotenv';
import { existsSync } from 'fs';
import ytdl from 'ytdl-core';
import { join } from 'path';

// Load environment variables
config();

program
  .name('strudelcover')
  .description('AI-powered tool to recreate songs as Strudel patterns')
  .version('0.1.0')
  .argument('<input>', 'Song file path or YouTube URL')
  .argument('<artist>', 'Artist name')
  .argument('<song>', 'Song name')
  .option('-k, --api-key <key>', 'OpenAI API key (or set OPENAI_API_KEY env var)')
  .option('-o, --output <dir>', 'Output directory', './strudelcover-output')
  .option('-i, --iterations <n>', 'Max refinement iterations', '5')
  .option('-t, --target <score>', 'Target similarity score (0-100)', '80')
  .option('--no-llm', 'Skip LLM generation (use basic patterns only)')
  .option('-d, --duration <seconds>', 'Max duration to analyze', '30')
  .action(async (input, artist, song, options) => {
    console.log(chalk.blue.bold('\n🎸 StrudelCover - AI Song Recreation\n'));
    
    const spinner = ora('Initializing...').start();
    
    try {
      // Get API key
      const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey && !options.noLlm) {
        spinner.fail('OpenAI API key required (use --api-key or set OPENAI_API_KEY)');
        process.exit(1);
      }
      
      // Handle YouTube URLs
      let audioPath = input;
      if (input.includes('youtube.com') || input.includes('youtu.be')) {
        spinner.text = 'Downloading from YouTube...';
        
        const info = await ytdl.getInfo(input);
        const audioFormat = ytdl.chooseFormat(info.formats, { 
          quality: 'highestaudio',
          filter: 'audioonly' 
        });
        
        audioPath = join(options.output, 'original.webm');
        await new Promise((resolve, reject) => {
          ytdl(input, { format: audioFormat })
            .pipe(require('fs').createWriteStream(audioPath))
            .on('finish', resolve)
            .on('error', reject);
        });
      } else if (!existsSync(audioPath)) {
        spinner.fail(`File not found: ${audioPath}`);
        process.exit(1);
      }
      
      spinner.succeed('Ready to create cover!');
      
      // Create StrudelCover instance
      const cover = new StrudelCover({
        openaiKey: apiKey,
        outputDir: options.output,
        maxIterations: parseInt(options.iterations),
        targetScore: parseInt(options.target)
      });
      
      // Generate cover
      const results = await cover.cover(audioPath, artist, song, {
        noLLM: options.noLlm,
        duration: parseInt(options.duration)
      });
      
      // Success!
      console.log(chalk.green.bold('\n🎉 Cover generation complete!\n'));
      
    } catch (error) {
      spinner.fail('Cover generation failed');
      console.error(chalk.red('Error:'), error.message);
      if (error.stack && process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Add examples to help
program.on('--help', () => {
  console.log('');
  console.log('Examples:');
  console.log('  $ strudelcover song.mp3 "The Beatles" "Hey Jude"');
  console.log('  $ strudelcover https://youtube.com/watch?v=... "Artist" "Song"');
  console.log('  $ strudelcover audio.wav "Daft Punk" "Get Lucky" --iterations 10');
  console.log('  $ strudelcover song.mp3 "Queen" "Bohemian Rhapsody" --no-llm');
  console.log('');
  console.log('Environment Variables:');
  console.log('  OPENAI_API_KEY    Your OpenAI API key for pattern generation');
});

program.parse();