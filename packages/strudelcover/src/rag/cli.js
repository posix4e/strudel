#!/usr/bin/env node

/**
 * CLI tool for managing the StrudelCover RAG database
 */

import { Command } from 'commander';
import { RAGSystem } from './index.js';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import ora from 'ora';

const program = new Command();

program
  .name('strudelcover-rag')
  .description('CLI tool for managing StrudelCover RAG database')
  .version('1.0.0');

// Initialize command
program
  .command('init')
  .description('Initialize the RAG database with default patterns')
  .option('--repo <path>', 'Path to strudel-songs-collection repository')
  .action(async (options) => {
    const spinner = ora('Initializing RAG database...').start();
    
    try {
      const rag = new RAGSystem();
      await rag.initialize();
      
      const stats = rag.getStats();
      spinner.succeed(chalk.green(`RAG database initialized with ${stats.totalPatterns} patterns`));
      
      console.log(chalk.blue('\nDatabase statistics:'));
      console.log(chalk.gray(`By type: ${JSON.stringify(stats.byType, null, 2)}`));
      console.log(chalk.gray(`By section: ${JSON.stringify(stats.bySection, null, 2)}`));
    } catch (error) {
      spinner.fail(chalk.red(`Initialization failed: ${error.message}`));
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Show database statistics')
  .action(async () => {
    try {
      const rag = new RAGSystem();
      const stats = rag.getStats();
      
      console.log(chalk.blue('RAG Database Statistics:'));
      console.log(chalk.gray(`Total patterns: ${stats.totalPatterns}`));
      console.log(chalk.gray('\nBy type:'));
      Object.entries(stats.byType).forEach(([type, count]) => {
        console.log(chalk.gray(`  ${type}: ${count}`));
      });
      console.log(chalk.gray('\nBy section:'));
      Object.entries(stats.bySection).forEach(([section, count]) => {
        console.log(chalk.gray(`  ${section}: ${count}`));
      });
      console.log(chalk.gray('\nBy style:'));
      Object.entries(stats.byStyle).forEach(([style, count]) => {
        console.log(chalk.gray(`  ${style}: ${count}`));
      });
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Search command
program
  .command('search <query>')
  .description('Search for patterns')
  .option('-t, --type <type>', 'Pattern type (drums, bass, chords, lead, atmosphere)')
  .option('-s, --section <section>', 'Section type (intro, verse, chorus, etc.)')
  .option('--tempo <tempo>', 'Tempo in BPM', parseInt)
  .option('-k, --key <key>', 'Musical key')
  .option('-n, --num <num>', 'Number of results', parseInt, 5)
  .action(async (query, options) => {
    const spinner = ora('Searching...').start();
    
    try {
      const rag = new RAGSystem();
      await rag.initialize();
      
      const results = await rag.search(query, {
        type: options.type,
        section: options.section,
        tempo: options.tempo,
        key: options.key,
        topK: options.num
      });
      
      spinner.succeed(chalk.green(`Found ${results.length} patterns`));
      
      results.forEach((result, i) => {
        console.log(chalk.blue(`\n--- Pattern ${i + 1} ---`));
        console.log(chalk.gray(`Description: ${result.description}`));
        console.log(chalk.gray(`Similarity: ${(result.similarity * 100).toFixed(1)}%`));
        console.log(chalk.yellow('Code:'));
        console.log(result.code);
      });
    } catch (error) {
      spinner.fail(chalk.red(`Search failed: ${error.message}`));
      process.exit(1);
    }
  });

// Add command
program
  .command('add <file>')
  .description('Add a pattern to the database')
  .option('-t, --type <type>', 'Pattern type', 'unknown')
  .option('-s, --section <section>', 'Section type')
  .option('--tempo <tempo>', 'Tempo in BPM', parseInt)
  .option('-k, --key <key>', 'Musical key')
  .option('--style <style>', 'Musical style')
  .option('-n, --name <name>', 'Pattern name')
  .action(async (file, options) => {
    const spinner = ora('Adding pattern...').start();
    
    try {
      const rag = new RAGSystem();
      await rag.initialize();
      
      const code = readFileSync(file, 'utf-8');
      
      const metadata = {
        type: options.type,
        section: options.section,
        tempo: options.tempo,
        key: options.key,
        style: options.style,
        name: options.name || file
      };
      
      const id = await rag.addPattern(code, metadata);
      
      spinner.succeed(chalk.green(`Pattern added with ID: ${id}`));
    } catch (error) {
      spinner.fail(chalk.red(`Failed to add pattern: ${error.message}`));
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate <file>')
  .description('Validate a Strudel pattern')
  .option('--fix', 'Attempt to auto-fix issues')
  .action(async (file, options) => {
    try {
      const rag = new RAGSystem();
      const code = readFileSync(file, 'utf-8');
      
      const validation = rag.validatePattern(code);
      
      if (validation.valid) {
        console.log(chalk.green('✓ Pattern is valid'));
      } else {
        console.log(chalk.red('✗ Pattern has errors:'));
        validation.errors.forEach(err => console.log(chalk.red(`  - ${err}`)));
      }
      
      if (validation.warnings.length > 0) {
        console.log(chalk.yellow('\nWarnings:'));
        validation.warnings.forEach(warn => console.log(chalk.yellow(`  - ${warn}`)));
      }
      
      if (!validation.valid && options.fix) {
        console.log(chalk.blue('\nAttempting auto-fix...'));
        const fixed = rag.autoFixPattern(code);
        console.log(chalk.gray('\nFixed pattern:'));
        console.log(fixed);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Clear command
program
  .command('clear')
  .description('Clear the RAG database')
  .option('--confirm', 'Confirm clearing the database')
  .action(async (options) => {
    if (!options.confirm) {
      console.log(chalk.yellow('Use --confirm flag to clear the database'));
      return;
    }
    
    const spinner = ora('Clearing database...').start();
    
    try {
      const rag = new RAGSystem();
      rag.database.clear();
      spinner.succeed(chalk.green('Database cleared'));
    } catch (error) {
      spinner.fail(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program.parse();