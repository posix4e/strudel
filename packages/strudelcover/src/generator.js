import { LLMProviderFactory } from './llm/index.js';
import { sparkleEnhance } from './visualizers.js';
import { keyToMidi, getScaleMidiNumbers } from './note-converter.js';
import { DRUM_PATTERNS, selectDrumPattern, generateDrumStack } from './drum-patterns.js';
import { ensureCorrectTempo, extractTempo } from './tempo-utils.js';
import { ComplexPatternGenerator } from './complex-generator.js';

/**
 * Strudel pattern generator using LLM
 */
export class PatternGenerator {
  constructor(llmProvider, options = {}) {
    this.llmProvider = llmProvider;
    this.sparkleMode = options.sparkle || false;
    this.complexMode = options.complex || false;
    this.complexGenerator = new ComplexPatternGenerator();
  }
  
  async initializeLLM() {
    if (typeof this.llmProvider === 'string') {
      // Support legacy API - if string passed, assume it's OpenAI API key
      this.llm = await LLMProviderFactory.create('openai', { apiKey: this.llmProvider });
    } else if (!this.llm) {
      this.llm = this.llmProvider;
    }
  }

  /**
   * Generate initial Strudel pattern from audio analysis
   */
  async generateFromAnalysis(analysis, artistName, songName) {
    // Use complex generator for full songs if enabled
    if (this.complexMode) {
      return this.complexGenerator.generateComplexPattern(analysis, artistName, songName);
    }
    
    await this.initializeLLM();
    const prompt = await this.buildPrompt(analysis, artistName, songName);
    
    const messages = [
      {
        role: "system",
        content: `You create Strudel live coding patterns. Generate patterns based on the audio analysis.
                  Only respond with valid Strudel JavaScript code.
                  
                  Basic Strudel syntax:
                  - Samples: s("bd"), s("cp"), s("hh") - these are drum sounds
                  - Synths: n("60").s("sine"), n("c4").s("saw") - these are melodic sounds
                  - "sine", "saw", "triangle", "square" are SYNTHS not samples - must use with n().s()`
      },
      {
        role: "user",
        content: prompt
      }
    ];
    
    const completion = await this.llm.generateCompletion(messages, {
      temperature: 0.3 // Lower temperature for more deterministic output
    });
    
    let pattern = this.cleanPattern(completion);
    
    // Ensure correct tempo
    pattern = ensureCorrectTempo(pattern, analysis.tempo);
    
    // Add sparkle enhancements if enabled
    if (this.sparkleMode) {
      pattern = sparkleEnhance(pattern);
    }
    
    return pattern;
  }

  /**
   * Refine pattern based on comparison
   */
  async refinePattern(currentPattern, comparison, analysis) {
    await this.initializeLLM();
    const refinementPrompt = this.buildRefinementPrompt(
      currentPattern, 
      comparison, 
      analysis
    );
    
    const messages = [
      {
        role: "system",
        content: `You refine Strudel patterns. Adjust based on the comparison data.
                  Only respond with valid Strudel code.`
      },
      {
        role: "user",
        content: refinementPrompt
      }
    ];
    
    const completion = await this.llm.generateCompletion(messages, {
      temperature: 0.2
    });
    
    let pattern = this.cleanPattern(completion);
    
    // Ensure correct tempo is maintained
    pattern = ensureCorrectTempo(pattern, analysis.tempo);
    
    // Add sparkle enhancements if enabled
    if (this.sparkleMode) {
      pattern = sparkleEnhance(pattern);
    }
    
    return pattern;
  }


  /**
   * Build prompt for initial generation
   */
  async buildPrompt(analysis, artistName, songName) {
    const { tempo, key, rhythm, features } = analysis;
    
    // Get MIDI numbers for the key
    const scale = getScaleMidiNumbers(key, 3);
    
    // Select appropriate drum pattern
    const suggestedDrumPattern = selectDrumPattern(tempo, features.energy);
    
    return `Create a Strudel pattern for "${songName}" by ${artistName}.

Audio Analysis:
- Tempo: ${tempo} BPM
- Key: ${key}
- Duration: ${analysis.duration.toFixed(1)} seconds
- Energy: ${features.energy.toFixed(3)} (${this.describeLevel(features.energy)})
- Brightness: ${features.spectralCentroid.toFixed(0)} Hz (${this.describeBrightness(features.spectralCentroid)})
- RMS: ${features.rms.toFixed(3)}

Detected Rhythm Pattern:
- Kick positions: ${rhythm.kick.length > 0 ? rhythm.kick.join(', ') : 'None detected'}
- Snare positions: ${rhythm.snare.length > 0 ? rhythm.snare.join(', ') : 'None detected'}
- Hihat positions: ${rhythm.hihat.length > 0 ? rhythm.hihat.join(', ') : 'None detected'}

Key information:
- Tempo: ${tempo} BPM (use setcps(${tempo}/60/4))
- Key: ${key}
- Scale MIDI numbers for ${key}:
  - Root (octave 2): ${scale.root - 24}
  - Root (octave 3): ${scale.root - 12}
  - Root (octave 4): ${scale.root}
  - Third: ${scale.third}
  - Fifth: ${scale.fifth}
  - Octave: ${scale.octave}
- Energy: ${features.energy.toFixed(2)} (${this.describeLevel(features.energy)})
- Brightness: ${features.spectralCentroid.toFixed(0)} Hz (${this.describeBrightness(features.spectralCentroid)})

Create a Strudel pattern that captures the essence of this song.

Suggested drum pattern (${suggestedDrumPattern.description}):
${generateDrumStack(suggestedDrumPattern, 0.6)}

Working example:
setcps(${tempo}/60/4)
$: stack(
  // Drums - use s() for samples
  s("bd ~ ~ bd").gain(0.7),
  s("~ cp ~ cp").gain(0.5),
  s("hh*8").gain(0.3),
  // Bass - use n() with .s() for synths
  n("${scale.root - 24} ~ ${scale.root - 12} ~").s("saw").gain(0.4).lpf(800),
  // Pads
  n("<${scale.root} ${scale.third} ${scale.fifth}>").s("square").gain(0.2).room(0.5),
  // Lead - triangle synth
  n("~ ${scale.root + 12} ~ ${scale.fifth + 12}").s("triangle").gain(0.3).delay(0.25)
).room(0.3)

Valid effects: .gain(), .room(), .delay(), .lpf(), .hpf(), .pan()
DO NOT use: .reverb(), .chorus(), or other effects

Create something that captures the feel of "${songName}" by ${artistName}.`;
  }

