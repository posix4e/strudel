import Meyda from 'meyda';
import { decode } from 'node-wav';
import { readFileSync } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

/**
 * Audio analysis module using Meyda
 */
export class AudioAnalyzer {
  constructor() {
    this.sampleRate = 44100;
    this.bufferSize = 2048;
  }

  /**
   * Convert any audio file to WAV for analysis
   */
  async convertToWav(inputPath, outputPath = '/tmp/strudelcover-temp.wav') {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('wav')
        .audioCodec('pcm_s16le')
        .audioFrequency(this.sampleRate)
        .audioChannels(1) // Mono for simpler analysis
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .save(outputPath);
    });
  }

  /**
   * Load WAV file and extract audio buffer
   */
  loadWavFile(filePath) {
    const buffer = readFileSync(filePath);
    const result = decode(buffer);
    
    // Convert to mono if stereo
    let audioData = result.channelData[0];
    if (result.channelData.length > 1) {
      // Average channels for mono
      audioData = result.channelData[0].map((sample, i) => 
        (sample + result.channelData[1][i]) / 2
      );
    }
    
    return {
      audioData,
      sampleRate: result.sampleRate,
      duration: audioData.length / result.sampleRate
    };
  }

  /**
   * Extract audio features using Meyda
   */
  extractFeatures(audioData) {
    const features = [];
    const hopSize = this.bufferSize / 2;
    
    // Process audio in chunks
    for (let i = 0; i < audioData.length - this.bufferSize; i += hopSize) {
      const buffer = audioData.slice(i, i + this.bufferSize);
      
      const frameFeatures = Meyda.extract([
        'rms',
        'energy',
        'zcr',
        'spectralCentroid',
        'spectralRolloff',
        'mfcc',
        'chroma'
      ], buffer);
      
      features.push({
        time: i / this.sampleRate,
        ...frameFeatures
      });
    }
    
    return features;
  }

  /**
   * Detect tempo using onset detection
   */
  async detectTempo(audioData, sampleRate) {
    // Simple onset detection using energy changes
    const hopSize = 512;
    const windowSize = 2048;
    const onsets = [];
    
    let prevEnergy = 0;
    for (let i = 0; i < audioData.length - windowSize; i += hopSize) {
      const buffer = audioData.slice(i, i + windowSize);
      const energy = buffer.reduce((sum, x) => sum + x * x, 0);
      
      // Detect energy spike
      if (energy > prevEnergy * 1.5 && energy > 0.01) {
        onsets.push(i / sampleRate);
      }
      prevEnergy = energy;
    }
    
    // Calculate tempo from onset intervals
    if (onsets.length < 2) return 120; // Default tempo
    
    const intervals = [];
    for (let i = 1; i < onsets.length; i++) {
      intervals.push(onsets[i] - onsets[i-1]);
    }
    
    // Find most common interval (simplified)
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];
    const bpm = 60 / medianInterval;
    
    // Normalize to reasonable range
    if (bpm < 60) return bpm * 2;
    if (bpm > 200) return bpm / 2;
    return Math.round(bpm);
  }

  /**
   * Detect key using chroma features
   */
  detectKey(features) {
    // Average chroma features across time
    const avgChroma = new Array(12).fill(0);
    features.forEach(frame => {
      if (frame.chroma) {
        frame.chroma.forEach((value, i) => {
          avgChroma[i] += value;
        });
      }
    });
    
    // Normalize
    const sum = avgChroma.reduce((a, b) => a + b, 0);
    avgChroma.forEach((v, i) => avgChroma[i] = v / sum);
    
    // Simple key detection - find strongest chroma
    const maxChroma = Math.max(...avgChroma);
    const keyIndex = avgChroma.indexOf(maxChroma);
    
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return keys[keyIndex];
  }

  /**
   * Analyze rhythm patterns
   */
  analyzeRhythm(features, tempo) {
    const beatDuration = 60 / tempo;
    const rhythmPattern = {
      kick: [],
      snare: [],
      hihat: []
    };
    
    // Analyze energy in different frequency bands
    features.forEach((frame, i) => {
      const time = frame.time;
      const beatPosition = (time % (beatDuration * 4)) / beatDuration;
      
      // Low frequency = kick
      if (frame.energy > 0.5 && frame.spectralCentroid < 200) {
        rhythmPattern.kick.push(Math.round(beatPosition * 16) / 16);
      }
      
      // Mid frequency with high ZCR = snare
      if (frame.energy > 0.3 && frame.zcr > 0.1 && 
          frame.spectralCentroid > 200 && frame.spectralCentroid < 800) {
        rhythmPattern.snare.push(Math.round(beatPosition * 16) / 16);
      }
      
      // High frequency = hihat
      if (frame.zcr > 0.2 && frame.spectralCentroid > 800) {
        rhythmPattern.hihat.push(Math.round(beatPosition * 16) / 16);
      }
    });
    
    // Remove duplicates and sort
    Object.keys(rhythmPattern).forEach(key => {
      rhythmPattern[key] = [...new Set(rhythmPattern[key])].sort((a, b) => a - b);
    });
    
    return rhythmPattern;
  }

  /**
   * Main analysis function
   */
  async analyze(audioPath) {
    // Convert to WAV if needed
    const wavPath = audioPath.endsWith('.wav') ? audioPath : 
      await this.convertToWav(audioPath);
    
    // Load audio
    const { audioData, sampleRate, duration } = this.loadWavFile(wavPath);
    
    // Extract features
    const features = this.extractFeatures(audioData);
    
    // Analyze
    const tempo = await this.detectTempo(audioData, sampleRate);
    const key = this.detectKey(features);
    const rhythm = this.analyzeRhythm(features, tempo);
    
    // Calculate average features
    const avgFeatures = {
      rms: features.reduce((sum, f) => sum + (f.rms || 0), 0) / features.length,
      energy: features.reduce((sum, f) => sum + (f.energy || 0), 0) / features.length,
      spectralCentroid: features.reduce((sum, f) => sum + (f.spectralCentroid || 0), 0) / features.length,
      zcr: features.reduce((sum, f) => sum + (f.zcr || 0), 0) / features.length
    };
    
    return {
      duration,
      tempo,
      key,
      rhythm,
      features: avgFeatures,
      timeSeries: features
    };
  }

  /**
   * Compare two audio analyses
   */
  compareAnalyses(analysis1, analysis2) {
    const comparison = {
      tempoDiff: Math.abs(analysis1.tempo - analysis2.tempo),
      keyMatch: analysis1.key === analysis2.key,
      
      // Feature differences (normalized 0-1)
      rmsDiff: Math.abs(analysis1.features.rms - analysis2.features.rms),
      energyDiff: Math.abs(analysis1.features.energy - analysis2.features.energy),
      brightnessDiff: Math.abs(
        analysis1.features.spectralCentroid - analysis2.features.spectralCentroid
      ) / 10000, // Normalize
      
      // Rhythm similarity (Jaccard index)
      kickSimilarity: this.rhythmSimilarity(
        analysis1.rhythm.kick, 
        analysis2.rhythm.kick
      ),
      snareSimilarity: this.rhythmSimilarity(
        analysis1.rhythm.snare, 
        analysis2.rhythm.snare
      ),
      
      // Overall score (0-100)
      score: 0
    };
    
    // Calculate overall similarity score
    comparison.score = Math.round(
      (100 - comparison.tempoDiff) * 0.3 +
      (comparison.keyMatch ? 20 : 0) +
      (1 - comparison.rmsDiff) * 100 * 0.1 +
      (1 - comparison.energyDiff) * 100 * 0.1 +
      (1 - comparison.brightnessDiff) * 100 * 0.1 +
      comparison.kickSimilarity * 100 * 0.15 +
      comparison.snareSimilarity * 100 * 0.15
    );
    
    return comparison;
  }

  /**
   * Calculate rhythm similarity using Jaccard index
   */
  rhythmSimilarity(pattern1, pattern2) {
    const set1 = new Set(pattern1);
    const set2 = new Set(pattern2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
}