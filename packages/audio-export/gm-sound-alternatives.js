// GM Sound Alternatives
// Maps GM sounds to available alternatives in the standard Strudel bundle

export const gmSoundAlternatives = {
  // Piano sounds
  'gm_piano': 'piano',
  'gm_acoustic_grand_piano': 'piano',
  'gm_bright_acoustic_piano': 'piano',
  'gm_electric_grand_piano': 'piano',
  'gm_honky_tonk_piano': 'piano',
  'gm_electric_piano_1': 'piano',
  'gm_electric_piano_2': 'piano',
  
  // Chromatic Percussion
  'gm_celesta': 'glockenspiel',
  'gm_glockenspiel': 'glockenspiel',
  'gm_music_box': 'glockenspiel',
  'gm_vibraphone': 'glockenspiel',
  'gm_marimba': 'glockenspiel',
  'gm_xylophone': 'glockenspiel',
  
  // Organ
  'gm_drawbar_organ': 'organ',
  'gm_percussive_organ': 'organ',
  'gm_rock_organ': 'organ',
  'gm_church_organ': 'organ',
  'gm_reed_organ': 'organ',
  'gm_accordion': 'accordion',
  'gm_harmonica': 'mouth', // mouth organ
  
  // Guitar
  'gm_acoustic_guitar_nylon': 'guitar',
  'gm_acoustic_guitar_steel': 'guitar',
  'gm_electric_guitar_jazz': 'guitar',
  'gm_electric_guitar_clean': 'guitar',
  'gm_electric_guitar_muted': 'guitar',
  'gm_overdriven_guitar': 'guitar',
  'gm_distortion_guitar': 'guitar',
  
  // Bass
  'gm_acoustic_bass': 'bass',
  'gm_electric_bass_finger': 'bass',
  'gm_electric_bass_pick': 'bass',
  'gm_fretless_bass': 'bass',
  'gm_slap_bass_1': 'bass',
  'gm_slap_bass_2': 'bass',
  'gm_synth_bass_1': 'bass',
  'gm_synth_bass_2': 'bass',
  
  // Strings
  'gm_violin': 'violin',
  'gm_viola': 'violin',
  'gm_cello': 'violin',
  'gm_contrabass': 'bass',
  'gm_tremolo_strings': 'violin',
  'gm_pizzicato_strings': 'pluck',
  'gm_orchestral_harp': 'pluck',
  'gm_timpani': 'timpani',
  
  // Ensemble
  'gm_string_ensemble_1': 'strings',
  'gm_string_ensemble_2': 'strings',
  'gm_synth_strings_1': 'strings',
  'gm_synth_strings_2': 'strings',
  
  // Brass
  'gm_trumpet': 'trumpet',
  'gm_trombone': 'trombone',
  'gm_tuba': 'tuba',
  'gm_muted_trumpet': 'trumpet',
  'gm_french_horn': 'horn',
  'gm_brass_section': 'brass',
  
  // Reed
  'gm_soprano_sax': 'sax',
  'gm_alto_sax': 'sax',
  'gm_tenor_sax': 'sax',
  'gm_baritone_sax': 'sax',
  'gm_oboe': 'flute',
  'gm_english_horn': 'flute',
  'gm_bassoon': 'bassoon',
  'gm_clarinet': 'clarinet',
  
  // Pipe
  'gm_piccolo': 'flute',
  'gm_flute': 'flute',
  'gm_recorder': 'flute',
  'gm_pan_flute': 'flute',
  'gm_blown_bottle': 'bottle',
  'gm_shakuhachi': 'flute',
  'gm_whistle': 'whistle',
  'gm_ocarina': 'flute',
  
  // Lead
  'gm_lead_1_square': 'square',
  'gm_lead_2_sawtooth': 'sawtooth',
  'gm_lead_3_calliope': 'square',
  'gm_lead_4_chiff': 'sawtooth',
  'gm_lead_5_charang': 'sawtooth',
  'gm_lead_6_voice': 'sine',
  'gm_lead_7_fifths': 'sawtooth',
  'gm_lead_8_bass_lead': 'square',
  
  // Pad
  'gm_pad_1_new_age': 'pad',
  'gm_pad_2_warm': 'pad',
  'gm_pad_3_polysynth': 'pad',
  'gm_pad_4_choir': 'choir',
  'gm_pad_5_bowed': 'pad',
  'gm_pad_6_metallic': 'pad',
  'gm_pad_7_halo': 'pad',
  'gm_pad_8_sweep': 'pad',
  
  // FX
  'gm_fx_1_rain': 'rain',
  'gm_fx_2_soundtrack': 'pad',
  'gm_fx_3_crystal': 'glockenspiel',
  'gm_fx_4_atmosphere': 'pad',
  'gm_fx_5_brightness': 'pad',
  'gm_fx_6_goblins': 'pad',
  'gm_fx_7_echoes': 'pad',
  'gm_fx_8_sci_fi': 'space',
  
  // Drums
  'gm_drum': 'drum'
};

// Function to replace GM sounds in a pattern
export function replaceGMSounds(pattern) {
  let modifiedPattern = pattern;
  
  for (const [gmSound, alternative] of Object.entries(gmSoundAlternatives)) {
    // Replace both quoted and unquoted versions
    const regex1 = new RegExp(`\\.s\\(["']${gmSound}["']\\)`, 'g');
    const regex2 = new RegExp(`s\\(["']${gmSound}["']\\)`, 'g');
    
    modifiedPattern = modifiedPattern.replace(regex1, `.s("${alternative}")`);
    modifiedPattern = modifiedPattern.replace(regex2, `s("${alternative}")`);
  }
  
  return modifiedPattern;
}

// Log replacements
export function logGMReplacements(pattern) {
  const replacements = [];
  
  for (const [gmSound, alternative] of Object.entries(gmSoundAlternatives)) {
    if (pattern.includes(gmSound)) {
      replacements.push(`${gmSound} → ${alternative}`);
    }
  }
  
  return replacements;
}