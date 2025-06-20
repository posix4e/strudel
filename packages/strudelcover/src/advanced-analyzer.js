// Dynamic import for Essentia.js to handle module loading
import { analyze as beatDetect } from 'web-audio-beat-detector';
import { AudioAnalyzer } from './analyzer.js';
import { readFileSync } from 'fs';
import { decode } from 'node-wav';
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import chalk from 'chalk';

/**
 * Advanced audio analyzer using Essentia.js for aubio-like features
 */
export class AdvancedAudioAnalyzer extends AudioAnalyzer {
  constructor() {
    super();
    this.essentia = null;
    this.initialized = false;
  }

  /**
   * Initialize Essentia.js
   */
  async initialize() {
    if (!this.initialized) {
      console.log(chalk.yellow('⚠️  Essentia.js initialization skipped - requires browser environment'));
      // Essentia will be loaded in browser context where WASM is available
      this.initialized = false;
    }
  }

  /**
   * Advanced onset detection using Essentia
   */
  detectOnsets(audioData, sampleRate) {
    if (!this.essentia) return [];
    const onsetDetector = this.essentia.OnsetDetection(
      audioData.length,
      2048, // frameSize
      1024, // hopSize
      'complex' // method: 'hfc', 'complex', 'phase', 'specdiff', 'kl', 'mkl'
    );

    const onsets = [];
    const frameSize = 2048;
    const hopSize = 1024;

    for (let i = 0; i < audioData.length - frameSize; i += hopSize) {
      const frame = audioData.slice(i, i + frameSize);
      const onset = onsetDetector.compute(frame);
      
      if (onset.onset > 0.3) { // threshold
        onsets.push({
          time: i / sampleRate,
          strength: onset.onset
        });
      }
    }

    return onsets;
  }

  /**
   * Advanced pitch tracking using Essentia
   */
  trackPitch(audioData, sampleRate) {
    const pitchDetector = this.essentia.PitchYinFFT(
      2048, // frameSize
      sampleRate
    );

    const pitches = [];
    const frameSize = 2048;
    const hopSize = 512;

    for (let i = 0; i < audioData.length - frameSize; i += hopSize) {
      const frame = audioData.slice(i, i + frameSize);
      const result = pitchDetector.compute(frame);
      
      if (result.pitchConfidence > 0.7) {
        pitches.push({
          time: i / sampleRate,
          pitch: result.pitch,
          confidence: result.pitchConfidence
        });
      }
    }

    return pitches;
  }

  /**
   * Beat tracking using Essentia
   */
  trackBeats(audioData, sampleRate) {
    const beatTracker = this.essentia.BeatTrackerMultiFeature(sampleRate);
    const beats = beatTracker.compute(audioData);
    
    return {
      beats: beats.ticks,
      confidence: beats.confidence,
      bpm: beats.bpm,
      bpmEstimates: beats.bpmEstimates
    };
  }

  /**
   * Extract harmonic and percussive components
   */
  separateHarmonicPercussive(audioData) {
    const hpss = this.essentia.HPSS();
    const result = hpss.compute(audioData);
    
    return {
      harmonic: result.harmonic,
      percussive: result.percussive
    };
  }

  /**
   * Detect musical key with more accuracy
   */
  detectKeyAdvanced(audioData, sampleRate) {
    const keyDetector = this.essentia.KeyExtractor();
    const result = keyDetector.compute(audioData);
    
    return {
      key: result.key,
      scale: result.scale,
      strength: result.strength,
      alternative: {
        key: result.alternativeKey,
        scale: result.alternativeScale
      }
    };
  }

  /**
   * Analyze song structure with section detection
   */
  async analyzeSongStructure(audioData, sampleRate, duration) {
    // Compute various features over time
    const frameSize = 4096;
    const hopSize = 2048;
    const features = [];

    // Extract features for each frame
    for (let i = 0; i < audioData.length - frameSize; i += hopSize) {
      const frame = audioData.slice(i, i + frameSize);
      
      // Spectral features
      const spectrum = this.essentia.Spectrum(frameSize).compute(frame);
      const spectralCentroid = this.essentia.SpectralCentroid(sampleRate).compute(spectrum.spectrum);
      const spectralRolloff = this.essentia.RollOff(sampleRate).compute(spectrum.spectrum);
      const spectralFlux = this.essentia.Flux().compute(spectrum.spectrum);
      
      // MFCC for timbre
      const mfcc = this.essentia.MFCC(13, sampleRate).compute(spectrum.spectrum);
      
      // Energy
      const energy = this.essentia.Energy().compute(frame);
      
      features.push({
        time: i / sampleRate,
        energy: energy.energy,
        spectralCentroid: spectralCentroid.centroid,
        spectralRolloff: spectralRolloff.rolloff,
        spectralFlux: spectralFlux.flux,
        mfcc: mfcc.mfcc
      });
    }

    // Detect sections based on feature changes
    const sections = this.detectSections(features, duration);
    
    // Analyze repetitions
    const repetitions = this.findRepetitions(features);
    
    // Track energy levels
    const energyProfile = this.analyzeEnergyProfile(features);

    return {
      sections,
      repetitions,
      energyProfile,
      features
    };
  }

