/**
 * Instrument detection and MIDI mapping for song sections
 */

// MIDI instrument mappings for common sounds
export const MIDI_INSTRUMENTS = {
  // Piano/Keys
  'acoustic_piano': { midi: 0, strudel: 'piano' },
  'electric_piano': { midi: 4, strudel: 'epiano' },
  'rhodes': { midi: 4, strudel: 'rhodes' },
  'synth_pad': { midi: 88, strudel: 'pad' },
  
  // Bass
  'acoustic_bass': { midi: 32, strudel: 'bass' },
  'electric_bass': { midi: 33, strudel: 'ebass' },
  'synth_bass': { midi: 38, strudel: 'saw', filter: 'lpf(400)' },
  'sub_bass': { midi: 39, strudel: 'sine', filter: 'lpf(200)' },
  
  // Lead/Melody
  'lead_synth': { midi: 80, strudel: 'saw' },
  'vocal_synth': { midi: 54, strudel: 'sine', filter: 'lpf(2000)' },
  'pluck_synth': { midi: 88, strudel: 'triangle', envelope: 'adsr(0.01,0.1,0.3,0.5)' },
  
  // Strings/Pads
  'strings': { midi: 48, strudel: 'sawtooth', filter: 'lpf(800)' },
  'synth_strings': { midi: 50, strudel: 'saw', filter: 'lpf(1000).room(0.5)' },
  'choir': { midi: 52, strudel: 'sine', filter: 'lpf(1500).room(0.7)' },
  
  // Percussion
  'kick': { midi: 35, strudel: 'bd' },
  'snare': { midi: 38, strudel: 'sd' },
  'hihat': { midi: 42, strudel: 'hh' },
  'crash': { midi: 49, strudel: 'cr' },
  'clap': { midi: 39, strudel: 'cp' },
  'shaker': { midi: 70, strudel: 'shaker' },
  
  // Special FX
  'atmosphere': { midi: 99, strudel: 'sine', effects: 'room(0.9).delay(0.5)' },
  'noise': { midi: 126, strudel: 'white' }
};

/**
 * Analyze instruments in a specific section
 */
export class InstrumentAnalyzer {
  /**
   * Detect instruments based on frequency analysis and energy
   */
  detectInstruments(sectionAnalysis) {
    const instruments = [];
    const { spectralCentroid, energy, tempo } = sectionAnalysis;
    
    // Always include drums for rhythmic sections
    if (energy > 0.3) {
      instruments.push({
        category: 'drums',
        detected: ['kick', 'snare', 'hihat'],
        confidence: 0.9
      });
    }
    
    // Bass detection (low frequencies)
    if (sectionAnalysis.lowFreqEnergy > 0.2) {
      instruments.push({
        category: 'bass',
        detected: energy > 0.5 ? ['synth_bass'] : ['sub_bass'],
        confidence: 0.8
      });
    }
    
    // Mid-range instruments (chords/pads)
    if (sectionAnalysis.midFreqEnergy > 0.3) {
      instruments.push({
        category: 'harmony',
        detected: spectralCentroid < 1000 ? ['synth_pad', 'strings'] : ['electric_piano', 'synth_strings'],
        confidence: 0.7
      });
    }
    
    // High frequency instruments (leads/melody)
    if (sectionAnalysis.highFreqEnergy > 0.2) {
      instruments.push({
        category: 'lead',
        detected: ['lead_synth', 'pluck_synth'],
        confidence: 0.6
      });
    }
    
    // Atmosphere/FX for all sections
    instruments.push({
      category: 'atmosphere',
      detected: ['atmosphere', 'reverb'],
      confidence: 0.5
    });
    
    return instruments;
  }
  
  /**
   * Get MIDI mapping suggestions for detected instruments
   */
  getMidiMappings(detectedInstruments) {
    const mappings = {};
    
    detectedInstruments.forEach(category => {
      mappings[category.category] = category.detected.map(inst => {
        const mapping = MIDI_INSTRUMENTS[inst];
        if (mapping) {
          return {
            name: inst,
            midi: mapping.midi,
            strudel: mapping.strudel,
            effects: mapping.filter || mapping.effects || '',
            confidence: category.confidence
          };
        }
        return null;
      }).filter(Boolean);
    });
    
    return mappings;
  }
  
  /**
   * Suggest layer order for progressive building
   */
  getLayerBuildOrder(instruments) {
    // Build order: drums -> bass -> harmony -> lead -> atmosphere
    const order = ['drums', 'bass', 'harmony', 'lead', 'atmosphere'];
    return order.filter(cat => instruments[cat] && instruments[cat].length > 0);
  }
  
  /**
   * Analyze section and return complete instrument data
   */
  analyzeSection(sectionAnalysis, sectionType) {
    // Add frequency energy analysis (simplified)
    const enhancedAnalysis = {
      ...sectionAnalysis,
      lowFreqEnergy: sectionType === 'drop' || sectionType === 'chorus' ? 0.8 : 0.4,
      midFreqEnergy: sectionType === 'verse' || sectionType === 'chorus' ? 0.6 : 0.3,
      highFreqEnergy: sectionType === 'intro' || sectionType === 'breakdown' ? 0.5 : 0.3
    };
    
    const detected = this.detectInstruments(enhancedAnalysis);
    const mappings = this.getMidiMappings(detected);
    const buildOrder = this.getLayerBuildOrder(mappings);
    
    return {
      detected,
      mappings,
      buildOrder,
      sectionType,
      energy: sectionAnalysis.energy
    };
  }
}

/**
 * Get Strudel instrument code for a MIDI mapping
 */
export function getStrudelInstrument(mapping) {
  let code = mapping.strudel;
  
  // Add effects if specified
  if (mapping.effects) {
    code += `.${mapping.effects}`;
  }
  
  // Add default gain
  code += '.gain(0.8)';
  
  return code;
}