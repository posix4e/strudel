import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// Helper for aubio commands with larger buffer
const execAubio = (cmd) => {
  return execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 }); // 10MB buffer
};

export class SongStructureAnalyzer {
  constructor() {
    this.sampleRate = 44100;
    this.hopSize = 512;
    this.frameSize = 2048;
    this.tempDir = '/tmp/structure-analysis';
  }

  async analyzeStructure(audioPath, duration) {
    console.log(`Analyzing song structure for: ${audioPath}`);
    
    // Ensure temp directory exists
    await fs.mkdir(this.tempDir, { recursive: true });
    
    try {
      // Extract audio features
      const features = await this.extractAudioFeatures(audioPath, duration);
      
      // Detect section boundaries
      const boundaries = await this.detectSectionBoundaries(features);
      
      // Classify sections based on their characteristics
      const sections = await this.classifySections(features, boundaries);
      
      // Measure section lengths in bars
      const sectionsWithBars = await this.measureSectionLength(sections, features.tempo);
      
      // Detect tempo changes
      const tempoChanges = this.detectTempoChanges(features);
      
      // Detect key modulations
      const keyModulations = this.detectKeyModulations(features);
      
      // Determine overall song form
      const songForm = this.determineSongForm(sectionsWithBars);
      
      return {
        sections: sectionsWithBars,
        tempo: features.tempo,
        tempoChanges,
        keyModulations,
        songForm,
        duration,
        averageEnergy: features.averageEnergy,
        dynamicRange: features.dynamicRange
      };
    } finally {
      // Clean up temp files
      await this.cleanup();
    }
  }

  async extractAudioFeatures(audioPath, duration) {
    console.log('Extracting audio features...');
    
    const features = {
      energy: [],
      spectralCentroid: [],
      spectralRolloff: [],
      zeroCrossingRate: [],
      mfcc: [],
      onsets: [],
      tempo: 120,
      chromagram: []
    };

    // Use ffmpeg to extract raw audio data
    const wavPath = path.join(this.tempDir, 'temp.wav');
    await execAsync(`ffmpeg -i "${audioPath}" -ar ${this.sampleRate} -ac 1 "${wavPath}" -y`, { maxBuffer: 10 * 1024 * 1024 });

    // Extract energy levels using sox
    const energyData = await this.extractEnergy(wavPath, duration);
    features.energy = energyData.values;
    features.averageEnergy = energyData.average;
    features.dynamicRange = energyData.max - energyData.min;

    // Extract spectral features
    const spectralData = await this.extractSpectralFeatures(wavPath, duration);
    features.spectralCentroid = spectralData.centroid;
    features.spectralRolloff = spectralData.rolloff;
    features.zeroCrossingRate = spectralData.zcr;

    // Detect onsets
    features.onsets = await this.detectOnsets(wavPath, duration);

    // Estimate tempo
    features.tempo = await this.estimateTempo(wavPath, features.onsets);

    // Extract chromagram for key detection
    features.chromagram = await this.extractChromagram(wavPath, duration);
    
    // Extract beat positions
    features.beats = await this.extractBeats(wavPath, duration);
    
    // Detect key
    features.key = await this.detectKey(wavPath);

    return features;
  }

  async extractEnergy(wavPath, duration) {
    // Use sox to get RMS energy values
    const windowSize = 0.5; // 500ms windows
    const numWindows = Math.floor(duration / windowSize);
    const values = [];

    for (let i = 0; i < numWindows; i++) {
      const start = i * windowSize;
      const cmd = `sox "${wavPath}" -n trim ${start} ${windowSize} stat 2>&1 | grep "RMS amplitude" | awk '{print $3}'`;
      
      try {
        const { stdout } = await execAsync(cmd);
        const rms = parseFloat(stdout.trim());
        values.push(isNaN(rms) ? 0 : rms);
      } catch (error) {
        values.push(0);
      }
    }

    const validValues = values.filter(v => v > 0);
    const average = validValues.reduce((a, b) => a + b, 0) / validValues.length || 0;
    const max = Math.max(...validValues) || 0;
    const min = Math.min(...validValues) || 0;

    return { values, average, max, min };
  }

