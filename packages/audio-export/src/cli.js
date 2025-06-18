#!/usr/bin/env node

import { program } from 'commander';
import { exportPattern } from './exporter.js';
import ora from 'ora';
import chalk from 'chalk';
import { resolve } from 'path';
import { existsSync } from 'fs';

program
  .name('strudel-export')
  .description('Export Strudel patterns to audio files')
  .version('0.1.0')
  .argument('<pattern>', 'Strudel pattern to export (e.g., "s(\'bd*4, hh*8\')")')
  .argument('<output>', 'Output file path (e.g., output.webm, output.wav, output.mp3)')
  .option('-d, --duration <seconds>', 'Duration in seconds', '8')
  .option('-f, --format <format>', 'Output format (auto-detected from filename)', 'auto')
  .option('-q, --quality <quality>', 'Audio quality (low, medium, high)', 'high')
  .option('--headless', 'Run in headless mode (no browser window)', false)
  .option('--sample-rate <rate>', 'Sample rate for WAV output', '44100')
  .option('--bit-rate <rate>', 'Bit rate for MP3 output (e.g., 128k, 192k, 320k)', '192k')
  .option('--prebake <code>', 'Custom prebake code (default: loads dirt-samples)')
  .action(async (pattern, output, options) => {
    const spinner = ora('Initializing Strudel audio export...').start();

    try {
      // Validate output path
      const outputPath = resolve(output);
      const outputDir = outputPath.substring(0, outputPath.lastIndexOf('/'));
      
      if (outputDir && !existsSync(outputDir)) {
        spinner.fail(`Output directory does not exist: ${outputDir}`);
        process.exit(1);
      }

      // Auto-detect format from filename
      let format = options.format;
      if (format === 'auto') {
        const ext = output.toLowerCase().split('.').pop();
        if (['webm', 'wav', 'mp3', 'ogg', 'flac'].includes(ext)) {
          format = ext;
        } else {
          format = 'webm';
          console.warn(chalk.yellow(`Unknown extension .${ext}, defaulting to WebM format`));
        }
      }

      spinner.text = 'Setting up browser environment...';

      // Export options
      const exportOptions = {
        pattern,
        output: outputPath,
        duration: parseFloat(options.duration),
        format,
        quality: options.quality,
        headless: options.headless,
        sampleRate: parseInt(options.sampleRate),
        bitRate: options.bitRate,
        prebake: options.prebake
      };

      // Show export details
      console.log(chalk.cyan('\n🎵 Strudel Audio Export'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(chalk.white('Pattern:  ') + chalk.yellow(pattern));
      console.log(chalk.white('Output:   ') + chalk.green(outputPath));
      console.log(chalk.white('Duration: ') + chalk.blue(`${exportOptions.duration}s`));
      console.log(chalk.white('Format:   ') + chalk.blue(format.toUpperCase()));
      
      if (format === 'mp3') {
        console.log(chalk.white('Bit Rate: ') + chalk.blue(options.bitRate));
      } else if (format === 'wav') {
        console.log(chalk.white('Sample Rate: ') + chalk.blue(`${options.sampleRate} Hz`));
      }
      console.log(chalk.gray('─'.repeat(40)) + '\n');

      spinner.text = 'Exporting pattern...';
      
      // Perform export
      const result = await exportPattern(exportOptions);

      spinner.succeed(`Export complete! File saved to: ${chalk.green(outputPath)}`);
      
      // Show file info
      console.log(chalk.gray(`\nFile size: ${(result.size / 1024 / 1024).toFixed(2)} MB`));
      console.log(chalk.gray(`Duration: ${result.duration.toFixed(1)}s`));
      console.log(chalk.gray(`Format: ${result.format.toUpperCase()}`));

    } catch (error) {
      spinner.fail('Export failed');
      console.error(chalk.red('\nError:'), error.message);
      
      if (error.message.includes('ffmpeg')) {
        console.log(chalk.yellow('\nNote: Format conversion requires FFmpeg to be installed.'));
        console.log(chalk.yellow('Install with: brew install ffmpeg (macOS) or apt-get install ffmpeg (Linux)'));
      }
      
      process.exit(1);
    }
  });

// Add examples to help
program.on('--help', () => {
  console.log('');
  console.log('Examples:');
  console.log('  $ strudel-export "s(\'bd*4, hh*8\')" drums.webm');
  console.log('  $ strudel-export "note(\'c3 e3 g3 b3\').s(\'sawtooth\')" melody.wav -d 16');
  console.log('  $ strudel-export "stack(s(\'bd*4\'), s(\'hh*8\').gain(0.5))" beat.mp3 --bit-rate 320k');
  console.log('  $ strudel-export "s(\'jazz\').chop(8).rev()" reversed.wav --headless');
  console.log('');
  console.log('Supported formats:');
  console.log('  - WebM (default, native browser recording)');
  console.log('  - WAV (lossless, requires FFmpeg)');
  console.log('  - MP3 (compressed, requires FFmpeg)');
  console.log('  - OGG (compressed, requires FFmpeg)');
  console.log('  - FLAC (lossless compressed, requires FFmpeg)');
});

program.parse();