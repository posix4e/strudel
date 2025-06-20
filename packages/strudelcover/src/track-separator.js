import { AdvancedAudioAnalyzer } from './advanced-analyzer.js';
import chalk from 'chalk';

/**
 * Track separation and layer management for multi-track generation
 */
export class TrackSeparator {
  constructor() {
    this.analyzer = new AdvancedAudioAnalyzer();
    this.tracks = {
      drums: { name: 'Drums', priority: 1, patterns: [] },
      bass: { name: 'Bass', priority: 2, patterns: [] },
      chords: { name: 'Chords/Harmony', priority: 3, patterns: [] },
      melody: { name: 'Melody/Lead', priority: 4, patterns: [] },
      atmosphere: { name: 'Atmosphere/FX', priority: 5, patterns: [] }
    };
  }

  /**
   * Analyze audio and separate into conceptual tracks
   */
  async separateTracks(audioPath) {
    console.log(chalk.cyan('🎚️ Analyzing tracks and layers...'));
    
    // Get advanced analysis
    await this.analyzer.initialize();
    const analysis = await this.analyzer.analyzeAdvanced(audioPath);
    
    // Load audio for separation
    const { audioData, sampleRate } = this.analyzer.loadWavFile(
      audioPath.endsWith('.wav') ? audioPath : await this.analyzer.convertToWav(audioPath)
    );

    // Harmonic/Percussive separation
    const separation = this.analyzer.separateHarmonicPercussive(audioData);
    
    // Analyze each component
    const tracks = await this.analyzeComponents(separation, analysis, sampleRate);
    
    return {
      tracks,
      analysis,
      separation: {
        hasPercussive: separation.percussiveEnergy > 0.1,
        hasHarmonic: separation.harmonicEnergy > 0.1
      }
    };
  }

  /**
   * Analyze separated components and create track definitions
   */
  async analyzeComponents(separation, analysis, sampleRate) {
    const tracks = {};

    // Drums track - from percussive component and rhythm analysis
    tracks.drums = this.analyzeDrumTrack(
      separation.percussive, 
      analysis.rhythm,
      analysis.onsets,
      analysis.beats,
      sampleRate
    );

    // Bass track - low frequency harmonic content
    tracks.bass = this.analyzeBassTrack(
      separation.harmonic,
      analysis.pitches,
      analysis.key,
      sampleRate
    );

    // Chords/Harmony - mid frequency harmonic content
    tracks.chords = this.analyzeChordTrack(
      separation.harmonic,
      analysis.pitches,
      analysis.key,
      analysis.structure,
      sampleRate
    );

    // Melody - high frequency pitched content
    tracks.melody = this.analyzeMelodyTrack(
      separation.harmonic,
      analysis.pitches,
      analysis.key,
      sampleRate
    );

    // Atmosphere/FX - ambient and textural elements
    tracks.atmosphere = this.analyzeAtmosphereTrack(
      analysis.features,
      analysis.structure,
      sampleRate
    );

    return tracks;
  }

  /**
   * Analyze drum track from percussive component
   */
  analyzeDrumTrack(percussiveAudio, rhythm, onsets, beats, sampleRate) {
    const track = {
      type: 'drums',
      elements: {
        kick: { pattern: [], intensity: 0 },
        snare: { pattern: [], intensity: 0 },
        hihat: { pattern: [], intensity: 0 },
        crash: { pattern: [], intensity: 0 }
      },
      complexity: 'medium',
      patterns: []
    };

    // Use onset detection to refine rhythm patterns
    const kickOnsets = onsets.filter(o => o.strength > 0.8);
    const snareOnsets = onsets.filter(o => o.strength > 0.5 && o.strength <= 0.8);
    const hihatOnsets = onsets.filter(o => o.strength <= 0.5);

    // Convert to beat grid positions
    if (beats.bpm) {
      const beatDuration = 60 / beats.bpm;
      
      track.elements.kick.pattern = this.quantizeToGrid(
        kickOnsets.map(o => o.time),
        beatDuration,
        16 // 16th note grid
      );
      
      track.elements.snare.pattern = this.quantizeToGrid(
        snareOnsets.map(o => o.time),
        beatDuration,
        16
      );
      
      track.elements.hihat.pattern = this.quantizeToGrid(
        hihatOnsets.map(o => o.time),
        beatDuration,
        16
      );
    }

    // Determine complexity
    const totalHits = kickOnsets.length + snareOnsets.length + hihatOnsets.length;
    const hitsPerBar = totalHits / (beats.beats.length / 4);
    
    if (hitsPerBar < 4) track.complexity = 'simple';
    else if (hitsPerBar > 12) track.complexity = 'complex';

    // Generate pattern suggestions
    track.patterns = this.generateDrumPatterns(track.elements, track.complexity);

    return track;
  }

