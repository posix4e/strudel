/**
 * Complex pattern generator for full-length songs
 */
import { keyToMidi, getScaleMidiNumbers } from './note-converter.js';
import { DRUM_PATTERNS, selectDrumPattern, generateDrumStack } from './drum-patterns.js';
import { detectSongStructure, calculateSectionTimings, generateSectionVariations } from './song-structure.js';
import { patternAudioAnalyzer } from './pattern-audio-analyzer.js';
import chalk from 'chalk';

export class ComplexPatternGenerator {
  constructor() {
    this.sectionPatterns = {};
    // Analyze pattern characteristics on startup
    patternAudioAnalyzer.analyzePatternCharacteristics();
  }

  /**
   * Generate a complex, full-length song pattern
   */
  generateComplexPattern(analysis, artistName, songName) {
    const { tempo, key, duration, features } = analysis;
    const scale = getScaleMidiNumbers(key, 3);
    const structure = detectSongStructure(tempo, duration, features.energy);
    const sections = calculateSectionTimings(structure, tempo);
    
    // Generate patterns for each unique section type
    const uniqueSectionTypes = [...new Set(sections.map(s => s.type))];
    
    uniqueSectionTypes.forEach(sectionType => {
      this.sectionPatterns[sectionType] = this.generateSectionPattern(
        sectionType,
        tempo,
        scale,
        features,
        analysis.rhythm
      );
    });
    
    // Build the full song pattern
    return this.buildFullSongPattern(sections, tempo, scale, artistName, songName);
  }

  /**
   * Generate pattern for a specific section type
   */
  generateSectionPattern(sectionType, tempo, scale, features, rhythm) {
    const variations = generateSectionVariations(null, sectionType, features.energy);
    
    // Use pattern audio analyzer to find matching patterns
    const targetAnalysis = {
      tempo,
      key: scale.key,
      features: {
        energy: features.energy || 0.5,
        spectralCentroid: features.spectralCentroid || features.brightness || 500
      }
    };
    
    // Get suggestions for this section
    const sectionSuggestions = patternAudioAnalyzer.suggestPatternsForSections(
      targetAnalysis,
      { [sectionType]: { startTime: 0, duration: 30 } }
    );
    
    const suggestions = sectionSuggestions[sectionType] || [];
    if (suggestions.length > 0) {
      console.log(chalk.cyan(`\nUsing pattern suggestions for ${sectionType}:`));
      suggestions.slice(0, 3).forEach((s, i) => {
        console.log(chalk.gray(`  ${i + 1}. ${s.pattern.name} (${s.pattern.tempo} BPM, ${s.pattern.style})`));
      });
    }
    
    // Select appropriate drum pattern based on section
    let drumPattern = selectDrumPattern(tempo, features.energy);
    
    // Modify drum pattern based on section type
    const sectionDrumPatterns = {
      intro: {
        kick: drumPattern.kick ? `${drumPattern.kick}.gain(0.3)` : '',
        hihat: drumPattern.hihat ? `${drumPattern.hihat}.gain(0.2)` : '',
        perc: 's("perc:3*2").gain(0.1).room(0.7)'
      },
      verse: {
        ...drumPattern,
        gain: 0.6
      },
      chorus: {
        ...drumPattern,
        kick: drumPattern.kick || 's("bd*4")',
        snare: drumPattern.snare || 's("~ cp ~ cp")',
        crash: 's("cr ~ ~ ~").gain(0.4)',
        gain: 0.8
      },
      drop: {
        kick: 's("bd*4").gain(0.9)',
        snare: 's("~ cp ~ cp").gain(0.8)',
        hihat: 's("hh*32").gain(0.3).speed(2)',
        sub: `n("${scale.root - 24}").s("sine").gain(0.5).lpf(100)`
      },
      breakdown: {
        kick: 's("bd ~ ~ ~").gain(0.4)',
        hihat: 's("hh*4").gain(0.2).room(0.8)',
        ambient: `n("${scale.root}").s("sine").gain(0.1).room(0.95)`
      },
      bridge: {
        kick: 's("bd ~ bd ~").gain(0.5)',
        snare: 's("~ ~ cp ~").gain(0.4)',
        perc: 's("perc:4*8").gain(0.3).pan(sine.range(-0.8,0.8))'
      },
      buildup: {
        kick: 's("bd*2 bd*4 bd*8 bd*16").slow(4).gain(0.7)',
        snare: 's("~ cp*2 ~ cp*4").slow(4).gain(0.6)',
        riser: `n("${scale.root} ${scale.root + 12}").slow(8).s("sawtooth").gain(0.3).lpf(saw.range(200,8000))`
      },
      outro: {
        kick: drumPattern.kick ? `${drumPattern.kick}.gain(saw.range(0.4,0))` : '',
        ambient: `n("${scale.root} ${scale.third} ${scale.fifth}").s("sine").gain(saw.range(0.2,0)).room(0.9)`
      }
    };
    
    const sectionDrums = sectionDrumPatterns[sectionType] || sectionDrumPatterns.verse;
    
    // Generate melodic elements based on section
    const melodicPatterns = this.generateMelodicPatterns(sectionType, scale, features);
    
    return {
      drums: sectionDrums,
      bass: melodicPatterns.bass,
      chords: melodicPatterns.chords,
      lead: melodicPatterns.lead,
      atmosphere: melodicPatterns.atmosphere
    };
  }

