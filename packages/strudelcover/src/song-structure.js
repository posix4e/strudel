/**
 * Song structure detection and generation utilities
 */

/**
 * Common song structures
 */
export const SONG_STRUCTURES = {
  pop: {
    name: 'Pop/Rock',
    sections: [
      { type: 'intro', bars: 4, energy: 0.3 },
      { type: 'verse', bars: 8, energy: 0.5 },
      { type: 'chorus', bars: 8, energy: 0.8 },
      { type: 'verse', bars: 8, energy: 0.5 },
      { type: 'chorus', bars: 8, energy: 0.8 },
      { type: 'bridge', bars: 8, energy: 0.6 },
      { type: 'chorus', bars: 8, energy: 0.9 },
      { type: 'outro', bars: 4, energy: 0.3 }
    ]
  },
  electronic: {
    name: 'Electronic/Dance',
    sections: [
      { type: 'intro', bars: 8, energy: 0.2 },
      { type: 'buildup', bars: 8, energy: 0.4 },
      { type: 'drop', bars: 16, energy: 0.9 },
      { type: 'breakdown', bars: 8, energy: 0.5 },
      { type: 'buildup', bars: 8, energy: 0.6 },
      { type: 'drop', bars: 16, energy: 1.0 },
      { type: 'outro', bars: 8, energy: 0.3 }
    ]
  },
  hiphop: {
    name: 'Hip-Hop',
    sections: [
      { type: 'intro', bars: 4, energy: 0.4 },
      { type: 'verse', bars: 16, energy: 0.6 },
      { type: 'hook', bars: 8, energy: 0.8 },
      { type: 'verse', bars: 16, energy: 0.6 },
      { type: 'hook', bars: 8, energy: 0.8 },
      { type: 'verse', bars: 16, energy: 0.7 },
      { type: 'hook', bars: 8, energy: 0.8 },
      { type: 'outro', bars: 4, energy: 0.4 }
    ]
  },
  experimental: {
    name: 'Experimental/Ambient',
    sections: [
      { type: 'intro', bars: 16, energy: 0.1 },
      { type: 'development', bars: 32, energy: 0.4 },
      { type: 'climax', bars: 16, energy: 0.7 },
      { type: 'resolution', bars: 24, energy: 0.3 },
      { type: 'coda', bars: 8, energy: 0.1 }
    ]
  }
};

/**
 * Detect appropriate song structure based on genre/tempo
 */
export function detectSongStructure(tempo, duration, energy) {
  // Electronic music typically has longer sections
  if (tempo > 120 && tempo < 140) {
    return SONG_STRUCTURES.electronic;
  }
  
  // Hip-hop tempo range
  if (tempo > 80 && tempo < 100) {
    return SONG_STRUCTURES.hiphop;
  }
  
  // Experimental/ambient for very slow or very fast
  if (tempo < 80 || tempo > 160) {
    return SONG_STRUCTURES.experimental;
  }
  
  // Default to pop structure
  return SONG_STRUCTURES.pop;
}

/**
 * Calculate section timings based on tempo and structure
 */
export function calculateSectionTimings(structure, tempo) {
  const sections = [];
  let currentTime = 0;
  
  structure.sections.forEach(section => {
    const duration = (section.bars * 4 * 60) / tempo; // bars * beats * 60s / BPM
    sections.push({
      ...section,
      startTime: currentTime,
      endTime: currentTime + duration,
      duration
    });
    currentTime += duration;
  });
  
  return sections;
}

/**
 * Generate section-specific pattern variations
 */
export function generateSectionVariations(basePattern, sectionType, energy) {
  const variations = {
    intro: {
      drums: 'minimal',
      bass: 'sparse',
      melody: 'ambient',
      effects: 'heavy_reverb'
    },
    verse: {
      drums: 'groove',
      bass: 'steady',
      melody: 'subtle',
      effects: 'moderate'
    },
    chorus: {
      drums: 'full',
      bass: 'driving',
      melody: 'prominent',
      effects: 'bright'
    },
    drop: {
      drums: 'intense',
      bass: 'heavy',
      melody: 'lead',
      effects: 'compressed'
    },
    bridge: {
      drums: 'different',
      bass: 'melodic',
      melody: 'contrasting',
      effects: 'creative'
    },
    breakdown: {
      drums: 'stripped',
      bass: 'filtered',
      melody: 'atmospheric',
      effects: 'spacious'
    },
    buildup: {
      drums: 'rising',
      bass: 'tension',
      melody: 'ascending',
      effects: 'increasing'
    },
    outro: {
      drums: 'fading',
      bass: 'resolving',
      melody: 'closing',
      effects: 'decaying'
    }
  };
  
  return variations[sectionType] || variations.verse;
}

/**
 * Create smooth transitions between sections
 */
export function createTransition(fromSection, toSection, bars = 1) {
  const transitions = {
    'verse-chorus': 'snare_roll',
    'chorus-verse': 'filter_sweep',
    'buildup-drop': 'silence_before_drop',
    'breakdown-buildup': 'rising_filter',
    'any-outro': 'fade_out'
  };
  
  const key = `${fromSection}-${toSection}`;
  return transitions[key] || 'crossfade';
}