  /**
   * Analyze bass track from low frequency content
   */
  analyzeBassTrack(harmonicAudio, pitches, key, sampleRate) {
    const track = {
      type: 'bass',
      notes: [],
      pattern: 'steady', // steady, walking, syncopated, sub
      register: 'low',
      complexity: 'medium'
    };

    // Filter pitches for bass range (< 200 Hz)
    const bassPitches = pitches.filter(p => p.pitch < 200 && p.confidence > 0.8);
    
    // Extract note sequence
    track.notes = this.extractNoteSequence(bassPitches, key);
    
    // Determine pattern type
    if (bassPitches.length > 0) {
      const avgInterval = this.calculateAverageInterval(bassPitches.map(p => p.time));
      
      if (avgInterval < 0.25) track.pattern = 'walking';
      else if (avgInterval > 1) track.pattern = 'sub';
      else if (this.isSyncopated(bassPitches.map(p => p.time))) track.pattern = 'syncopated';
    }

    return track;
  }

  /**
   * Analyze chord/harmony track
   */
  analyzeChordTrack(harmonicAudio, pitches, key, structure, sampleRate) {
    const track = {
      type: 'chords',
      progression: [],
      voicing: 'triads', // triads, sevenths, extended, quartal
      rhythm: 'sustained', // sustained, rhythmic, arpeggiated
      sections: {}
    };

    // Analyze harmonic content by section
    structure.sections.forEach(section => {
      const sectionPitches = pitches.filter(p => 
        p.time >= section.startTime && p.time < section.endTime
      );
      
      // Group simultaneous pitches into chords
      const chords = this.detectChords(sectionPitches, key);
      
      track.sections[section.type] = {
        chords,
        density: chords.length / (section.endTime - section.startTime)
      };
    });

    // Determine overall characteristics
    const allChords = Object.values(track.sections).flatMap(s => s.chords);
    track.progression = this.extractProgression(allChords, key);
    
    return track;
  }

  /**
   * Analyze melody/lead track
   */
  analyzeMelodyTrack(harmonicAudio, pitches, key, sampleRate) {
    const track = {
      type: 'melody',
      phrases: [],
      range: { low: 0, high: 0 },
      contour: 'ascending', // ascending, descending, arch, wave
      rhythmicDensity: 'medium'
    };

    // Filter pitches for melody range (> 200 Hz)
    const melodyPitches = pitches.filter(p => p.pitch > 200 && p.confidence > 0.9);
    
    if (melodyPitches.length > 0) {
      // Determine range
      track.range.low = Math.min(...melodyPitches.map(p => p.pitch));
      track.range.high = Math.max(...melodyPitches.map(p => p.pitch));
      
      // Analyze melodic contour
      track.contour = this.analyzeMelodicContour(melodyPitches);
      
      // Extract phrases
      track.phrases = this.extractMelodicPhrases(melodyPitches, key);
      
      // Calculate rhythmic density
      const avgInterval = this.calculateAverageInterval(melodyPitches.map(p => p.time));
      if (avgInterval < 0.2) track.rhythmicDensity = 'high';
      else if (avgInterval > 0.5) track.rhythmicDensity = 'low';
    }

    return track;
  }

  /**
   * Analyze atmosphere/FX track
   */
  analyzeAtmosphereTrack(features, structure, sampleRate) {
    const track = {
      type: 'atmosphere',
      elements: [],
      density: 'sparse', // sparse, moderate, dense
      evolution: 'static' // static, evolving, dynamic
    };

    // Analyze spectral characteristics
    const avgCentroid = features.spectralCentroid;
    const avgRolloff = features.spectralRolloff;
    
    // Determine atmospheric elements
    if (avgRolloff > 8000) {
      track.elements.push('shimmer');
    }
    if (avgCentroid < 500) {
      track.elements.push('sub_rumble');
    }
    if (features.energy < 0.3) {
      track.elements.push('ambient_pad');
    }
    
    // Analyze evolution over time
    const energyVariation = this.calculateVariation(
      structure.energyProfile.map(e => e.energy)
    );
    
    if (energyVariation < 0.1) track.evolution = 'static';
    else if (energyVariation > 0.3) track.evolution = 'dynamic';
    else track.evolution = 'evolving';

    return track;
  }

  /**
   * Helper methods
   */
  quantizeToGrid(times, beatDuration, subdivision) {
    const grid = [];
    const stepDuration = beatDuration / subdivision;
    
    times.forEach(time => {
      const gridPosition = Math.round(time / stepDuration) % subdivision;
      if (!grid.includes(gridPosition)) {
        grid.push(gridPosition);
      }
    });
    
    return grid.sort((a, b) => a - b);
  }

