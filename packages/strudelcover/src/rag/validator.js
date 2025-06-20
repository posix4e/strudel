/**
 * Pattern validator for Strudel code
 * Validates syntax and ensures patterns will work correctly
 */

import chalk from 'chalk';

export class PatternValidator {
  constructor() {
    // Known valid Strudel methods
    this.validMethods = new Set([
      // Sound and note methods
      'sound', 's', 'note', 'n', 'scale', 'mode',
      
      // Time methods
      'slow', 'fast', 'rev', 'palindrome', 'iter', 'iterBack',
      'euclidLegato', 'euclid', 'euclidRot',
      
      // Pattern methods
      'cat', 'fastcat', 'stack', 'superimpose', 'add', 'sub', 'mul', 'div',
      'struct', 'mask', 'when', 'every', 'someCycles', 'someCyclesBy',
      
      // Randomness
      'sometimes', 'sometimesBy', 'rarely', 'often', 'almostAlways',
      'rand', 'irand', 'chooseWith', 'choose', 'wchoose', 'pick',
      
      // Effects
      'jux', 'juxBy', 'delay', 'delaytime', 'delayfeedback',
      'room', 'roomsize', 'dry', 'wet',
      'lpf', 'hpf', 'bpf', 'lpq', 'hpq', 'bpq',
      'cutoff', 'resonance', 'bandf', 'bandq',
      'gain', 'pan', 'speed', 'crush', 'coarse',
      'shape', 'distort', 'triode', 'vowel',
      
      // Synth parameters
      'attack', 'decay', 'sustain', 'release', 'hold',
      'noise', 'cutoff', 'resonance', 'envelope',
      
      // Pattern manipulation
      'chop', 'striate', 'slice', 'splice', 'cut',
      'chunk', 'gap', 'legato', 'clip',
      
      // MIDI
      'midinote', 'midi', 'ccn', 'ccv', 'pitch',
      
      // Utility
      'cpm', 'setcps', 'orbit'
    ]);
    
    // Common sound names
    this.validSounds = new Set([
      // Drums
      'bd', 'kick', 'sd', 'snare', 'hh', 'hat', 'oh', 'ch',
      'cp', 'clap', 'rim', 'tom', 'cy', 'crash', 'ride',
      
      // Bass
      'bass', 'sub', 'sine', 'saw', 'square', 'triangle',
      
      // Synths
      'fm', 'superpiano', 'supersquare', 'supersaw', 'superpwm',
      'superchip', 'superhoover', 'superzow', 'superstatic',
      
      // Effects
      'reverb', 'delay', 'filter',
      
      // Samples (common ones)
      'casio', 'jazz', 'metal', 'gabba', 'jungle', 'techno',
      'house', 'trance', 'ambient', 'industrial'
    ]);
  }

  /**
   * Validate a Strudel pattern
   */
  validate(pattern) {
    const errors = [];
    const warnings = [];
    
    try {
      // Basic syntax checks
      this.checkSyntax(pattern, errors);
      
      // Check for valid methods
      this.checkMethods(pattern, errors, warnings);
      
      // Check pattern structure
      this.checkStructure(pattern, errors, warnings);
      
      // Check for common issues
      this.checkCommonIssues(pattern, errors, warnings);
      
      // Check sound references
      this.checkSounds(pattern, warnings);
      
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check basic syntax
   */
  checkSyntax(pattern, errors) {
    // Check for balanced parentheses
    let parenCount = 0;
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let stringChar = null;
    
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i];
      const prevChar = i > 0 ? pattern[i - 1] : null;
      
      if (!inString) {
        if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
        } else if (char === '(') parenCount++;
        else if (char === ')') parenCount--;
        else if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
      } else if (char === stringChar && prevChar !== '\\') {
        inString = false;
      }
    }
    
    if (parenCount !== 0) errors.push('Unbalanced parentheses');
    if (braceCount !== 0) errors.push('Unbalanced braces');
    if (bracketCount !== 0) errors.push('Unbalanced brackets');
    if (inString) errors.push('Unclosed string');
    