  async extractSpectralFeatures(wavPath, duration) {
    // Use aubio to extract real spectral features
    const windowSize = 0.5;
    const numWindows = Math.floor(duration / windowSize);
    
    const centroid = [];
    const rolloff = [];
    const zcr = [];
    
    // Use aubio mfcc for spectral features
    const { stdout: mfccOutput } = await execAubio(`aubio mfcc -i "${wavPath}"`);
    const mfccLines = mfccOutput.trim().split('\n');
    
    // Process MFCC coefficients to derive spectral features
    for (let i = 0; i < numWindows; i++) {
      const windowStart = i * windowSize;
      const windowEnd = (i + 1) * windowSize;
      
      // Find MFCC values in this window
      const windowMFCCs = mfccLines
        .map(line => {
          const parts = line.split(/\s+/);
          const time = parseFloat(parts[0]);
          if (time >= windowStart && time < windowEnd && parts.length > 1) {
            return parts.slice(1).map(parseFloat);
          }
          return null;
        })
        .filter(v => v !== null);
      
      if (windowMFCCs.length > 0) {
        // Use first few MFCCs to estimate spectral characteristics
        const avgMFCC0 = windowMFCCs.reduce((sum, mfcc) => sum + mfcc[0], 0) / windowMFCCs.length;
        const avgMFCC1 = windowMFCCs.reduce((sum, mfcc) => sum + (mfcc[1] || 0), 0) / windowMFCCs.length;
        const avgMFCC2 = windowMFCCs.reduce((sum, mfcc) => sum + (mfcc[2] || 0), 0) / windowMFCCs.length;
        
        // Map MFCC to spectral features (approximation)
        centroid.push(2000 + avgMFCC1 * 100); // MFCC1 correlates with spectral shape
        rolloff.push(8000 + avgMFCC0 * 200);  // MFCC0 correlates with energy
        zcr.push(0.1 + Math.abs(avgMFCC2) * 0.01); // Higher MFCCs relate to texture
      } else {
        throw new Error(`No MFCC data for window ${i}`);
      }
    }

    return { centroid, rolloff, zcr };
  }

  async detectOnsets(wavPath, duration) {
    // Use aubio for real onset detection
    const { stdout } = await execAubio(`aubio onset -i "${wavPath}" -m complex`);
    const onsets = stdout.trim().split('\n')
      .map(line => parseFloat(line))
      .filter(time => !isNaN(time) && time <= duration);
    
    console.log(`Detected ${onsets.length} onsets`);
    return onsets;
  }

  async estimateTempo(wavPath, onsets) {
    // Use aubio for accurate tempo detection
    const { stdout } = await execAubio(`aubio tempo -i "${wavPath}"`);
    const tempoLines = stdout.trim().split('\n');
    
    // aubio tempo outputs a single BPM value
    const tempo = parseFloat(stdout.trim());
    
    if (isNaN(tempo) || tempo < 60 || tempo > 200) {
      throw new Error(`Invalid tempo detected: ${stdout.trim()}`);
    }
    
    console.log(`Detected tempo: ${Math.round(tempo)} BPM`);
    return Math.round(tempo);
  }

  async extractChromagram(wavPath, duration) {
    // Use aubio for pitch detection to build chromagram
    const { stdout } = await execAubio(`aubio pitch -i "${wavPath}" -m yinfft`);
    const pitches = stdout.trim().split('\n')
      .map(line => {
        const [time, pitch] = line.split('\t').map(parseFloat);
        return { time, pitch };
      })
      .filter(p => !isNaN(p.time) && !isNaN(p.pitch) && p.pitch > 0);
    
    // Convert pitches to chromagram
    const windowSize = 1.0;
    const numWindows = Math.floor(duration / windowSize);
    const chromagram = [];
    
    for (let w = 0; w < numWindows; w++) {
      const windowStart = w * windowSize;
      const windowEnd = (w + 1) * windowSize;
      const windowPitches = pitches.filter(p => p.time >= windowStart && p.time < windowEnd);
      
      // 12 chroma bins
      const chroma = new Array(12).fill(0);
      
      windowPitches.forEach(p => {
        // Convert frequency to pitch class (0-11)
        const midiNote = Math.round(12 * Math.log2(p.pitch / 440) + 69);
        const pitchClass = midiNote % 12;
        if (pitchClass >= 0 && pitchClass < 12) {
          chroma[pitchClass]++;
        }
      });
      
      // Normalize
      const sum = chroma.reduce((a, b) => a + b, 0);
      if (sum > 0) {
        chromagram.push(chroma.map(c => c / sum));
      } else {
        chromagram.push(new Array(12).fill(1/12));
      }
    }
    
    return chromagram;
  }