  extractNoteSequence(pitches, key) {
    return pitches.map(p => ({
      pitch: this.frequencyToNote(p.pitch),
      time: p.time,
      duration: 0.1 // Will be refined later
    }));
  }

  calculateAverageInterval(times) {
    if (times.length < 2) return 0;
    
    const intervals = [];
    for (let i = 1; i < times.length; i++) {
      intervals.push(times[i] - times[i-1]);
    }
    
    return intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  isSyncopated(times, beatDuration = 0.5) {
    // Check if hits fall off the main beats
    const offBeats = times.filter(t => {
      const beatPosition = (t % beatDuration) / beatDuration;
      return beatPosition > 0.1 && beatPosition < 0.9;
    });
    
    return offBeats.length > times.length * 0.3;
  }

  detectChords(pitches, key) {
    // Group simultaneous pitches (within 50ms)
    const chordGroups = [];
    const timeWindow = 0.05;
    
    pitches.forEach(p => {
      const group = chordGroups.find(g => 
        Math.abs(g[0].time - p.time) < timeWindow
      );
      
      if (group) {
        group.push(p);
      } else {
        chordGroups.push([p]);
      }
    });
    
    // Analyze each group
    return chordGroups.map(group => {
      const notes = group.map(p => this.frequencyToNote(p.pitch));
      return {
        time: group[0].time,
        notes,
        type: this.identifyChordType(notes)
      };
    });
  }

  extractProgression(chords, key) {
    // Simplified progression extraction
    return chords.map(c => c.type).filter((v, i, a) => a.indexOf(v) === i);
  }

  analyzeMelodicContour(pitches) {
    if (pitches.length < 3) return 'static';
    
    const first = pitches[0].pitch;
    const last = pitches[pitches.length - 1].pitch;
    const middle = pitches[Math.floor(pitches.length / 2)].pitch;
    
    if (last > first + 100) return 'ascending';
    if (last < first - 100) return 'descending';
    if (middle > first + 100 && middle > last + 100) return 'arch';
    
    return 'wave';
  }

  extractMelodicPhrases(pitches, key) {
    const phrases = [];
    const maxGap = 0.5; // seconds
    
    let currentPhrase = [];
    pitches.forEach((p, i) => {
      if (i > 0 && p.time - pitches[i-1].time > maxGap) {
        if (currentPhrase.length > 0) {
          phrases.push(currentPhrase);
        }
        currentPhrase = [p];
      } else {
        currentPhrase.push(p);
      }
    });
    
    if (currentPhrase.length > 0) {
      phrases.push(currentPhrase);
    }
    
    return phrases.map(phrase => ({
      notes: phrase.map(p => this.frequencyToNote(p.pitch)),
      startTime: phrase[0].time,
      endTime: phrase[phrase.length - 1].time
    }));
  }

  calculateVariation(values) {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance) / (mean || 1);
  }

  frequencyToNote(freq) {
    const A4 = 440;
    const C0 = A4 * Math.pow(2, -4.75);
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    if (freq > C0) {
      const halfSteps = 12 * Math.log2(freq / C0);
      const octave = Math.floor(halfSteps / 12);
      const noteIndex = Math.round(halfSteps % 12);
      
      return noteNames[noteIndex] + octave;
    }
    
    return 'C0';
  }

  identifyChordType(notes) {
    // Simplified chord identification
    if (notes.length === 1) return 'single';
    if (notes.length === 2) return 'interval';
    if (notes.length === 3) return 'triad';
    if (notes.length === 4) return 'seventh';
    return 'extended';
  }

  generateDrumPatterns(elements, complexity) {
    const patterns = [];
    
    // Generate Strudel pattern strings based on analyzed elements
    if (elements.kick.pattern.length > 0) {
      patterns.push({
        name: 'kick',
        pattern: `"bd*4"`, // Simplified - would be more complex based on actual pattern
        confidence: 0.8
      });
    }
    
    if (elements.snare.pattern.length > 0) {
      patterns.push({
        name: 'snare',
        pattern: `"~ sd ~ sd"`,
        confidence: 0.7
      });
    }
    
    if (elements.hihat.pattern.length > 0) {
      patterns.push({
        name: 'hihat',
        pattern: `"hh*8"`,
        confidence: 0.6
      });
    }
    
    return patterns;
  }