  /**
   * Fix pattern errors using LLM
   */
  async fixPatternError(errorPrompt, analysis, previousAttempts = []) {
    await this.initializeLLM();
    
    const messages = [
      {
        role: "system",
        content: `You fix Strudel pattern errors.
                  Only respond with valid Strudel code.`
      }
    ];
    
    // Add previous attempts and their errors to the conversation
    previousAttempts.forEach(attempt => {
      messages.push({
        role: "assistant",
        content: attempt.pattern
      });
      messages.push({
        role: "user",
        content: `Error: ${attempt.error}`
      });
    });
    
    // Add the current error prompt
    messages.push({
      role: "user",
      content: errorPrompt
    });
    
    const completion = await this.llm.generateCompletion(messages, {
      temperature: 0.2 // Low temperature for reliable fixes
    });
    
    let pattern = this.cleanPattern(completion);
    
    // Ensure correct tempo
    pattern = ensureCorrectTempo(pattern, analysis.tempo);
    
    return pattern;
  }

  /**
   * Build prompt for refinement
   */
  buildRefinementPrompt(currentPattern, comparison, targetAnalysis) {
    const improvements = [];
    
    if (comparison.tempoDiff > 5) {
      improvements.push(`Adjust tempo: current is ${comparison.tempoDiff} BPM off. Target: ${targetAnalysis.tempo} BPM`);
    }
    
    if (!comparison.keyMatch) {
      improvements.push(`Change key to ${targetAnalysis.key}`);
    }
    
    if (comparison.rmsDiff > 0.1) {
      improvements.push(`Adjust volume/dynamics: ${comparison.rmsDiff > 0 ? 'increase' : 'decrease'} overall level`);
    }
    
    if (comparison.brightnessDiff > 0.2) {
      improvements.push(`Adjust brightness: ${comparison.brightnessDiff > 0 ? 'add more high frequencies' : 'reduce high frequencies'}`);
    }
    
    if (comparison.kickSimilarity < 0.7) {
      improvements.push(`Improve kick pattern. Target positions: ${targetAnalysis.rhythm.kick.join(', ')}`);
    }
    
    if (comparison.snareSimilarity < 0.7) {
      improvements.push(`Improve snare pattern. Target positions: ${targetAnalysis.rhythm.snare.join(', ')}`);
    }
    
    return `Refine this Strudel pattern:

\`\`\`
${currentPattern}
\`\`\`

Needed improvements:
${improvements.map((imp, i) => `${i + 1}. ${imp}`).join('\n')}

Comparison score: ${comparison.score}/100

Make minimal changes to improve the match. Keep the overall structure but adjust the specific issues listed.`;
  }

  /**
   * Clean up pattern output
   */
  cleanPattern(pattern) {
    // Remove markdown code blocks if present
    pattern = pattern.replace(/```\w*\n?/g, '');
    
    // Remove any explanatory text before the pattern
    const lines = pattern.split('\n');
    let startIndex = lines.findIndex(line => 
      line.trim().startsWith('setcps') || 
      line.trim().startsWith('$:') ||
      line.trim().includes('stack(')
    );
    
    if (startIndex === -1) startIndex = 0;
    
    // Take from the pattern start to the end
    const patternLines = lines.slice(startIndex);
    
    // Remove any trailing explanatory text
    let endIndex = patternLines.length;
    for (let i = patternLines.length - 1; i >= 0; i--) {
      const line = patternLines[i].trim();
      if (line && !line.startsWith('//') && !line.match(/^[A-Z]/)) {
        endIndex = i + 1;
        break;
      }
    }
    
    return patternLines.slice(0, endIndex).join('\n').trim();
  }

  /**
   * Helper to describe energy level
   */
  describeLevel(value) {
    if (value < 0.2) return 'very low';
    if (value < 0.4) return 'low';
    if (value < 0.6) return 'medium';
    if (value < 0.8) return 'high';
    return 'very high';
  }

  /**
   * Helper to describe brightness
   */
  describeBrightness(centroid) {
    if (centroid < 500) return 'very dark';
    if (centroid < 1000) return 'dark';
    if (centroid < 2000) return 'balanced';
    if (centroid < 4000) return 'bright';
    return 'very bright';
  }

}