  async detectSectionBoundaries(features) {
    console.log('Detecting section boundaries...');
    
    let boundaries = [0]; // Always start at 0
    const threshold = 0.3; // Threshold for detecting changes
    
    // Analyze energy changes
    const energyChanges = this.detectChanges(features.energy);
    
    // Analyze spectral changes
    const spectralChanges = this.detectChanges(features.spectralCentroid);
    
    // Combine different change indicators
    for (let i = 1; i < features.energy.length - 1; i++) {
      const energyChange = energyChanges[i];
      const spectralChange = spectralChanges[i];
      
      // Detect significant changes
      if (energyChange > threshold || spectralChange > threshold) {
        // Convert window index to time
        const time = i * 0.5; // 500ms windows
        
        // Avoid boundaries too close together (min 4 seconds apart)
        if (boundaries.length === 0 || time - boundaries[boundaries.length - 1] >= 4) {
          boundaries.push(time);
        }
      }
    }
    
    // Add end boundary
    const totalDuration = features.energy.length * 0.5;
    boundaries.push(totalDuration);
    
    // If we have too few boundaries, add some at regular intervals
    if (boundaries.length < 5) {
      const targetSections = 8; // Aim for ~8 sections
      const sectionDuration = totalDuration / targetSections;
      
      boundaries = [0];
      for (let i = 1; i < targetSections; i++) {
        boundaries.push(i * sectionDuration);
      }
      boundaries.push(totalDuration);
    }
    
    return boundaries;
  }

  detectChanges(values) {
    const changes = [0];
    
    for (let i = 1; i < values.length; i++) {
      const diff = Math.abs(values[i] - values[i - 1]);
      const avgLocal = (values[i] + values[i - 1]) / 2;
      const normalizedChange = avgLocal > 0 ? diff / avgLocal : 0;
      changes.push(normalizedChange);
    }
    
    return changes;
  }

  async classifySections(features, boundaries) {
    console.log('Classifying sections...');
    
    const sections = [];
    const sectionTypes = ['intro', 'verse', 'chorus', 'bridge', 'outro', 'break'];
    
    for (let i = 0; i < boundaries.length - 1; i++) {
      const startTime = boundaries[i];
      const endTime = boundaries[i + 1];
      const startIdx = Math.floor(startTime * 2); // 500ms windows
      const endIdx = Math.floor(endTime * 2);
      
      // Calculate section characteristics
      const sectionFeatures = {
        energy: this.calculateSectionAverage(features.energy, startIdx, endIdx),
        spectralCentroid: this.calculateSectionAverage(features.spectralCentroid, startIdx, endIdx),
        spectralRolloff: this.calculateSectionAverage(features.spectralRolloff, startIdx, endIdx),
        zcr: this.calculateSectionAverage(features.zeroCrossingRate, startIdx, endIdx),
        duration: endTime - startTime
      };
      
      // Classify based on characteristics
      const type = this.classifySection(sectionFeatures, i, boundaries.length - 1);
      
      sections.push({
        type,
        startTime,
        endTime,
        energy: sectionFeatures.energy,
        characteristics: {
          brightness: sectionFeatures.spectralCentroid / 5000, // Normalize
          fullness: sectionFeatures.spectralRolloff / 10000,
          percussiveness: sectionFeatures.zcr,
          duration: sectionFeatures.duration
        }
      });
    }
    
    return sections;
  }

  calculateSectionAverage(values, startIdx, endIdx) {
    const sectionValues = values.slice(startIdx, endIdx);
    if (sectionValues.length === 0) return 0;
    return sectionValues.reduce((a, b) => a + b, 0) / sectionValues.length;
  }

