import OpenAI from 'openai';

/**
 * Strudel pattern generator using LLM
 */
export class PatternGenerator {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate initial Strudel pattern from audio analysis
   */
  async generateFromAnalysis(analysis, artistName, songName) {
    const prompt = this.buildPrompt(analysis, artistName, songName);
    
    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an expert at creating Strudel (TidalCycles-like) live coding patterns. 
                    Generate patterns that accurately recreate songs based on audio analysis data.
                    Only respond with valid Strudel code, no explanations.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3, // Lower temperature for more deterministic output
    });
    
    return this.cleanPattern(completion.choices[0].message.content);
  }

  /**
   * Refine pattern based on comparison
   */
  async refinePattern(currentPattern, comparison, analysis) {
    const refinementPrompt = this.buildRefinementPrompt(
      currentPattern, 
      comparison, 
      analysis
    );
    
    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
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
      ],
      temperature: 0.2,
    });
    
    return this.cleanPattern(completion.choices[0].message.content);
  }

  /**
   * Build prompt for initial generation
   */
  buildPrompt(analysis, artistName, songName) {
    const { tempo, key, rhythm, features } = analysis;
    
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

Create a complete Strudel pattern that includes:
1. Drum pattern matching the detected rhythm
2. A bassline in the key of ${key}
3. Appropriate tempo setting
4. Any additional elements that match the energy and brightness levels

Use Strudel syntax with functions like s(), n(), stack(), setcps(), etc.`;
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
    
    // Remove any explanatory text
    const lines = pattern.split('\n');
    const codeLines = lines.filter(line => 
      line.trim() && !line.startsWith('//') && !line.match(/^[A-Z]/)
    );
    
    return codeLines.join('\n').trim();
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