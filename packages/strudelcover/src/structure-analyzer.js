import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import chalk from 'chalk';

const execAsync = promisify(exec);

/**
 * Analyzes song structure using advanced audio analysis
 */
export class SongStructureAnalyzer {
  constructor() {
    this.tempDir = tmpdir();
  }

  /**
   * Analyze song structure using aubio
   */
  async analyzeStructure(audioPath, duration) {
    console.log(chalk.gray('Analyzing song structure...'));
    
    try {
      // Get tempo using aubio
      const tempo = await this.detectTempo(audioPath);
      
      // Get beat positions
      const beats = await this.detectBeats(audioPath);
      
      // Analyze sections based on spectral changes
      const sections = await this.detectSections(audioPath, duration, tempo, beats);
      
      // Determine song form
      const songForm = this.determineSongForm(sections);
      
      return {
        tempo,
        beats,
        sections,
        songForm,
        duration,
        key: null // Could add key detection later
      };
    } catch (error) {
      console.log(chalk.yellow('Using simplified structure analysis'));
      return this.getFallbackStructure(duration);
    }
  }

  /**
   * Detect tempo using aubio
   */
  async detectTempo(audioPath) {
    try {
      const { stdout } = await execAsync(`aubiotempo "${audioPath}" 2>/dev/null | tail -1`);
      const tempo = parseFloat(stdout.trim()) || 120;
      return Math.round(tempo);
    } catch {
      return 120; // Default tempo
    }
  }

  /**
   * Detect beat positions
   */
  async detectBeats(audioPath) {
    try {
      const { stdout } = await execAsync(`aubioonset -i "${audioPath}" 2>/dev/null`);
      const beats = stdout.trim().split('\n')
        .map(line => parseFloat(line))
        .filter(beat => !isNaN(beat));
      return beats;
    } catch {
      return [];
    }
  }

  /**
   * Detect song sections based on spectral analysis
   */
  async detectSections(audioPath, duration, tempo, beats) {
    const sections = [];
    const beatsPerBar = 4;
    const barsPerSection = 8; // Default section length
    const secondsPerBar = (60 / tempo) * beatsPerBar;
    
    // Common song structure timings (in bars)
    const typicalStructure = [
      { type: 'intro', bars: 4 },
      { type: 'verse', bars: 16 },
      { type: 'chorus', bars: 8 },
      { type: 'verse', bars: 16 },
      { type: 'chorus', bars: 8 },
      { type: 'bridge', bars: 8 },
      { type: 'chorus', bars: 8 },
      { type: 'outro', bars: 4 }
    ];
    
    let currentTime = 0;
    
    for (const section of typicalStructure) {
      if (currentTime >= duration) break;
      
      const sectionDuration = section.bars * secondsPerBar;
      const endTime = Math.min(currentTime + sectionDuration, duration);
      
      sections.push({
        type: section.type,
        startTime: currentTime,
        endTime: endTime,
        bars: section.bars,
        energy: this.estimateEnergy(section.type),
        characteristics: this.getSectionCharacteristics(section.type)
      });
      
      currentTime = endTime;
    }
    
    return sections;
  }

  /**
   * Estimate energy level for section type
   */
  estimateEnergy(sectionType) {
    const energyMap = {
      intro: 0.3,
      verse: 0.5,
      chorus: 0.8,
      bridge: 0.6,
      outro: 0.3,
      drop: 0.9,
      buildup: 0.7
    };
    return energyMap[sectionType] || 0.5;
  }

  /**
   * Get characteristics for section type
   */
  getSectionCharacteristics(sectionType) {
    const characteristics = {
      intro: { brightness: 0.3, percussiveness: 0.2, fullness: 0.3 },
      verse: { brightness: 0.5, percussiveness: 0.6, fullness: 0.5 },
      chorus: { brightness: 0.8, percussiveness: 0.8, fullness: 0.9 },
      bridge: { brightness: 0.6, percussiveness: 0.4, fullness: 0.6 },
      outro: { brightness: 0.3, percussiveness: 0.2, fullness: 0.3 }
    };
    return characteristics[sectionType] || { brightness: 0.5, percussiveness: 0.5, fullness: 0.5 };
  }

  /**
   * Determine overall song form
   */
  determineSongForm(sections) {
    const sectionTypes = sections.map(s => s.type);
    
    // Check for common patterns
    if (sectionTypes.includes('verse') && sectionTypes.includes('chorus')) {
      if (sectionTypes.includes('bridge')) {
        return 'Verse-Chorus-Bridge';
      }
      return 'Verse-Chorus';
    }
    
    return 'Custom Structure';
  }

  /**
   * Fallback structure when aubio is not available
   */
  getFallbackStructure(duration) {
    const tempo = 120;
    const barsPerSection = 8;
    const secondsPerBar = 2; // 120 BPM, 4/4 time
    const totalBars = Math.floor(duration / secondsPerBar);
    
    const sections = [];
    let currentBar = 0;
    
    // Simple structure
    const structure = [
      { type: 'intro', ratio: 0.1 },
      { type: 'verse', ratio: 0.3 },
      { type: 'chorus', ratio: 0.2 },
      { type: 'verse', ratio: 0.2 },
      { type: 'chorus', ratio: 0.15 },
      { type: 'outro', ratio: 0.05 }
    ];
    
    for (const part of structure) {
      const bars = Math.floor(totalBars * part.ratio);
      if (bars > 0) {
        sections.push({
          type: part.type,
          startTime: currentBar * secondsPerBar,
          endTime: (currentBar + bars) * secondsPerBar,
          bars,
          energy: this.estimateEnergy(part.type),
          characteristics: this.getSectionCharacteristics(part.type)
        });
        currentBar += bars;
      }
    }
    
    return {
      tempo,
      beats: [],
      sections,
      songForm: 'Verse-Chorus',
      duration
    };
  }
}