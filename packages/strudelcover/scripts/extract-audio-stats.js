#!/usr/bin/env node

/**
 * Script to extract detailed audio statistics from Strudel patterns
 * Analyzes pattern code to derive sonic characteristics
 */

import { readFileSync } from 'fs';
import { VectorDatabase } from '../src/rag/database.js';
import chalk from 'chalk';

// Load the database
const db = new VectorDatabase('./rag-db');

/**
 * Extract detailed audio statistics from pattern code
 */
function extractAudioStats(pattern, metadata) {
  const stats = {
    id: metadata.id,
    name: metadata.name,
    source: metadata.source,
    tempo: metadata.tempo || 120,
    key: metadata.key,
    
    // Rhythm analysis
    rhythmDensity: 0,
    rhythmComplexity: 0,
    subdivisions: [],
    
    // Harmonic analysis
    harmonicDensity: 0,
    chordProgression: [],
    
    // Timbral analysis
    instruments: metadata.instruments || [],
    effects: [],
    
    // Dynamic analysis
    dynamicRange: 0,
    velocityVariation: false,
    
    // Structural analysis
    patternLength: 0,
    repetitiveness: 0,
    
    // Energy metrics
    percussiveEnergy: 0,
    melodicEnergy: 0,
    bassEnergy: 0,
    overallEnergy: 0
  };
  
  const code = pattern.code;
  
  // Rhythm analysis
  // Count note events and timing
  const noteMatches = code.match(/["'][^"']+["']/g) || [];
  const noteCount = noteMatches.reduce((sum, match) => {
    const notes = match.replace(/["']/g, '').split(/\s+/).filter(n => n && n !== '~');
    return sum + notes.length;
  }, 0);
  
  // Check for subdivisions
  if (code.includes('/')) stats.subdivisions.push('divisions');
  if (code.includes('*')) stats.subdivisions.push('multiplications');
  if (code.includes(',')) stats.subdivisions.push('polyrhythm');
  if (code.includes('[') && code.includes(']')) stats.subdivisions.push('brackets');
  if (code.includes('<') && code.includes('>')) stats.subdivisions.push('chords');
  
  stats.rhythmDensity = Math.min(noteCount / 10, 1); // Normalize to 0-1
  stats.rhythmComplexity = stats.subdivisions.length / 5; // Normalize to 0-1
  
  // Percussive energy (drums)
  const drumHits = ['bd', 'kick', 'sd', 'snare', 'hh', 'hihat', 'cp', 'clap', 'rim', 'tom'];
  drumHits.forEach(drum => {
    if (code.includes(drum)) stats.percussiveEnergy += 0.1;
  });
  stats.percussiveEnergy = Math.min(stats.percussiveEnergy, 1);
  
  // Melodic energy (lead, melody patterns)
  if (code.match(/\.note\s*\(/)) stats.melodicEnergy += 0.3;
  if (code.match(/\.scale\s*\(/)) stats.melodicEnergy += 0.2;
  if (code.includes('.delay(')) stats.melodicEnergy += 0.1;
  if (code.includes('.echo(')) stats.melodicEnergy += 0.1;
  if (metadata.type === 'lead') stats.melodicEnergy += 0.3;
  stats.melodicEnergy = Math.min(stats.melodicEnergy, 1);
  
  // Bass energy
  if (code.includes('bass')) stats.bassEnergy += 0.3;
  if (code.includes('sub')) stats.bassEnergy += 0.2;
  if (code.match(/\.lpf\s*\(/)) stats.bassEnergy += 0.1;
  if (metadata.type === 'bass') stats.bassEnergy += 0.4;
  stats.bassEnergy = Math.min(stats.bassEnergy, 1);
  
  // Effects analysis
  const effects = [
    { pattern: /\.reverb\s*\(/, name: 'reverb' },
    { pattern: /\.room\s*\(/, name: 'room' },
    { pattern: /\.delay\s*\(/, name: 'delay' },
    { pattern: /\.echo\s*\(/, name: 'echo' },
    { pattern: /\.lpf\s*\(/, name: 'lowpass' },
    { pattern: /\.hpf\s*\(/, name: 'highpass' },
    { pattern: /\.crush\s*\(/, name: 'bitcrush' },
    { pattern: /\.distort\s*\(/, name: 'distortion' },
    { pattern: /\.shape\s*\(/, name: 'waveshape' },
    { pattern: /\.pan\s*\(/, name: 'pan' },
    { pattern: /\.phaser\s*\(/, name: 'phaser' },
    { pattern: /\.chorus\s*\(/, name: 'chorus' }
  ];
  
  effects.forEach(({ pattern, name }) => {
    if (pattern.test(code)) stats.effects.push(name);
  });
  
  // Dynamic analysis
  if (code.match(/\.gain\s*\(/)) stats.dynamicRange += 0.3;
  if (code.match(/\.velocity\s*\(/)) {
    stats.velocityVariation = true;
    stats.dynamicRange += 0.2;
  }
  if (code.includes('.accent(')) stats.dynamicRange += 0.2;
  if (code.includes('.humanize(')) stats.dynamicRange += 0.1;
  stats.dynamicRange = Math.min(stats.dynamicRange, 1);
  
  // Pattern length (cycles)
  const cycleMatch = code.match(/\.slow\s*\(\s*(\d+)\s*\)/);
  if (cycleMatch) {
    stats.patternLength = parseInt(cycleMatch[1]);
  } else {
    stats.patternLength = 1;
  }
  
  // Repetitiveness (lower is more repetitive)
  const uniqueElements = new Set(noteMatches);
  stats.repetitiveness = noteMatches.length > 0 ? uniqueElements.size / noteMatches.length : 1;
  
  // Calculate overall energy
  const tempoFactor = Math.min(stats.tempo / 140, 1); // Normalize around 140 BPM
  stats.overallEnergy = (
    stats.percussiveEnergy * 0.3 +
    stats.melodicEnergy * 0.2 +
    stats.bassEnergy * 0.2 +
    stats.rhythmDensity * 0.15 +
    tempoFactor * 0.15
  );
  
  return stats;
}

/**
 * Analyze patterns and generate report
 */
function analyzePatternsAudioStats() {
  console.log(chalk.blue('🎵 Pattern Audio Statistics Analyzer'));
  console.log(chalk.gray('Analyzing patterns in RAG database...\n'));
  
  const allStats = [];
  
  // Analyze each pattern
  db.patterns.forEach((pattern, idx) => {
    const metadata = db.metadata[idx];
    const stats = extractAudioStats(pattern, metadata);
    allStats.push(stats);
  });
  
  // Sort by overall energy
  allStats.sort((a, b) => b.overallEnergy - a.overallEnergy);
  
  // Report high-energy patterns
  console.log(chalk.yellow('🔥 High Energy Patterns (Top 10):'));
  allStats.slice(0, 10).forEach((stats, i) => {
    console.log(chalk.green(`${i + 1}. ${stats.name} (${stats.source})`));
    console.log(chalk.gray(`   Energy: ${(stats.overallEnergy * 100).toFixed(0)}% | Tempo: ${stats.tempo} BPM`));
    console.log(chalk.gray(`   Percussive: ${(stats.percussiveEnergy * 100).toFixed(0)}% | Melodic: ${(stats.melodicEnergy * 100).toFixed(0)}% | Bass: ${(stats.bassEnergy * 100).toFixed(0)}%`));
    if (stats.effects.length > 0) {
      console.log(chalk.gray(`   Effects: ${stats.effects.join(', ')}`));
    }
    console.log();
  });
  
  // Report low-energy/ambient patterns
  console.log(chalk.cyan('☁️  Ambient/Low Energy Patterns (Bottom 10):'));
  allStats.slice(-10).reverse().forEach((stats, i) => {
    console.log(chalk.blue(`${i + 1}. ${stats.name} (${stats.source})`));
    console.log(chalk.gray(`   Energy: ${(stats.overallEnergy * 100).toFixed(0)}% | Tempo: ${stats.tempo} BPM`));
    console.log(chalk.gray(`   Complexity: ${stats.rhythmComplexity > 0.5 ? 'Complex' : stats.rhythmComplexity > 0.2 ? 'Medium' : 'Simple'}`));
    console.log();
  });
  
  // Report most complex patterns
  const complexPatterns = [...allStats].sort((a, b) => b.rhythmComplexity - a.rhythmComplexity);
  console.log(chalk.magenta('🧩 Most Rhythmically Complex Patterns:'));
  complexPatterns.slice(0, 5).forEach((stats, i) => {
    console.log(chalk.magenta(`${i + 1}. ${stats.name}`));
    console.log(chalk.gray(`   Subdivisions: ${stats.subdivisions.join(', ')}`));
    console.log(chalk.gray(`   Rhythm Density: ${(stats.rhythmDensity * 100).toFixed(0)}%`));
    console.log();
  });
  
  // Effect usage statistics
  const effectUsage = {};
  allStats.forEach(stats => {
    stats.effects.forEach(effect => {
      effectUsage[effect] = (effectUsage[effect] || 0) + 1;
    });
  });
  
  console.log(chalk.yellow('🎛️  Effect Usage Statistics:'));
  Object.entries(effectUsage)
    .sort((a, b) => b[1] - a[1])
    .forEach(([effect, count]) => {
      console.log(chalk.gray(`   ${effect}: ${count} patterns (${(count / allStats.length * 100).toFixed(0)}%)`));
    });
  
  // Save detailed stats for use in generation
  console.log(chalk.green('\n✓ Analysis complete!'));
  console.log(chalk.gray('These audio statistics can now be used for intelligent pattern selection.'));
  
  return allStats;
}

// Run analyzer
analyzePatternsAudioStats();