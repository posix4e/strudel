import { LLMProviderFactory } from './llm/index.js';
import { sparkleEnhance } from './visualizers.js';
import { keyToMidi, getScaleMidiNumbers } from './note-converter.js';
import { DRUM_PATTERNS, selectDrumPattern, generateDrumStack } from './drum-patterns.js';
import { ensureCorrectTempo, extractTempo } from './tempo-utils.js';

/**
 * Strudel pattern generator using LLM
 */
export class PatternGenerator {
  constructor(llmProvider, options = {}) {
    this.llmProvider = llmProvider;
    this.sparkleMode = options.sparkle || false;
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
    await this.initializeLLM();
    const prompt = this.buildPrompt(analysis, artistName, songName);
    
    const messages = [
      {
        role: "system",
        content: `You are an expert at creating Strudel live coding patterns. 
                  Generate patterns that accurately recreate songs based on audio analysis data.
                  Use Strudel syntax, NOT TidalCycles. Key differences:
                  - Use setcps() not cps
                  - Use s() for samples, n() for notes
                  - Use .stack() not $ and #
                  - Chain methods with dots
                  Only respond with valid Strudel JavaScript code, no explanations.`
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
        content: `You are an expert at refining Strudel patterns to match target songs.
                  Adjust the provided pattern based on the comparison data.
                  Only respond with valid Strudel code, no explanations.`
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
  buildPrompt(analysis, artistName, songName) {
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

Create a Strudel pattern for this song. Be creative and use multiple layers to capture the essence of the music.

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

Available Strudel features to use:
- Drums: s("bd"), s("sd"), s("hh"), s("cp"), s("oh"), s("rd"), s("sh")
- Synths: s("sawtooth"), s("square"), s("triangle"), s("sine")
- Effects: .gain(), .room(), .delay(), .pan(), .speed(), .slow(), .fast()
- Patterns: Can use *, /, <>, [], ~ for complex rhythms
- Notes: Use n() with MIDI numbers (60 = C4, 72 = C5)

Suggested drum pattern (${suggestedDrumPattern.description}):
${generateDrumStack(suggestedDrumPattern, 0.6)}

Example pattern structure:
setcps(${tempo}/60/4)
$: stack(
  // Drums
  ${generateDrumStack(suggestedDrumPattern, 0.7)},
  // Bass (root notes)
  n("${scale.root - 24} ~ ${scale.root - 12} ~").s("sawtooth").gain(0.4).lpf(800),
  // Chords/pads
  n("<${scale.root} ${scale.third} ${scale.fifth}>").s("square").gain(0.2).room(0.5),
  // Lead melody
  n("~ ${scale.root + 12} ~ ${scale.fifth + 12}").s("triangle").gain(0.3).delay(0.25)
).room(0.3)

Create something that captures the feel of "${songName}" by ${artistName}.`;
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