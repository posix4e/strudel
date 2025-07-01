#!/usr/bin/env node

/**
 * Script to index all songs from strudel-songs-collection into RAG database
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { PatternParser } from '../src/rag/parser.js';
import { LocalEmbeddingsGenerator } from '../src/rag/embeddings-local.js';
import { VectorDatabase } from '../src/rag/database.js';
import chalk from 'chalk';

// Path to your strudel-songs-collection checkout
const SONGS_PATH = process.argv[2] || '../../../strudel-songs-collection';

const parser = new PatternParser();
const embeddings = new LocalEmbeddingsGenerator();
const db = new VectorDatabase('./rag-db'); // Use current directory

// Track stats
let totalFiles = 0;
let totalPatterns = 0;
let errors = 0;

/**
 * Recursively find all .js files in directory
 */
function findJsFiles(dir, files = []) {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const path = join(dir, item);
    const stat = statSync(path);
    
    if (stat.isDirectory() && !item.startsWith('.')) {
      findJsFiles(path, files);
    } else if (item.endsWith('.js')) {
      files.push(path);
    }
  }
  
  return files;
}

/**
 * Extract metadata from filename and content
 */
function extractMetadata(filepath, content) {
  const filename = basename(filepath);
  const dirName = basename(join(filepath, '..'));
  
  // Try to extract tempo from content
  let tempo = 120;
  const tempoMatch = content.match(/setcps\s*\(\s*(\d+)\s*\/\s*60/) || 
                    content.match(/cpm\s*\(\s*(\d+)\s*\)/) ||
                    content.match(/\.cpm\s*\(\s*(\d+)\s*\)/);
  if (tempoMatch) {
    tempo = parseInt(tempoMatch[1]);
  }
  
  // Try to extract key from scale patterns
  let key = null;
  const scaleMatch = content.match(/scale\s*\(\s*["']([^"']+)["']\s*\)/);
  if (scaleMatch) {
    key = scaleMatch[1];
  }
  
  // Better categorization by analyzing pattern content
  let types = [];
  
  // Check for drum patterns
  if (content.match(/\b(bd|kick|bassdrum)\b/)) types.push('drums');
  if (content.match(/\b(sd|snare|sn)\b/)) types.push('drums');
  if (content.match(/\b(hh|hihat|hat|oh|ch)\b/)) types.push('drums');
  if (content.match(/\b(cp|clap)\b/)) types.push('drums');
  
  // Check for bass patterns
  if (content.match(/\bbass\b/i) || content.match(/\bsub\b/i)) types.push('bass');
  if (content.match(/\.lpf\s*\(\s*[0-9]+\s*\)/) && content.includes('note')) types.push('bass');
  
  // Check for lead/melody
  if (content.match(/\blead\b/i) || content.match(/\bmelody\b/i)) types.push('lead');
  if (content.includes('.delay(') && content.includes('note')) types.push('lead');
  
  // Check for chords
  if (content.match(/\bchord\b/i) || content.includes('<') && content.includes('@')) types.push('chords');
  
  // Check for atmosphere/pads
  if (content.match(/\bpad\b/i) || content.match(/\batmos/i)) types.push('atmosphere');
  if (content.includes('.room(') && content.includes('.slow(')) types.push('atmosphere');
  
  // If we found multiple types, it's a full pattern
  const type = types.length > 1 ? 'full' : types[0] || 'full';
  
  // Extract style from filename and content
  let style = 'general';
  const combinedText = (filename + ' ' + content).toLowerCase();
  
  if (combinedText.includes('techno')) style = 'techno';
  else if (combinedText.includes('house')) style = 'house';
  else if (combinedText.includes('trance')) style = 'trance';
  else if (combinedText.includes('ambient')) style = 'ambient';
  else if (combinedText.includes('jazz')) style = 'jazz';
  else if (combinedText.includes('rock')) style = 'rock';
  else if (combinedText.includes('waltz')) style = 'waltz';
  else if (combinedText.includes('latin') || combinedText.includes('tarantella')) style = 'latin';
  else if (combinedText.includes('stranger') || combinedText.includes('synthwave')) style = 'synthwave';
  
  // Detect instruments used
  const instruments = [];
  if (content.includes('piano')) instruments.push('piano');
  if (content.includes('sawtooth') || content.includes('saw')) instruments.push('synth-saw');
  if (content.includes('square')) instruments.push('synth-square');
  if (content.includes('sine')) instruments.push('synth-sine');
  if (content.includes('fm')) instruments.push('fm-synth');
  
  // Detect section type from content or name
  let section = 'full';
  if (filename.includes('intro') || content.includes('// intro')) section = 'intro';
  else if (filename.includes('verse') || content.includes('// verse')) section = 'verse';
  else if (filename.includes('chorus') || content.includes('// chorus')) section = 'chorus';
  else if (filename.includes('bridge') || content.includes('// bridge')) section = 'bridge';
  else if (filename.includes('outro') || content.includes('// outro')) section = 'outro';
  
  return {
    source: `strudel-songs/${filename}`,
    name: filename.replace('.js', ''),
    type,
    tempo,
    key,
    style,
    complexity: content.length > 2000 ? 'complex' : content.length > 800 ? 'medium' : 'simple',
    section,
    instruments,
    tags: [style, type, ...types, filename.replace('.js', '')]
  };
}

/**
 * Index a single file
 */
async function indexFile(filepath) {
  try {
    const content = readFileSync(filepath, 'utf-8');
    const filename = basename(filepath);
    
    // Skip if too short
    if (content.length < 50) {
      return;
    }
    
    // For strudel songs, the entire file is usually one pattern
    // Extract the pattern code
    let patternCode = content;
    
    // Remove comments and clean up
    patternCode = patternCode
      .split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n')
      .trim();
    
    if (!patternCode || patternCode.length < 10) {
      console.log(chalk.yellow(`No valid pattern found in ${filepath}`));
      return;
    }
    
    // Ensure pattern starts with $:
    if (!patternCode.startsWith('$:') && !patternCode.startsWith('$')) {
      patternCode = '$: ' + patternCode;
    }
    
    // Extract metadata
    const metadata = extractMetadata(filepath, content);
    
    // Generate embedding
    const embedding = await embeddings.generate(patternCode, metadata);
    
    // Add to database
    await db.addPattern(
      { code: patternCode, source: `strudel-songs/${filename}` },
      embedding,
      metadata
    );
    
    totalPatterns++;
    console.log(chalk.green(`✓ Indexed pattern from ${basename(filepath)}`));
    
  } catch (error) {
    console.error(chalk.red(`✗ Error indexing ${filepath}: ${error.message}`));
    errors++;
  }
}

/**
 * Main indexing function
 */
async function indexSongs() {
  console.log(chalk.blue('🎵 Strudel Songs Indexer'));
  console.log(chalk.gray(`Searching for songs in: ${SONGS_PATH}`));
  
  // Find all JS files
  const files = findJsFiles(SONGS_PATH);
  totalFiles = files.length;
  
  console.log(chalk.gray(`Found ${totalFiles} JavaScript files`));
  
  // Index each file
  for (const file of files) {
    await indexFile(file);
  }
  
  // Save database (database auto-saves on each addition)
  
  // Report stats
  console.log(chalk.blue('\n📊 Indexing Complete!'));
  console.log(chalk.green(`✓ Indexed ${totalPatterns} patterns from ${totalFiles} files`));
  if (errors > 0) {
    console.log(chalk.red(`✗ ${errors} files had errors`));
  }
  
  // Show sample queries
  console.log(chalk.blue('\n🔍 Sample RAG queries you can now use:'));
  console.log(chalk.gray('- Techno drums patterns'));
  console.log(chalk.gray('- Ambient atmosphere in C major'));
  console.log(chalk.gray('- Complex bass patterns at 140 BPM'));
}

// Run indexer
indexSongs().catch(console.error);