  /**
   * Detect song sections based on feature changes
   */
  detectSections(features, duration) {
    const sections = [];
    const windowSize = 10; // seconds
    const stepSize = 1; // second
    
    // Calculate feature statistics for windows
    const windows = [];
    for (let t = 0; t < duration - windowSize; t += stepSize) {
      const windowFeatures = features.filter(f => 
        f.time >= t && f.time < t + windowSize
      );
      
      if (windowFeatures.length > 0) {
        windows.push({
          time: t,
          avgEnergy: this.average(windowFeatures.map(f => f.energy)),
          avgCentroid: this.average(windowFeatures.map(f => f.spectralCentroid)),
          avgFlux: this.average(windowFeatures.map(f => f.spectralFlux))
        });
      }
    }

    // Detect significant changes
    let currentSection = { type: 'intro', startTime: 0 };
    sections.push(currentSection);

    for (let i = 1; i < windows.length; i++) {
      const prev = windows[i - 1];
      const curr = windows[i];
      
      const energyChange = Math.abs(curr.avgEnergy - prev.avgEnergy) / prev.avgEnergy;
      const centroidChange = Math.abs(curr.avgCentroid - prev.avgCentroid) / prev.avgCentroid;
      
      // Significant change detected
      if (energyChange > 0.3 || centroidChange > 0.3) {
        // Determine section type based on features
        let sectionType = 'verse';
        if (curr.avgEnergy > 0.7) sectionType = 'chorus';
        else if (curr.avgEnergy < 0.3) sectionType = 'breakdown';
        else if (curr.avgEnergy > prev.avgEnergy * 1.2) sectionType = 'buildup';
        
        currentSection.endTime = curr.time;
        currentSection = {
          type: sectionType,
          startTime: curr.time
        };
        sections.push(currentSection);
      }
    }

    // Close last section
    if (sections.length > 0) {
      sections[sections.length - 1].endTime = duration;
    }

    return sections;
  }

