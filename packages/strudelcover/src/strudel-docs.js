/**
 * Strudel documentation snippets for LLM context
 */

export const STRUDEL_DOCS = {
  basics: `
Strudel Pattern Basics:
- Notes: n("60 62 64 65") or note("c4 d4 e4 f4")
- Samples: s("bd sd hh cp") 
- Sounds: .sound("sawtooth"), .sound("sine"), .sound("square"), .sound("triangle")
- Rhythm: "bd*4" (repeat 4 times), "bd ~ sd ~" (~ is rest), "bd(3,8)" (euclidean)
`,

  realExamples: `
Real Strudel Pattern Examples (from strudel-songs-collection):

// Drum pattern example
stack(
  s("bd*4").gain(0.8),
  s("~ cp ~ cp").gain(0.6),
  s("hh*8").gain(0.4).pan(sine.range(0.2,0.8))
)

// Bass pattern example  
note("<c2 c2 eb2 f2>").sound("sawtooth").lpf(800).gain(0.5)

// Chord progression
note("<[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]>")
  .sound("square").room(0.5).gain(0.3)

// Lead melody
note("c5 d5 e5 g5 e5 d5 c5 ~").sound("triangle")
  .delay(0.5).delaytime(0.125).gain(0.6)
`,

  synths: `
Synth sounds in Strudel:
- Use .sound() not .s() for synths: n("60").sound("sawtooth")
- Available synths: sine, sawtooth, square, triangle, fm, noise
- Filters: .lpf(1000) (lowpass), .hpf(500) (highpass), .bpf(1000) (bandpass)
- Effects: .room(0.5), .delay(0.25), .pan(0.5), .gain(0.8)
`,

  drums: `
Drum patterns in Strudel:
- Basic: s("bd sd bd sd")
- With rests: s("bd ~ sd ~")
- Polyrhythm: s("bd*4, hh*8, ~ cp ~ cp")
- Common sounds: bd (kick), sd/cp (snare/clap), hh/oh (hihat), cr (crash)
`,

  structure: `
Pattern structure:
- Stack patterns: stack(s("bd*4"), n("60 62").sound("sawtooth"))
- Sequence: cat(pattern1, pattern2)
- Slow down: .slow(2) 
- Speed up: .fast(2)
- Pattern grouping: Use stack() for layers, cat() for sequences
`,

  effects: `
Effects in Strudel:
- Reverb: .room(0.9) (0-1)
- Delay: .delay(0.5) (0-1) with .delaytime(0.125) and .delayfeedback(0.5)
- Filter: .lpf(1000), .hpf(200), .bpf(1000).bpq(5)
- Distortion: .distort(0.5)
- Compression: .compressor("-20:4:10")
`,

  advanced: `
Advanced patterns:
- Euclidean rhythms: "bd(5,8)" - 5 hits in 8 steps
- Random: choose("bd", "sd", "hh")
- Conditional: every(4, rev) - reverse every 4 cycles
- Pattern math: "0 2 4 5".add(12) - transpose up octave
`,

  songPatterns: `
Complete Song Pattern Examples:

// Example from strudel-songs-collection
// Pattern structure with sections
let intro = stack(
  s("bd ~ ~ bd").gain(0.6),
  note("c2 ~ ~ g2").sound("sawtooth").lpf(400)
)

let verse = stack(
  s("bd*4, ~ cp ~ cp, hh*8").gain(0.7),
  note("<c2 c2 eb2 f2>").sound("sawtooth").lpf(600),
  note("<[c4,e4,g4] [a3,c4,e4]>").sound("square").room(0.3)
)

// Sequence sections
cat(intro.slow(2), verse.slow(4), verse.slow(4))

// Another approach - all in one pattern
stack(
  // Drums
  s("[bd*4, ~ cp ~ cp, hh*8]").gain(0.8),
  // Bass 
  note("<c2 eb2 f2 g2>*4").sound("sawtooth").lpf(800).gain(0.5),
  // Chords
  note("<[c4,e4,g4] [f3,a3,c4] [g3,b3,d4] [c4,e4,g4]>")
    .sound("square").room(0.4).gain(0.3),
  // Lead
  note("c5 <e5 g5> <d5 f5> c5").sound("triangle")
    .delay(0.5).gain(0.6).sometimes(rev)
).slow(2)
`
};

/**
 * Get relevant documentation for a specific layer type
 */
export function getDocsForLayer(layer) {
  const layerDocs = {
    drums: [STRUDEL_DOCS.drums, STRUDEL_DOCS.realExamples, STRUDEL_DOCS.basics],
    bass: [STRUDEL_DOCS.synths, STRUDEL_DOCS.effects, STRUDEL_DOCS.realExamples, STRUDEL_DOCS.basics],
    chords: [STRUDEL_DOCS.synths, STRUDEL_DOCS.structure, STRUDEL_DOCS.realExamples, STRUDEL_DOCS.basics],
    lead: [STRUDEL_DOCS.synths, STRUDEL_DOCS.effects, STRUDEL_DOCS.realExamples, STRUDEL_DOCS.basics],
    harmony: [STRUDEL_DOCS.synths, STRUDEL_DOCS.structure, STRUDEL_DOCS.realExamples, STRUDEL_DOCS.basics],
    atmosphere: [STRUDEL_DOCS.synths, STRUDEL_DOCS.effects, STRUDEL_DOCS.advanced, STRUDEL_DOCS.realExamples]
  };

  return layerDocs[layer] || [STRUDEL_DOCS.basics];
}

/**
 * Fetch live documentation from Strudel website
 */
export async function fetchLiveStrudelDocs(section = 'learn') {
  try {
    // In a real implementation, you could:
    // 1. Fetch from Strudel's API if they have one
    // 2. Scrape https://strudel.tidalcycles.org/learn/
    // 3. Use a cached version that gets updated periodically
    
    // Example of what could be done:
    // const response = await fetch(`https://strudel.tidalcycles.org/api/docs/${section}`);
    // const docs = await response.json();
    // return docs;
    
    // For now, return enhanced static docs
    return {
      ...STRUDEL_DOCS,
      timestamp: new Date().toISOString(),
      source: 'static'
    };
  } catch (error) {
    console.warn('Could not fetch live docs, using static version');
    return STRUDEL_DOCS;
  }
}

/**
 * Get a formatted prompt with documentation context
 */
export function getPromptWithDocs(basePrompt, layer) {
  const docs = getDocsForLayer(layer);
  return `
${docs.join('\n\n')}

Based on the Strudel documentation above, ${basePrompt}

Important: Output ONLY the Strudel pattern code, no explanations or comments.`;
}