  /**
   * Generate melodic patterns for a section
   */
  generateMelodicPatterns(sectionType, scale, features) {
    const patterns = {
      intro: {
        bass: '',
        chords: `n("${scale.root} ${scale.fifth}").s("sine").gain(0.1).room(0.8).slow(4)`,
        lead: '',
        atmosphere: `n("${scale.root + 24}").s("triangle").gain(0.05).delay(0.8).room(0.9)`
      },
      verse: {
        bass: `n("${scale.root - 24} ~ ${scale.root - 12} ~").s("sawtooth").gain(0.4).lpf(600)`,
        chords: `n("<${scale.root} ${scale.third} ${scale.fifth}>").s("square").gain(0.2).room(0.4)`,
        lead: `n("~ ${scale.root + 12} ~ ${scale.fifth + 12}").s("triangle").gain(0.25).delay(0.3)`,
        atmosphere: `n("${scale.root}").s("sine").gain(0.1).room(0.7).slow(2)`
      },
      chorus: {
        bass: `n("${scale.root - 24} ${scale.root - 24} ${scale.fifth - 24} ${scale.root - 12}").s("sawtooth").gain(0.5).lpf(800)`,
        chords: `n("<[${scale.root},${scale.third},${scale.fifth}] [${scale.root + 7},${scale.third + 7},${scale.fifth + 7}]>").s("square").gain(0.3).room(0.5)`,
        lead: `n("${scale.root + 12} ${scale.third + 12} ${scale.fifth + 12} ${scale.octave + 12}").s("sawtooth").gain(0.4).delay(0.25).room(0.3)`,
        atmosphere: `n("[${scale.root + 24},${scale.fifth + 24}]").s("sine").gain(0.15).room(0.6)`
      },
      drop: {
        bass: `n("${scale.root - 24}*8").s("sawtooth").gain(0.6).lpf(400).shape(0.5)`,
        chords: `n("<[${scale.root},${scale.third},${scale.fifth}]*2>").s("square").gain(0.4).room(0.3).shape(0.3)`,
        lead: `n("${scale.root + 24} ~ ${scale.fifth + 24} ~ ${scale.octave + 24} ~ ${scale.fifth + 24} ~").s("saw").gain(0.5).delay(0.125)`,
        atmosphere: ''
      },
      breakdown: {
        bass: `n("${scale.root - 12} ~ ~ ~").s("sine").gain(0.3).lpf(300)`,
        chords: `n("${scale.root} ${scale.third} ${scale.fifth}").s("triangle").gain(0.15).room(0.8).slow(2)`,
        lead: '',
        atmosphere: `n("${scale.root + 36}").s("sine").gain(0.1).room(0.95).delay(0.5)`
      },
      bridge: {
        bass: `n("${scale.fifth - 24} ~ ${scale.fourth - 24} ~ ${scale.third - 24} ~ ${scale.root - 24} ~").slow(2).s("sawtooth").gain(0.4).lpf(700)`,
        chords: `n("<${scale.fifth} ${scale.fourth} ${scale.third}>").s("square").gain(0.25).room(0.6)`,
        lead: `n("${scale.fifth + 12} ${scale.fourth + 12} ${scale.third + 12} ${scale.root + 12}").s("triangle").gain(0.3).delay(0.4)`,
        atmosphere: `n("[${scale.root},${scale.fifth}]").s("sine").gain(0.2).room(0.7).pan(sine.range(-0.5,0.5))`
      },
      buildup: {
        bass: `n("${scale.root - 24}*[1,2,4,8]").slow(4).s("sawtooth").gain(0.5).lpf(saw.range(200,2000))`,
        chords: `n("<${scale.root} ${scale.third} ${scale.fifth} ${scale.octave}>").fast(saw.range(1,4)).s("square").gain(0.3)`,
        lead: `n("${scale.root + 12}").fast(saw.range(1,8)).s("triangle").gain(0.4).delay(0.25)`,
        atmosphere: `n("${scale.root + 24}").s("noise").gain(saw.range(0,0.3)).lpf(saw.range(1000,8000))`
      },
      outro: {
        bass: `n("${scale.root - 24}").s("sine").gain(saw.range(0.3,0)).slow(4)`,
        chords: `n("[${scale.root},${scale.third},${scale.fifth}]").s("triangle").gain(saw.range(0.2,0)).room(0.9)`,
        lead: '',
        atmosphere: `n("${scale.root + 12}").s("sine").gain(saw.range(0.1,0)).room(0.95).delay(0.8)`
      }
    };
    
    return patterns[sectionType] || patterns.verse;
  }

