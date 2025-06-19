/**
 * Error recovery utilities for pattern generation
 */

/**
 * Analyze pattern errors and suggest fixes
 */
export function analyzePatternError(pattern, errorDetails) {
  const errors = [];
  const suggestions = [];
  
  // Check for console errors
  if (errorDetails?.consoleErrors?.length > 0) {
    errorDetails.consoleErrors.forEach(error => {
      if (error.includes('sound') && error.includes('not found')) {
        // Extract the problematic sound
        const soundMatch = error.match(/sound\s+(\S+)\s+not found/);
        if (soundMatch) {
          errors.push(`Sound "${soundMatch[1]}" not found`);
          suggestions.push(`Replace s("${soundMatch[1]}") with a valid sound like s("bd"), s("cp"), s("hh"), etc.`);
        }
      }
      
      if (error.includes('Failed to execute') && error.includes('createPeriodicWave')) {
        errors.push('Invalid waveform parameters');
        suggestions.push('Check oscillator parameters - ensure arrays have at least 2 elements');
      }
      
      if (error.includes('is not a function')) {
        const funcMatch = error.match(/(\w+)\s+is not a function/);
        if (funcMatch) {
          errors.push(`Function "${funcMatch[1]}" is not available`);
          suggestions.push(`Check if "${funcMatch[1]}" is a valid Strudel function`);
        }
      }
    });
  }
  
  // Check pattern syntax
  if (pattern.includes('arrange(')) {
    errors.push('arrange() is not a valid Strudel function');
    suggestions.push('Replace arrange() with cat() for sequencing patterns');
  }
  
  // Check for common typos
  if (pattern.match(/\bs\(['"]\w+['"]\)/)) {
    // Check for quoted strings in s() - should be double quotes
    const matches = pattern.match(/s\('([^']+)'\)/g);
    if (matches) {
      errors.push('Single quotes used in s() function');
      suggestions.push('Use double quotes: s("sound") not s(\'sound\')');
    }
  }
  
  // Check for missing sounds
  const soundCalls = pattern.match(/s\("([^"]+)"\)/g) || [];
  const commonSounds = ['bd', 'sd', 'cp', 'hh', 'oh', 'cr', 'perc', 'bass', 'pad'];
  soundCalls.forEach(call => {
    const sound = call.match(/s\("([^"]+)"\)/)[1];
    // Check if it's a basic sound without colon
    if (!sound.includes(':') && !sound.includes('~') && !sound.includes('*')) {
      const baseSound = sound.split(/[^a-z]/)[0];
      if (!commonSounds.includes(baseSound)) {
        errors.push(`Uncommon sound "${sound}" might not exist`);
        suggestions.push(`Try common sounds: ${commonSounds.join(', ')}`);
      }
    }
  });
  
  return { errors, suggestions };
}

/**
 * Generate error recovery prompt for LLM
 */
export function buildErrorRecoveryPrompt(pattern, errorAnalysis, originalAnalysis) {
  const { errors, suggestions } = errorAnalysis;
  
  return `The generated Strudel pattern is producing silence due to errors. Please fix the pattern.

Original Pattern:
\`\`\`javascript
${pattern}
\`\`\`

Detected Errors:
${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Suggested Fixes:
${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Important reminders:
- Use only valid Strudel sounds: bd, sd, cp, hh, oh, cr, perc, bass, pad, etc.
- Use cat() not arrange() for sequencing sections
- Use double quotes in s() function: s("bd") not s('bd')
- For oscillators, use valid waveforms: sine, square, sawtooth, triangle
- Ensure all MIDI numbers are valid (0-127)
- Test with simple patterns first

Please provide a FIXED version of the pattern that will generate audio successfully.
Keep the same structure but fix all errors.`;
}

/**
 * Simplify pattern for testing
 */
export function createFallbackPattern(tempo, key) {
  return `// Simplified fallback pattern
setcps(${tempo}/60/4)

$: stack(
  // Basic drums
  s("bd*4").gain(0.5),
  s("~ cp ~ cp").gain(0.4),
  s("hh*8").gain(0.3),
  
  // Simple bass
  n("36 ~ 36 48").s("sawtooth").gain(0.4).lpf(600),
  
  // Basic pad
  n("<60 64 67>").s("square").gain(0.2).room(0.5)
).room(0.3)`;
}