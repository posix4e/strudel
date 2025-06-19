/**
 * Common drum patterns for different genres
 */

export const DRUM_PATTERNS = {
  // Basic patterns
  fourOnFloor: {
    kick: 's("bd*4")',
    snare: 's("~ cp ~ cp")',
    hihat: 's("hh*8")',
    description: 'Basic four-on-floor house/techno pattern'
  },
  
  rock: {
    kick: 's("bd ~ ~ bd ~ ~ bd ~")',
    snare: 's("~ ~ cp ~ ~ ~ cp ~")',
    hihat: 's("hh*8")',
    description: 'Classic rock beat'
  },
  
  hiphop: {
    kick: 's("bd ~ ~ bd ~ ~ ~ bd")',
    snare: 's("~ ~ ~ cp ~ ~ cp ~")',
    hihat: 's("hh ~ hh hh ~ hh hh ~")',
    openhat: 's("~ ~ ~ ~ oh ~ ~ ~")',
    description: 'Hip-hop boom bap pattern'
  },
  
  trap: {
    kick: 's("bd ~ ~ ~ bd ~ ~ ~")',
    snare: 's("~ ~ ~ cp ~ ~ ~ ~")',
    hihat: 's("hh hh hh hh hh hh <hh*2 hh> hh")',
    description: 'Trap-style with rapid hi-hats'
  },
  
  dnb: {
    kick: 's("bd ~ ~ ~ ~ ~ bd ~")',
    snare: 's("~ ~ cp ~ ~ ~ ~ cp")',
    hihat: 's("hh*16")',
    description: 'Drum & bass pattern'
  },
  
  // More complex patterns
  breakbeat: {
    kick: 's("bd ~ ~ bd ~ bd ~ ~")',
    snare: 's("~ cp ~ ~ cp ~ ~ cp")',
    hihat: 's("hh ~ hh hh ~ hh hh ~")',
    description: 'Breakbeat/big beat pattern'
  },
  
  garage: {
    kick: 's("bd ~ ~ ~ bd ~ ~ ~")',
    snare: 's("~ ~ cp ~ ~ cp ~ ~")',
    hihat: 's("hh ~ hh ~ hh ~ hh ~")',
    shaker: 's("sh*16").gain(0.3)',
    description: 'UK garage shuffle'
  },
  
  afrobeat: {
    kick: 's("bd ~ bd ~ ~ bd ~ bd")',
    snare: 's("~ cp ~ cp ~ ~ cp ~")',
    hihat: 's("hh hh ~ hh hh ~ hh ~")',
    conga: 's("conga ~ conga conga ~ conga ~ ~")',
    description: 'Afrobeat polyrhythmic pattern'
  },
  
  reggaeton: {
    kick: 's("bd ~ ~ bd ~ ~ bd ~")',
    snare: 's("~ ~ cp ~ ~ cp ~ cp")',
    hihat: 's("hh ~ hh ~ hh ~ hh ~")',
    description: 'Reggaeton dembow rhythm'
  },
  
  // Electronic patterns
  techno: {
    kick: 's("bd*4")',
    clap: 's("~ cp ~ cp")',
    hihat: 's("hh ~ hh ~ hh ~ <hh*2 hh> ~")',
    ride: 's("~ ~ ~ ~ rd ~ ~ ~")',
    description: 'Driving techno pattern'
  },
  
  ambient: {
    kick: 's("bd ~ ~ ~ ~ ~ ~ ~").gain(0.3)',
    hihat: 's("hh ~ ~ hh ~ ~ ~ ~").gain(0.2)',
    perc: 's("~ ~ perc:3 ~ ~ ~ ~ perc:4").gain(0.15)',
    description: 'Minimal ambient percussion'
  },
  
  jungle: {
    kick: 's("bd ~ ~ bd ~ ~ bd ~")',
    snare: 's("~ cp ~ ~ cp ~ cp ~")',
    hihat: 's("hh*16").speed(1.5)',
    description: 'Fast jungle/breakcore pattern'
  }
};

/**
 * Get drum pattern based on tempo and energy
 */
export function selectDrumPattern(tempo, energy) {
  if (tempo < 90) {
    return energy > 0.5 ? DRUM_PATTERNS.hiphop : DRUM_PATTERNS.ambient;
  } else if (tempo < 110) {
    return energy > 0.5 ? DRUM_PATTERNS.rock : DRUM_PATTERNS.reggaeton;
  } else if (tempo < 130) {
    return energy > 0.6 ? DRUM_PATTERNS.fourOnFloor : DRUM_PATTERNS.garage;
  } else if (tempo < 150) {
    return energy > 0.5 ? DRUM_PATTERNS.techno : DRUM_PATTERNS.trap;
  } else if (tempo < 170) {
    return DRUM_PATTERNS.dnb;
  } else {
    return DRUM_PATTERNS.jungle;
  }
}

/**
 * Generate a drum stack from pattern
 */
export function generateDrumStack(pattern, gain = 0.8) {
  const parts = [];
  
  if (pattern.kick) parts.push(`${pattern.kick}.gain(${gain})`);
  if (pattern.snare) parts.push(`${pattern.snare}.gain(${gain * 0.9})`);
  if (pattern.clap) parts.push(`${pattern.clap}.gain(${gain * 0.85})`);
  if (pattern.hihat) parts.push(`${pattern.hihat}.gain(${gain * 0.5}).pan(sine.range(-0.2,0.2))`);
  if (pattern.openhat) parts.push(`${pattern.openhat}.gain(${gain * 0.6})`);
  if (pattern.ride) parts.push(`${pattern.ride}.gain(${gain * 0.7})`);
  if (pattern.shaker) parts.push(`${pattern.shaker}.gain(${gain * 0.4}).pan(0.3)`);
  if (pattern.conga) parts.push(`${pattern.conga}.gain(${gain * 0.6}).pan(-0.3)`);
  if (pattern.perc) parts.push(`${pattern.perc}.gain(${gain * 0.5})`);
  
  return parts.join(',\n  ');
}

/**
 * Combine multiple patterns for variation
 */
export function combinePatterns(pattern1, pattern2, ratio = 0.5) {
  const combined = {};
  const keys = new Set([...Object.keys(pattern1), ...Object.keys(pattern2)]);
  
  keys.forEach(key => {
    if (key === 'description') return;
    
    if (pattern1[key] && pattern2[key]) {
      // Alternate between patterns
      combined[key] = `<${pattern1[key]} ${pattern2[key]}>`.replace(/s\("/g, '').replace(/"\)/g, '');
      combined[key] = `s("${combined[key]}")`;
    } else {
      combined[key] = pattern1[key] || pattern2[key];
    }
  });
  
  return combined;
}