  /**
   * Find repetitive patterns in the song
   */
  findRepetitions(features) {
    const repetitions = [];
    const segmentLength = 4; // seconds
    const similarity_threshold = 0.85;

    // Create segments
    const segments = [];
    for (let i = 0; i < features.length; i += Math.floor(segmentLength * 44100 / 2048)) {
      const segment = features.slice(i, i + Math.floor(segmentLength * 44100 / 2048));
      if (segment.length > 0) {
        segments.push({
          index: segments.length,
          startTime: segment[0].time,
          features: this.averageFeatures(segment)
        });
      }
    }

    // Compare segments
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const similarity = this.compareSegments(segments[i].features, segments[j].features);
        if (similarity > similarity_threshold) {
          repetitions.push({
            segment1: { index: i, time: segments[i].startTime },
            segment2: { index: j, time: segments[j].startTime },
            similarity
          });
        }
      }
    }

    return repetitions;
  }

  /**
   * Analyze energy profile throughout the song
   */
  analyzeEnergyProfile(features) {
    const profile = features.map(f => ({
      time: f.time,
      energy: f.energy,
      intensity: this.categorizeEnergy(f.energy)
    }));

    // Smooth the energy curve
    const smoothed = this.smoothCurve(profile.map(p => p.energy));
    profile.forEach((p, i) => {
      p.smoothedEnergy = smoothed[i];
    });

    return profile;
  }

  /**
   * Helper functions
   */
  average(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  averageFeatures(segment) {
    return {
      energy: this.average(segment.map(s => s.energy)),
      spectralCentroid: this.average(segment.map(s => s.spectralCentroid)),
      spectralRolloff: this.average(segment.map(s => s.spectralRolloff)),
      mfcc: segment[0].mfcc.map((_, i) => 
        this.average(segment.map(s => s.mfcc[i]))
      )
    };
  }

  compareSegments(features1, features2) {
    // Simple similarity based on feature differences
    const energyDiff = Math.abs(features1.energy - features2.energy);
    const centroidDiff = Math.abs(features1.spectralCentroid - features2.spectralCentroid);
    
    // MFCC similarity (cosine similarity)
    let mfccSim = 0;
    const mag1 = Math.sqrt(features1.mfcc.reduce((sum, m) => sum + m * m, 0));
    const mag2 = Math.sqrt(features2.mfcc.reduce((sum, m) => sum + m * m, 0));
    
    if (mag1 > 0 && mag2 > 0) {
      const dotProduct = features1.mfcc.reduce((sum, m, i) => sum + m * features2.mfcc[i], 0);
      mfccSim = dotProduct / (mag1 * mag2);
    }

    return (1 - energyDiff) * 0.3 + (1 - centroidDiff / 1000) * 0.3 + mfccSim * 0.4;
  }

  categorizeEnergy(energy) {
    if (energy < 0.2) return 'low';
    if (energy < 0.5) return 'medium';
    if (energy < 0.8) return 'high';
    return 'peak';
  }

  smoothCurve(data, windowSize = 5) {
    const smoothed = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(data.length, i + Math.floor(windowSize / 2) + 1);
      const window = data.slice(start, end);
      smoothed.push(this.average(window));
    }
    return smoothed;
  }

  /**
   * Enhanced tempo detection using web-audio-beat-detector
   */
  async detectTempoAdvanced(audioPath) {
    try {
      // Convert to AudioBuffer format for web-audio-beat-detector
      const { audioData, sampleRate } = this.loadWavFile(audioPath);
      
      // Create offline context
      const audioContext = {
        sampleRate,
        length: audioData.length
      };
      
      const audioBuffer = {
        sampleRate,
        length: audioData.length,
        duration: audioData.length / sampleRate,
        numberOfChannels: 1,
        getChannelData: () => new Float32Array(audioData)
      };

      // Detect tempo
      const { bpm, offset } = await beatDetect(audioBuffer);
      
      return {
        bpm: Math.round(bpm),
        offset,
        confidence: 0.9 // web-audio-beat-detector is quite accurate
      };
    } catch (error) {
      console.warn('Advanced tempo detection failed, falling back:', error);
      // Fall back to basic tempo detection
      const { audioData, sampleRate } = this.loadWavFile(audioPath);
      return {
        bpm: await this.detectTempo(audioData, sampleRate),
        offset: 0,
        confidence: 0.7
      };
    }
  }

  /**
   * Main enhanced analysis function
   */
  async analyzeAdvanced(audioPath) {
    await this.initialize();

    // Basic analysis from parent class
    const basicAnalysis = await this.analyze(audioPath);
    
    // If Essentia isn't available, return enhanced basic analysis
    if (!this.essentia) {
      return {
        ...basicAnalysis,
        onsets: [],
        pitches: [],
        beats: { beats: [], confidence: 0, bpm: basicAnalysis.tempo },
        structure: {
          sections: [],
          repetitions: [],
          energyProfile: []
        }
      };
    }

    // Convert to WAV if needed
    const wavPath = audioPath.endsWith('.wav') ? audioPath : 
      await this.convertToWav(audioPath);
    
    // Load audio
    const { audioData, sampleRate, duration } = this.loadWavFile(wavPath);

    console.log(chalk.cyan('🎵 Performing advanced audio analysis...'));

    // Advanced tempo detection
    const tempoAnalysis = await this.detectTempoAdvanced(wavPath);
    
    // Onset detection
    const onsets = this.detectOnsets(audioData, sampleRate);
    
    // Pitch tracking
    const pitches = this.trackPitch(audioData, sampleRate);
    
    // Beat tracking
    const beats = this.trackBeats(audioData, sampleRate);
    
    // Harmonic/Percussive separation
    const separation = this.separateHarmonicPercussive(audioData);
    
    // Advanced key detection
    const keyAnalysis = this.detectKeyAdvanced(audioData, sampleRate);
    
    // Song structure analysis
    const structure = await this.analyzeSongStructure(audioData, sampleRate, duration);

    const advancedAnalysis = {
      ...basicAnalysis,
      tempo: tempoAnalysis.bpm,
      tempoConfidence: tempoAnalysis.confidence,
      key: keyAnalysis.key,
      scale: keyAnalysis.scale,
      keyStrength: keyAnalysis.strength,
      onsets,
      pitches,
      beats,
      harmonicPercussiveSeparation: {
        available: true,
        harmonicEnergy: this.calculateEnergy(separation.harmonic),
        percussiveEnergy: this.calculateEnergy(separation.percussive)
      },
      structure
    };

    console.log(chalk.green('✅ Advanced analysis complete'));
    console.log(chalk.gray(`  - Detected ${onsets.length} onsets`));
    console.log(chalk.gray(`  - Tracked ${pitches.length} pitched segments`));
    console.log(chalk.gray(`  - Found ${beats.beats.length} beats`));
    console.log(chalk.gray(`  - Identified ${structure.sections.length} sections`));

    return advancedAnalysis;
  }

  calculateEnergy(audioData) {
    return Math.sqrt(audioData.reduce((sum, x) => sum + x * x, 0) / audioData.length);
  }
}