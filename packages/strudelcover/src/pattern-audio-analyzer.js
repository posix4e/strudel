import chalk from 'chalk';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Analyzes audio characteristics of patterns in the RAG database
 * and provides intelligent pattern selection based on sonic similarity
 */
export class PatternAudioAnalyzer {
  constructor() {
    this.metadata = null;
    this.patterns = null;
    this.audioStats = new Map();
    this.loadDatabase();
  }

  /**
   * Load the RAG database
   */
  loadDatabase() {
    try {
      const metadataPath = join(__dirname, '../rag-db/metadata.json');
      const patternsPath = join(__dirname, '../rag-db/patterns.json');
      
      this.metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
      this.patterns = JSON.parse(readFileSync(patternsPath, 'utf-8'));
      
      console.log(chalk.cyan(`📊 Loaded ${this.metadata.length} patterns from RAG database`));
    } catch (error) {
      console.error(chalk.red('Failed to load RAG database:'), error);
    }
  }

  /**
   * Extract detailed audio statistics from pattern code
   */
  extractPatternAudioStats(pattern, metadata) {
    const stats = {
      id: metadata.id,
      name: metadata.name,
      tempo: metadata.tempo || 120,
      
      // Rhythm analysis
      rhythmDensity: 0,
      rhythmComplexity: 0,
      
      // Energy metrics
      percussiveEnergy: 0,
      melodicEnergy: 0,
      bassEnergy: 0,
      overallEnergy: 0,
      
      // Effects
      effects: [],
      
      // Dynamic range
      dynamicRange: 0
    };
    
    const code = pattern.code;
    
    // Rhythm density from note patterns
    const noteMatches = code.match(/["'][^"']+["']/g) || [];
    const noteCount = noteMatches.reduce((sum, match) => {
      const notes = match.replace(/["']/g, '').split(/\s+/).filter(n => n && n !== '~');
      return sum + notes.length;
    }, 0);
    stats.rhythmDensity = Math.min(noteCount / 10, 1);
    
    // Rhythm complexity from subdivisions
    if (code.includes('/')) stats.rhythmComplexity += 0.2;
    if (code.includes('*')) stats.rhythmComplexity += 0.2;
    if (code.includes(',')) stats.rhythmComplexity += 0.2;
    if (code.includes('[') && code.includes(']')) stats.rhythmComplexity += 0.2;
    if (code.includes('<') && code.includes('>')) stats.rhythmComplexity += 0.2;
    
    // Percussive energy
    const drumHits = ['bd', 'kick', 'sd', 'snare', 'hh', 'hihat', 'cp', 'clap'];
    drumHits.forEach(drum => {
      if (code.includes(drum)) stats.percussiveEnergy += 0.125;
    });
    stats.percussiveEnergy = Math.min(stats.percussiveEnergy, 1);
    
    // Melodic energy
    if (code.match(/\.note\s*\(/)) stats.melodicEnergy += 0.3;
    if (code.match(/\.scale\s*\(/)) stats.melodicEnergy += 0.2;
    if (code.includes('.delay(')) stats.melodicEnergy += 0.1;
    if (metadata.type === 'lead') stats.melodicEnergy += 0.4;
    stats.melodicEnergy = Math.min(stats.melodicEnergy, 1);
    
    // Bass energy
    if (code.includes('bass')) stats.bassEnergy += 0.3;
    if (code.includes('sub')) stats.bassEnergy += 0.2;
    if (code.match(/\.lpf\s*\(/)) stats.bassEnergy += 0.1;
    if (metadata.type === 'bass') stats.bassEnergy += 0.4;
    stats.bassEnergy = Math.min(stats.bassEnergy, 1);
    
    // Effects detection
    const effectPatterns = [
      { pattern: /\.reverb\s*\(/, name: 'reverb' },
      { pattern: /\.room\s*\(/, name: 'room' },
      { pattern: /\.delay\s*\(/, name: 'delay' },
      { pattern: /\.lpf\s*\(/, name: 'lowpass' },
      { pattern: /\.hpf\s*\(/, name: 'highpass' },
      { pattern: /\.distort\s*\(/, name: 'distortion' }
    ];
    
    effectPatterns.forEach(({ pattern, name }) => {
      if (pattern.test(code)) stats.effects.push(name);
    });
    
    // Dynamic range
    if (code.match(/\.gain\s*\(/)) stats.dynamicRange += 0.5;
    if (code.match(/\.velocity\s*\(/)) stats.dynamicRange += 0.5;
    stats.dynamicRange = Math.min(stats.dynamicRange, 1);
    
    // Calculate overall energy
    const tempoFactor = Math.min(stats.tempo / 140, 1);
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
   * Analyze audio characteristics from pattern metadata
   */
  analyzePatternCharacteristics() {
    console.log(chalk.yellow('\n🎵 Analyzing pattern audio characteristics...'));
    
    // Extract detailed audio stats for each pattern
    this.patterns.forEach((pattern, idx) => {
      const metadata = this.metadata[idx];
      if (!metadata || !pattern) return;
      
      const audioStats = this.extractPatternAudioStats(pattern, metadata);
      this.audioStats.set(metadata.id, audioStats);
    });
    
    // Analyze distribution of characteristics
    const stats = {
      tempo: { min: Infinity, max: -Infinity, values: [], distribution: {} },
      complexity: { simple: 0, medium: 0, complex: 0 },
      style: {},
      instruments: {},
      tags: {},
      energy: new Map() // Estimated energy based on tempo and tags
    };

    this.metadata.forEach(pattern => {
      // Tempo analysis
      if (pattern.tempo) {
        stats.tempo.values.push(pattern.tempo);
        stats.tempo.min = Math.min(stats.tempo.min, pattern.tempo);
        stats.tempo.max = Math.max(stats.tempo.max, pattern.tempo);
        
        // Tempo ranges
        const tempoRange = this.getTempoRange(pattern.tempo);
        stats.tempo.distribution[tempoRange] = (stats.tempo.distribution[tempoRange] || 0) + 1;
      }

      // Complexity
      if (pattern.complexity) {
        stats.complexity[pattern.complexity]++;
      }

      // Style
      if (pattern.style) {
        stats.style[pattern.style] = (stats.style[pattern.style] || 0) + 1;
      }

      // Instruments
      pattern.instruments?.forEach(instrument => {
        stats.instruments[instrument] = (stats.instruments[instrument] || 0) + 1;
      });

      // Tags
      pattern.tags?.forEach(tag => {
        stats.tags[tag] = (stats.tags[tag] || 0) + 1;
      });

      // Estimate energy level
      const energy = this.estimatePatternEnergy(pattern);
      stats.energy.set(pattern.id, energy);
      this.audioStats.set(pattern.id, { ...pattern, estimatedEnergy: energy });
    });

    // Calculate tempo statistics
    if (stats.tempo.values.length > 0) {
      stats.tempo.average = stats.tempo.values.reduce((a, b) => a + b, 0) / stats.tempo.values.length;
      stats.tempo.median = this.median(stats.tempo.values);
    }

    this.stats = stats;
    this.displayStats();
    return stats;
  }

  /**
   * Display analyzed statistics
   */
  displayStats() {
    console.log(chalk.green('\n📈 Pattern Database Statistics:'));
    
    // Tempo distribution
    console.log(chalk.cyan('\nTempo Distribution:'));
    Object.entries(this.stats.tempo.distribution).forEach(([range, count]) => {
      const percentage = (count / this.metadata.length * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(count / 2));
      console.log(`  ${range.padEnd(15)} ${bar} ${count} (${percentage}%)`);
    });

    // Complexity distribution
    console.log(chalk.yellow('\nComplexity Distribution:'));
    Object.entries(this.stats.complexity).forEach(([level, count]) => {
      const percentage = (count / this.metadata.length * 100).toFixed(1);
      const bar = '▓'.repeat(Math.floor(count / 2));
      console.log(`  ${level.padEnd(10)} ${bar} ${count} (${percentage}%)`);
    });

    // Top instruments
    console.log(chalk.magenta('\nTop Instruments:'));
    const topInstruments = Object.entries(this.stats.instruments)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    topInstruments.forEach(([instrument, count]) => {
      const percentage = (count / this.metadata.length * 100).toFixed(1);
      console.log(`  ${instrument.padEnd(15)} ${count} patterns (${percentage}%)`);
    });

    // Popular tags
    console.log(chalk.blue('\nPopular Tags:'));
    const topTags = Object.entries(this.stats.tags)
      .filter(([tag]) => !tag.includes(tag)) // Filter out pattern names
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    topTags.forEach(([tag, count]) => {
      console.log(`  ${tag.padEnd(12)} ${count} patterns`);
    });
  }

  /**
   * Get tempo range category
   */
  getTempoRange(tempo) {
    if (tempo < 60) return 'Very Slow';
    if (tempo < 90) return 'Slow';
    if (tempo < 120) return 'Moderate';
    if (tempo < 140) return 'Upbeat';
    if (tempo < 180) return 'Fast';
    return 'Very Fast';
  }

  /**
   * Estimate pattern energy based on metadata
   */
  estimatePatternEnergy(pattern) {
    let energy = 0.5; // Base energy

    // Tempo contributes to energy
    if (pattern.tempo) {
      energy += (pattern.tempo - 120) / 200; // Normalize around 120 BPM
    }

    // Certain tags indicate higher energy
    const highEnergyTags = ['drums', 'kick', 'bass', 'lead'];
    const lowEnergyTags = ['atmosphere', 'ambient', 'pad'];
    
    pattern.tags?.forEach(tag => {
      if (highEnergyTags.includes(tag)) energy += 0.1;
      if (lowEnergyTags.includes(tag)) energy -= 0.1;
    });

    // Complexity affects energy
    if (pattern.complexity === 'complex') energy += 0.1;
    if (pattern.complexity === 'simple') energy -= 0.1;

    // Certain instruments are more energetic
    const energeticInstruments = ['synth-saw', 'fm-synth'];
    const mellowInstruments = ['piano', 'synth-sine'];
    
    pattern.instruments?.forEach(instrument => {
      if (energeticInstruments.includes(instrument)) energy += 0.1;
      if (mellowInstruments.includes(instrument)) energy -= 0.1;
    });

    return Math.max(0, Math.min(1, energy)); // Clamp between 0 and 1
  }

  /**
   * Find patterns that match target audio characteristics
   */
  findMatchingPatterns(targetAnalysis, options = {}) {
    const {
      tempoTolerance = 10,
      energyTolerance = 0.2,
      preferredTags = [],
      avoidTags = [],
      preferredInstruments = [],
      complexity = null,
      limit = 10
    } = options;

    console.log(chalk.cyan('\n🔍 Finding matching patterns...'));

    const matches = this.metadata.map(pattern => {
      let score = 0;
      const reasons = [];

      // Tempo matching
      if (pattern.tempo && targetAnalysis.tempo) {
        const tempoDiff = Math.abs(pattern.tempo - targetAnalysis.tempo);
        if (tempoDiff <= tempoTolerance) {
          score += (1 - tempoDiff / tempoTolerance) * 30;
          reasons.push(`Tempo match (${pattern.tempo} BPM)`);
        }
      }

      // Energy matching - use detailed audio stats if available
      const audioStats = this.audioStats.get(pattern.id);
      const patternEnergy = audioStats?.overallEnergy || this.estimatePatternEnergy(pattern);
      const targetEnergy = targetAnalysis.features?.energy || 0.5;
      const energyDiff = Math.abs(patternEnergy - targetEnergy);
      if (energyDiff <= energyTolerance) {
        score += (1 - energyDiff / energyTolerance) * 25;
        reasons.push(`Energy match (${(patternEnergy * 100).toFixed(0)}%)`);
      }
      
      // Bonus for matching audio characteristics
      if (audioStats && targetAnalysis.features) {
        // Percussive energy match for drum-heavy sections
        if (preferredTags.includes('drums') && audioStats.percussiveEnergy > 0.5) {
          score += 10;
          reasons.push(`High percussive energy (${(audioStats.percussiveEnergy * 100).toFixed(0)}%)`);
        }
        
        // Melodic energy match for lead sections
        if (preferredTags.includes('lead') && audioStats.melodicEnergy > 0.5) {
          score += 10;
          reasons.push(`High melodic energy (${(audioStats.melodicEnergy * 100).toFixed(0)}%)`);
        }
        
        // Bass energy match for bass sections
        if (preferredTags.includes('bass') && audioStats.bassEnergy > 0.5) {
          score += 10;
          reasons.push(`High bass energy (${(audioStats.bassEnergy * 100).toFixed(0)}%)`);
        }
      }

      // Key matching
      if (pattern.key && targetAnalysis.key) {
        const keyMatch = this.compareKeys(pattern.key, targetAnalysis.key);
        if (keyMatch > 0) {
          score += keyMatch * 20;
          reasons.push(`Key compatibility (${pattern.key})`);
        }
      }

      // Tag preferences
      pattern.tags?.forEach(tag => {
        if (preferredTags.includes(tag)) {
          score += 5;
          reasons.push(`Has tag: ${tag}`);
        }
        if (avoidTags.includes(tag)) {
          score -= 10;
        }
      });

      // Instrument preferences
      pattern.instruments?.forEach(instrument => {
        if (preferredInstruments.includes(instrument)) {
          score += 5;
          reasons.push(`Uses ${instrument}`);
        }
      });

      // Complexity matching
      if (complexity && pattern.complexity === complexity) {
        score += 10;
        reasons.push(`${complexity} complexity`);
      }

      // Style bonus for matching genres
      if (targetAnalysis.genre && pattern.style === targetAnalysis.genre) {
        score += 15;
        reasons.push(`${pattern.style} style`);
      }

      return {
        pattern,
        score,
        reasons,
        energy: patternEnergy
      };
    });

    // Sort by score and return top matches
    const topMatches = matches
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log(chalk.green(`\n✅ Found ${topMatches.length} matching patterns:`));
    topMatches.forEach((match, i) => {
      console.log(chalk.yellow(`\n${i + 1}. ${match.pattern.name} (Score: ${match.score.toFixed(1)})`));
      console.log(chalk.gray(`   ${match.reasons.join(', ')}`));
    });

    return topMatches;
  }

  /**
   * Compare musical keys for compatibility
   */
  compareKeys(key1, key2) {
    if (!key1 || !key2) return 0;
    
    // Extract root note and mode
    const parseKey = (key) => {
      const match = key.match(/([a-g]#?)(\d*):?(major|minor|lydian)?/i);
      if (!match) return null;
      return {
        root: match[1].toLowerCase(),
        octave: match[2] || '',
        mode: match[3] || 'major'
      };
    };

    const k1 = parseKey(key1);
    const k2 = parseKey(key2);
    
    if (!k1 || !k2) return 0;

    // Same key = perfect match
    if (k1.root === k2.root && k1.mode === k2.mode) return 1;
    
    // Relative major/minor
    const relativeKeys = {
      'c': 'a', 'd': 'b', 'e': 'c#', 'f': 'd', 'g': 'e', 'a': 'f#', 'b': 'g#'
    };
    
    if (k1.mode !== k2.mode) {
      const isRelative = (k1.mode === 'major' && relativeKeys[k1.root] === k2.root) ||
                        (k2.mode === 'major' && relativeKeys[k2.root] === k1.root);
      if (isRelative) return 0.8;
    }

    // Compatible keys (circle of fifths)
    const fifths = ['c', 'g', 'd', 'a', 'e', 'b', 'f#', 'c#', 'g#', 'd#', 'a#', 'f'];
    const idx1 = fifths.indexOf(k1.root);
    const idx2 = fifths.indexOf(k2.root);
    if (idx1 >= 0 && idx2 >= 0) {
      const distance = Math.min(Math.abs(idx1 - idx2), 12 - Math.abs(idx1 - idx2));
      if (distance === 1) return 0.6; // Adjacent in circle of fifths
      if (distance === 2) return 0.4;
    }

    return 0;
  }

  /**
   * Get pattern content by ID
   */
  getPatternContent(patternId) {
    const pattern = this.patterns.find(p => p.id === patternId);
    return pattern?.code || null;
  }

  /**
   * Suggest patterns for different song sections
   */
  suggestPatternsForSections(targetAnalysis, songStructure) {
    console.log(chalk.cyan('\n🎼 Suggesting patterns for song sections...'));
    
    const suggestions = {};
    
    // Define characteristics for each section type
    const sectionCharacteristics = {
      intro: {
        preferredTags: ['atmosphere', 'ambient', 'pad'],
        avoidTags: ['drums', 'kick'],
        complexity: 'simple',
        energyTarget: 0.3
      },
      verse: {
        preferredTags: ['chords', 'bass'],
        complexity: 'medium',
        energyTarget: 0.5
      },
      chorus: {
        preferredTags: ['drums', 'lead', 'chords'],
        complexity: 'medium',
        energyTarget: 0.8
      },
      bridge: {
        preferredTags: ['atmosphere', 'lead'],
        complexity: 'complex',
        energyTarget: 0.6
      },
      outro: {
        preferredTags: ['atmosphere', 'pad'],
        avoidTags: ['drums'],
        complexity: 'simple',
        energyTarget: 0.2
      }
    };

    // Find patterns for each section
    Object.entries(sectionCharacteristics).forEach(([section, chars]) => {
      const options = {
        preferredTags: chars.preferredTags,
        avoidTags: chars.avoidTags || [],
        complexity: chars.complexity,
        energyTolerance: 0.3,
        limit: 5
      };

      // Adjust target analysis for section
      const sectionAnalysis = {
        ...targetAnalysis,
        features: {
          ...targetAnalysis.features,
          energy: chars.energyTarget
        }
      };

      const matches = this.findMatchingPatterns(sectionAnalysis, options);
      suggestions[section] = matches;
    });

    return suggestions;
  }

  /**
   * Calculate median value
   */
  median(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
}

// Export singleton instance
export const patternAudioAnalyzer = new PatternAudioAnalyzer();