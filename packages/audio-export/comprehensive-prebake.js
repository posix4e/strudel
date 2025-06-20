// Comprehensive prebake for StrudelCover patterns
// Load various sound sources that patterns commonly use

// Load default dirt-samples
await samples('github:tidalcycles/dirt-samples');

// Try to load common drum machine banks
// These are used in patterns like: bank("AkaiLinn"), bank("RolandTR909"), etc.
try {
  // Common drum machines referenced in the patterns
  const drumBanks = [
    'AkaiLinn',
    'RolandTR909', 
    'RolandTR808',
    'Linn9000',
    'YamahaRY30',
    'RolandMT32',
    'AlesisHR16',
    'SequentialCircuitsDrumtracks',
    'KorgDDM110',
    'BossDR550',
    'BossDR110'
  ];
  
  // Try to load each bank - these might be available through different methods
  for (const bank of drumBanks) {
    try {
      // Try different loading approaches
      if (typeof loadBank !== 'undefined') {
        await loadBank(bank);
      }
    } catch (e) {
      console.log(`Could not load drum bank ${bank}:`, e.message);
    }
  }
} catch (e) {
  console.log('Could not load drum banks:', e.message);
}

// GM sounds are now loaded automatically in the exporter
// No need to load them here as they're already registered
console.log('GM soundfonts are pre-loaded by the exporter');

// Try to set up piano sounds if available
try {
  if (typeof registerSound !== 'undefined') {
    // Register common synth sounds that should work
    const basicSynths = ['sine', 'square', 'triangle', 'sawtooth', 'fm'];
    // These should already be available, but let's make sure
  }
} catch (e) {
  console.log('Could not register sounds:', e.message);
}

// Set default voicings if the function is available
// Many patterns use: setDefaultVoicings('legacy')
try {
  if (typeof setDefaultVoicings !== 'undefined') {
    setDefaultVoicings('legacy');
  }
} catch (e) {
  console.log('Could not set default voicings:', e.message);
}

console.log('Comprehensive prebake loaded');