  /**
   * Generate Strudel patterns for each track
   */
  generateTrackPatterns(trackAnalysis, tempo, key) {
    const patterns = {};
    
    // Generate drum pattern
    if (trackAnalysis.drums.elements.kick.pattern.length > 0) {
      patterns.drums = this.generateDrumPattern(trackAnalysis.drums, tempo);
    }
    
    // Generate bass pattern
    if (trackAnalysis.bass.notes.length > 0) {
      patterns.bass = this.generateBassPattern(trackAnalysis.bass, tempo, key);
    }
    
    // Generate chord pattern
    if (trackAnalysis.chords.progression.length > 0) {
      patterns.chords = this.generateChordPattern(trackAnalysis.chords, tempo, key);
    }
    
    // Generate melody pattern
    if (trackAnalysis.melody.phrases.length > 0) {
      patterns.melody = this.generateMelodyPattern(trackAnalysis.melody, tempo, key);
    }
    
    // Generate atmosphere
    patterns.atmosphere = this.generateAtmospherePattern(trackAnalysis.atmosphere, tempo);
    
    return patterns;
  }

  generateDrumPattern(drumTrack, tempo) {
    let pattern = '// Drums\n';
    
    if (drumTrack.complexity === 'simple') {
      pattern += 'stack(\n';
      pattern += '  s("bd*4"),\n';
      pattern += '  s("~ sd ~ sd"),\n';
      pattern += '  s("hh*8")\n';
      pattern += ')';
    } else if (drumTrack.complexity === 'complex') {
      pattern += 'stack(\n';
      pattern += '  s("bd [bd bd] ~ bd").sometimes(x => x.speed(2)),\n';
      pattern += '  s("~ sd ~ [sd sd*2]"),\n';
      pattern += '  s("hh*16").gain(0.8),\n';
      pattern += '  s("~ ~ ~ oh").gain(0.6)\n';
      pattern += ')';
    } else {
      pattern += 'stack(\n';
      pattern += '  s("bd*4"),\n';
      pattern += '  s("~ sd ~ sd"),\n';
      pattern += '  s("hh*8"),\n';
      pattern += '  s("[~ oh]*2").gain(0.5)\n';
      pattern += ')';
    }
    
    return pattern;
  }

  generateBassPattern(bassTrack, tempo, key) {
    let pattern = '// Bass\n';
    
    if (bassTrack.pattern === 'steady') {
      pattern += `note("${key}2*4").s("sawtooth").cutoff(800)`;
    } else if (bassTrack.pattern === 'walking') {
      pattern += `note("${key}2 ${key}2 [${key}2 ${key}3] ${key}2").s("sawtooth").cutoff(1000)`;
    } else if (bassTrack.pattern === 'syncopated') {
      pattern += `note("[${key}2 ~] ${key}2 ~ [${key}2 ${key}3]").s("sawtooth").cutoff(800)`;
    } else {
      pattern += `note("${key}1*2").s("sine").gain(0.8)`;
    }
    
    return pattern;
  }

  generateChordPattern(chordTrack, tempo, key) {
    let pattern = '// Chords\n';
    
    if (chordTrack.rhythm === 'sustained') {
      pattern += `note("<${key}4,${key}5,${key}6>*2").s("sawtooth").cutoff(2000).attack(0.1).release(0.5)`;
    } else if (chordTrack.rhythm === 'rhythmic') {
      pattern += `note("<${key}4,${key}5,${key}6>*8").s("square").cutoff(1500)`;
    } else {
      pattern += `note("<${key}4,${key}5,${key}6>").arp("up down").s("triangle")`;
    }
    
    return pattern;
  }

  generateMelodyPattern(melodyTrack, tempo, key) {
    let pattern = '// Melody\n';
    
    if (melodyTrack.rhythmicDensity === 'high') {
      pattern += `note("${key}5 ${key}6 ${key}5 [${key}6 ${key}7]").s("triangle").delay(0.3).room(0.5)`;
    } else if (melodyTrack.rhythmicDensity === 'low') {
      pattern += `note("${key}5*2 ~ ${key}6").s("sine").vibrato(2)`;
    } else {
      pattern += `note("${key}5 ${key}6 ${key}5 ${key}6").s("square").cutoff(3000)`;
    }
    
    return pattern;
  }

  generateAtmospherePattern(atmosphereTrack, tempo) {
    let pattern = '// Atmosphere\n';
    
    if (atmosphereTrack.elements.includes('ambient_pad')) {
      pattern += 'note("c4,e4,g4").s("sawtooth").cutoff(500).attack(2).release(4).gain(0.3)';
    } else if (atmosphereTrack.elements.includes('shimmer')) {
      pattern += 'note("c6*16").s("triangle").delay(0.5).delaytime(0.125).delayfeedback(0.7).gain(0.2)';
    } else {
      pattern += 'note("c2").s("sine").gain(0.4).release(8)';
    }
    
    return pattern;
  }
}