  classifySection(features, index, totalSections) {
    // First section is likely intro
    if (index === 0) {
      return 'intro';
    }
    
    // Last section might be outro
    if (index === totalSections - 2) {
      return 'outro';
    }
    
    // Use more nuanced classification based on multiple features
    const energyLevel = features.energy;
    const brightness = features.spectralCentroid / 5000; // Normalize
    
    // Very high energy + bright = chorus or drop
    if (energyLevel > 0.8 && brightness > 0.7) {
      return index % 3 === 0 ? 'drop' : 'chorus';
    }
    
    // High energy sections are often choruses
    if (energyLevel > 0.6) {
      return 'chorus';
    }
    
    // Medium energy with high brightness might be pre-chorus or build
    if (energyLevel > 0.4 && brightness > 0.6) {
      return index % 2 === 0 ? 'prechorus' : 'build';
    }
    
    // Lower energy sections are verses
    if (energyLevel > 0.3) {
      return 'verse';
    }
    
    // Very low energy = break or bridge
    if (energyLevel < 0.3) {
      return features.duration < 8 ? 'break' : 'bridge';
    }
    
    // Default based on position
    return index % 2 === 0 ? 'verse' : 'chorus';
  }

  async measureSectionLength(sections, tempo) {
    console.log('Measuring section lengths in bars...');
    
    const beatsPerBar = 4; // Assuming 4/4 time
    const secondsPerBeat = 60 / tempo;
    const secondsPerBar = secondsPerBeat * beatsPerBar;
    
    return sections.map(section => {
      const durationSeconds = section.endTime - section.startTime;
      const bars = Math.round(durationSeconds / secondsPerBar);
      
      return {
        ...section,
        bars: Math.max(1, bars), // At least 1 bar
        measures: Math.max(1, bars) // Same as bars in 4/4 time
      };
    });
  }

  detectTempoChanges(features) {
    // Simplified tempo change detection
    const changes = [];
    const baseTempo = features.tempo;
    
    // Look for significant onset pattern changes
    // In a real implementation, this would analyze onset intervals more thoroughly
    
    return changes;
  }

  detectKeyModulations(features) {
    // Simplified key modulation detection
    const modulations = [];
    
    // Analyze chromagram for key changes
    // In a real implementation, this would use proper key detection algorithms
    
    return modulations;
  }

  determineSongForm(sections) {
    // Map section types to letters
    const typeMap = {
      'intro': 'I',
      'verse': 'A',
      'chorus': 'B',
      'bridge': 'C',
      'outro': 'O',
      'break': 'X'
    };
    
    // Create form string
    const form = sections
      .map(s => typeMap[s.type] || 'A')
      .join('');
    
    // Detect common patterns
    if (form.includes('ABAB')) {
      return 'Verse-Chorus (ABAB)';
    } else if (form.includes('AABA')) {
      return '32-bar form (AABA)';
    } else if (form.includes('ABABCB')) {
      return 'Pop song form (ABABCB)';
    } else if (form.includes('AAA')) {
      return 'Strophic form (AAA)';
    }
    
    return `Custom form: ${form}`;
  }

  async extractBeats(wavPath, duration) {
    // Use aubio to detect beat positions
    const { stdout } = await execAubio(`aubio beat -i "${wavPath}"`);
    const beats = stdout.trim().split('\n')
      .map(line => parseFloat(line))
      .filter(time => !isNaN(time) && time <= duration);
    
    console.log(`Detected ${beats.length} beats`);
    return beats;
  }
  
  async detectKey(wavPath) {
    // Use aubio notes to estimate key
    const { stdout } = await execAubio(`aubio notes -i "${wavPath}"`);
    const notes = stdout.trim().split('\n')
      .map(line => {
        const parts = line.split('\t');
        if (parts.length >= 3) {
          const pitch = parseFloat(parts[1]);
          const velocity = parseFloat(parts[2]);
          if (pitch > 0) {
            const midiNote = Math.round(12 * Math.log2(pitch / 440) + 69);
            return { midiNote, velocity };
          }
        }
        return null;
      })
      .filter(n => n !== null);
    
    if (notes.length === 0) {
      throw new Error('No notes detected for key analysis');
    }
    
    // Count pitch classes weighted by velocity
    const pitchClassCounts = new Array(12).fill(0);
    notes.forEach(note => {
      const pitchClass = note.midiNote % 12;
      pitchClassCounts[pitchClass] += note.velocity;
    });
    
    // Find most prominent pitch class
    let maxCount = 0;
    let rootPitchClass = 0;
    pitchClassCounts.forEach((count, pc) => {
      if (count > maxCount) {
        maxCount = count;
        rootPitchClass = pc;
      }
    });
    
    // Map to key names
    const keyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const key = keyNames[rootPitchClass];
    console.log(`Detected key: ${key}`);
    return key;
  }

  async cleanup() {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp files:', error.message);
    }
  }
}