/**
 * Convert note names to MIDI numbers
 */

// Note name to MIDI number mapping
const NOTE_TO_MIDI = {
  'c': 0, 'c#': 1, 'db': 1, 'd': 2, 'd#': 3, 'eb': 3,
  'e': 4, 'f': 5, 'f#': 6, 'gb': 6, 'g': 7, 'g#': 8, 'ab': 8,
  'a': 9, 'a#': 10, 'bb': 10, 'b': 11
};

/**
 * Convert a single note name to MIDI number
 * @param {string} note - Note name like "c4", "g#5", etc.
 * @returns {number} MIDI note number
 */
export function noteToMidi(note) {
  const match = note.toLowerCase().match(/^([a-g][#b]?)(\d+)$/);
  if (!match) return null;
  
  const [, noteName, octave] = match;
  const noteNumber = NOTE_TO_MIDI[noteName];
  if (noteNumber === undefined) return null;
  
  // MIDI number = (octave + 1) * 12 + note
  // C4 = 60 in MIDI
  return (parseInt(octave) + 1) * 12 + noteNumber;
}

/**
 * Convert a key name to root MIDI number at octave 4
 * @param {string} key - Key name like "C", "G#", "Eb"
 * @returns {number} MIDI note number at octave 4
 */
export function keyToMidi(key) {
  const noteName = key.toLowerCase().replace('major', '').replace('minor', '').trim();
  const noteNumber = NOTE_TO_MIDI[noteName];
  if (noteNumber === undefined) return 60; // Default to C4
  
  return 60 + noteNumber; // C4 = 60
}

/**
 * Get scale degrees as MIDI numbers
 * @param {string} key - Key name
 * @param {number} octave - Base octave
 * @returns {object} Object with scale degrees
 */
export function getScaleMidiNumbers(key, octave = 3) {
  const root = keyToMidi(key);
  const baseNote = root - 60 + (octave + 1) * 12;
  
  // Major scale intervals: W W H W W W H
  const majorIntervals = [0, 2, 4, 5, 7, 9, 11];
  // Minor scale intervals: W H W W H W W  
  const minorIntervals = [0, 2, 3, 5, 7, 8, 10];
  
  const isMinor = key.toLowerCase().includes('minor') || key.toLowerCase().includes('m');
  const intervals = isMinor ? minorIntervals : majorIntervals;
  
  return {
    root: baseNote,
    second: baseNote + intervals[1],
    third: baseNote + intervals[2],
    fourth: baseNote + intervals[3],
    fifth: baseNote + intervals[4],
    sixth: baseNote + intervals[5],
    seventh: baseNote + intervals[6],
    octave: baseNote + 12
  };
}

/**
 * Replace note names with MIDI numbers in a pattern string
 * @param {string} pattern - Strudel pattern string
 * @returns {string} Pattern with MIDI numbers
 */
export function convertNotesToMidi(pattern) {
  // Match n("...") patterns
  return pattern.replace(/n\("([^"]+)"\)/g, (match, notes) => {
    const convertedNotes = notes.split(/\s+/).map(note => {
      if (note === '~') return '~';
      const midi = noteToMidi(note);
      return midi !== null ? midi : note;
    }).join(' ');
    return `n("${convertedNotes}")`;
  });
}