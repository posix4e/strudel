/**
 * Utilities for handling tempo in Strudel patterns
 */

/**
 * Ensure pattern has correct tempo
 * @param {string} pattern - The Strudel pattern
 * @param {number} targetTempo - Target BPM
 * @returns {string} Pattern with corrected tempo
 */
export function ensureCorrectTempo(pattern, targetTempo) {
  // Extract current tempo
  const tempoMatch = pattern.match(/setcps\(([^)]+)\)/);
  if (!tempoMatch) {
    // Add tempo if missing
    return `setcps(${targetTempo}/60/4)\n${pattern}`;
  }
  
  // Replace with correct tempo calculation
  const correctTempo = `setcps(${targetTempo}/60/4)`;
  return pattern.replace(/setcps\([^)]+\)/, correctTempo);
}

/**
 * Extract tempo from pattern
 * @param {string} pattern - The Strudel pattern
 * @returns {number|null} BPM or null if not found
 */
export function extractTempo(pattern) {
  const tempoMatch = pattern.match(/setcps\(([^)]+)\)/);
  if (!tempoMatch) return null;
  
  // Parse the tempo expression
  const tempoExpr = tempoMatch[1];
  
  // Handle different formats
  // Format: tempo/60/4
  const bpmMatch = tempoExpr.match(/(\d+)\/60\/4/);
  if (bpmMatch) {
    return parseInt(bpmMatch[1]);
  }
  
  // Format: direct cps value
  const cpsValue = parseFloat(tempoExpr);
  if (!isNaN(cpsValue)) {
    // Convert CPS to BPM (cps * 60 * 4)
    return Math.round(cpsValue * 60 * 4);
  }
  
  return null;
}

/**
 * Validate tempo is within reasonable range
 * @param {number} tempo - BPM value
 * @returns {boolean} Whether tempo is valid
 */
export function isValidTempo(tempo) {
  return tempo >= 40 && tempo <= 300;
}

/**
 * Get tempo adjustment suggestions
 * @param {number} currentTempo - Current BPM
 * @param {number} targetTempo - Target BPM
 * @returns {string} Suggestion text
 */
export function getTempoSuggestion(currentTempo, targetTempo) {
  const diff = Math.abs(currentTempo - targetTempo);
  
  if (diff === 0) {
    return 'Tempo matches perfectly';
  } else if (diff <= 5) {
    return 'Tempo is very close, minor adjustment needed';
  } else if (diff <= 10) {
    return 'Tempo needs slight adjustment';
  } else if (diff <= 20) {
    return 'Tempo needs moderate adjustment';
  } else {
    return 'Tempo needs significant adjustment';
  }
}