    // Check for pattern start - make this a warning instead of error
    if (!pattern.includes('$:') && !pattern.includes('$')) {
      warnings.push('Pattern should include $ or $: for proper formatting');
    }
  }

  /**
   * Check for valid Strudel methods
   */
  checkMethods(pattern, errors, warnings) {
    // Extract method calls
    const methodRegex = /\.\s*([a-zA-Z_]\w*)\s*\(/g;
    let match;
    
    while ((match = methodRegex.exec(pattern)) !== null) {
      const method = match[1];
      
      if (!this.validMethods.has(method)) {
        // Check for common typos
        const suggestion = this.findSimilarMethod(method);
        if (suggestion) {
          warnings.push(`Unknown method '${method}'. Did you mean '${suggestion}'?`);
        } else {
          warnings.push(`Unknown method '${method}'`);
        }
      }
    }
  }

  /**
   * Check pattern structure
   */
  checkStructure(pattern, errors, warnings) {
    // Check for empty patterns
    if (pattern.replace(/\s+/g, '').length < 10) {
      errors.push('Pattern appears to be empty or too short');
    }
    
    // Check for common structural issues
    if (pattern.includes('..')) {
      errors.push('Double dots (..) are not valid in Strudel');
    }
    
    // Check for method chaining
    const lines = pattern.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('.') && !line.includes('$')) {
        warnings.push('Method chain might be disconnected');
      }
    }
  }

  /**
   * Check for common issues
   */
  checkCommonIssues(pattern, errors, warnings) {
    // Check for missing quotes in sound/note
    const soundRegex = /\.(?:sound|s)\s*\(\s*([^'"\)]+)\s*\)/g;
    let match;
    
    while ((match = soundRegex.exec(pattern)) !== null) {
      const arg = match[1].trim();
      if (arg && !arg.startsWith('$') && !arg.match(/^[a-zA-Z_]\w*$/)) {
        errors.push(`Sound argument should be quoted: .sound("${arg}")`);
      }
    }
    
    // Check for common syntax errors
    if (pattern.includes('scale(') && !pattern.match(/scale\s*\(\s*["'][^"']+["']\s*\)/)) {
      warnings.push('Scale should be specified as a string, e.g., .scale("C:major")');
    }
    
    // Check for missing tempo setting
    if (!pattern.includes('setcps') && !pattern.includes('cpm')) {
      warnings.push('Consider setting tempo with setcps() or cpm()');
    }
  }

  /**
   * Check sound references
   */
  checkSounds(pattern, warnings) {
    const soundRegex = /\.(?:sound|s)\s*\(\s*["']([^"']+)["']\s*\)/g;
    let match;
    
    while ((match = soundRegex.exec(pattern)) !== null) {
      const sound = match[1];
      
      // Check if it's a known sound or follows common patterns
      if (!this.validSounds.has(sound) && !sound.match(/^[a-zA-Z]+:\d+$/)) {
        // Don't warn for parameterized sounds or samples
        if (!sound.includes(':') && !sound.match(/^\d+$/)) {
          warnings.push(`Unknown sound '${sound}' - make sure it exists`);
        }
      }
    }
  }

  /**
   * Find similar method name for suggestions
   */
  findSimilarMethod(method) {
    const methodLower = method.toLowerCase();
    
    // Check for exact match with different case
    for (const valid of this.validMethods) {
      if (valid.toLowerCase() === methodLower) return valid;
    }
    
    // Check for common typos
    const typoMap = {
      'sounds': 'sound',
      'notes': 'note',
      'scales': 'scale',
      'sometime': 'sometimes',
      'sloww': 'slow',
      'fastt': 'fast',
      'gian': 'gain',
      'pann': 'pan'
    };
    
    if (typoMap[methodLower]) return typoMap[methodLower];
    
    // Levenshtein distance for close matches
    let bestMatch = null;
    let bestDistance = Infinity;
    
    for (const valid of this.validMethods) {
      const distance = this.levenshteinDistance(methodLower, valid.toLowerCase());
      if (distance < bestDistance && distance <= 2) {
        bestDistance = distance;
        bestMatch = valid;
      }
    }
    
    return bestMatch;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(a, b) {
    const matrix = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }

  /**
   * Fix common issues automatically
   */
  autoFix(pattern) {
    let fixed = pattern;
    
    // Fix missing quotes in sound()
    fixed = fixed.replace(/\.sound\s*\(\s*([^'"\$\)][^)]*)\s*\)/g, '.sound("$1")');
    
    // Fix missing $ at start
    if (!fixed.trim().startsWith('$')) {
      fixed = '$: ' + fixed.trim();
    }
    
    // Fix double dots
    fixed = fixed.replace(/\.\./g, '.');
    
    // Fix common typos
    const typoMap = {
      '.sounds(': '.sound(',
      '.notes(': '.note(',
      '.scales(': '.scale(',
      '.sometime(': '.sometimes(',
      '.gian(': '.gain(',
      '.pann(': '.pan('
    };
    
    for (const [typo, correct] of Object.entries(typoMap)) {
      fixed = fixed.replace(new RegExp(typo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), correct);
    }
    
    return fixed;
  }
}