  /**
   * Build the full song pattern with all sections
   */
  buildFullSongPattern(sections, tempo, scale, artistName, songName) {
    // Calculate total bars
    const totalBars = sections.reduce((sum, section) => sum + section.bars, 0);
    
    // Create section sequence
    const sectionSequence = sections.map(section => {
      const pattern = this.sectionPatterns[section.type];
      return `
// ${section.type.toUpperCase()} (${section.bars} bars)
const ${section.type}${sections.filter(s => s.type === section.type).indexOf(section) + 1} = stack(
  ${this.formatSectionPattern(pattern)}
)`;
    }).join('\n\n');
    
    // Create the arrangement
    const arrangement = sections.map((section, index) => {
      const sectionIndex = sections.slice(0, index).filter(s => s.type === section.type).length + 1;
      return `  ${section.type}${sectionIndex}`;
    }).join(',\n');
    
    // Build the complete pattern
    return `// "${songName}" by ${artistName} - Full Cover
// Tempo: ${tempo} BPM, Key: ${scale.root === keyToMidi('g#') ? 'G#' : 'Unknown'}
// Structure: ${sections.map(s => s.type).join(' -> ')}
// Total length: ${totalBars} bars

setcps(${tempo}/60/4)

${sectionSequence}

// FULL ARRANGEMENT
$: cat([
${arrangement}
])
.room(0.2)
.gain(0.8)`;
  }

  /**
   * Format a section pattern for output
   */
  formatSectionPattern(pattern) {
    const parts = [];
    
    // Always include all layers, even if empty (use silence for missing parts)
    // This ensures all sections have the same number of layers
    
    // Drums - always 5 layers
    parts.push('  // Drums');
    parts.push(`  ${pattern.drums?.kick || 's("~").gain(0)'}`);
    parts.push(`  ${pattern.drums?.snare || 's("~").gain(0)'}`);
    parts.push(`  ${pattern.drums?.hihat || 's("~").gain(0)'}`);
    parts.push(`  ${pattern.drums?.crash || 's("~").gain(0)'}`);
    parts.push(`  ${pattern.drums?.perc || 's("~").gain(0)'}`);
    
    // Bass - always 1 layer
    parts.push('  // Bass');
    parts.push(`  ${pattern.bass || 'n("~").gain(0)'}`);
    
    // Chords - always 1 layer
    parts.push('  // Chords');
    parts.push(`  ${pattern.chords || 'n("~").gain(0)'}`);
    
    // Lead - always 1 layer
    parts.push('  // Lead');
    parts.push(`  ${pattern.lead || 'n("~").gain(0)'}`);
    
    // Atmosphere - always 1 layer
    parts.push('  // Atmosphere');
    parts.push(`  ${pattern.atmosphere || 'n("~").gain(0)'}`);
    
    // Sub bass (from drop sections) - always 1 layer
    parts.push('  // Sub');
    parts.push(`  ${pattern.drums?.sub || 'n("~").gain(0)'}`);
    
    return parts.join(',\n');
  }
}