/**
 * Error recovery utilities for pattern generation
 */

/**
 * Analyze pattern errors and suggest fixes
 */
export function analyzePatternError(pattern, errorDetails) {
  const errors = [];
  
  // Just collect the actual console errors
  if (errorDetails?.consoleErrors?.length > 0) {
    errorDetails.consoleErrors.forEach(error => {
      errors.push(error);
    });
  }
  
  return { errors, suggestions: [] };
}

/**
 * Extract learned corrections from runtime errors
 */
export function extractLearnedCorrections(runtimeError) {
  const corrections = [];
  
  if (runtimeError.includes('is not defined') || runtimeError.includes('is not a function')) {
    const match = runtimeError.match(/(\w+)\s+is not (defined|a function)/);
    if (match) {
      const invalidName = match[1];
      
      // Common corrections
      if (invalidName === 'triangle') {
        corrections.push({ wrong: 'triangle', correct: 'tri', context: 'Use .s("tri") not .s("triangle")' });
      } else if (invalidName === 'sawtooth') {
        corrections.push({ wrong: 'sawtooth', correct: 'saw', context: 'Use .s("saw") not .s("sawtooth")' });
      } else if (invalidName === 'sine' || invalidName === 'saw' || invalidName === 'tri' || invalidName === 'square') {
        corrections.push({ wrong: `s("${invalidName}")`, correct: `n("note").s("${invalidName}")`, context: `${invalidName} is a synth, use with n()` });
      }
    }
  }
  
  if (runtimeError.includes('sound') && runtimeError.includes('not found')) {
    const soundMatch = runtimeError.match(/sound\s+(\S+)\s+not found/);
    if (soundMatch) {
      const sound = soundMatch[1];
      if (['pad', 'noise', 'lead', 'pluck'].includes(sound)) {
        corrections.push({ wrong: `s("${sound}")`, correct: 'synthesis', context: `${sound} is not a sample, use synthesis instead` });
      }
    }
  }
  
  return corrections;
}

/**
 * Generate error recovery prompt for LLM
 */
export function buildErrorRecoveryPrompt(pattern, errorAnalysis, originalAnalysis, runtimeError = null) {
  // Just pass the runtime error directly
  if (runtimeError) {
    return runtimeError;
  }
  
  const { errors } = errorAnalysis;
  if (errors.length > 0) {
    return errors[0]; // Just return the first error
  }
  
  return "Pattern is generating silence";
}

