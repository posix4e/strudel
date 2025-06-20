/**
 * Dazzle Generator - Progressive pattern building with combined audio export
 * Builds patterns layer by layer and exports the combined result
 */

import chalk from 'chalk';
import { DazzleDashboard } from './dazzle-dashboard.js';
import { LLMProviderFactory } from './llm/index.js';
// import { PatternValidator } from './pattern-validator.js';
import StrudelAudioExport from '@strudel/audio-export';
import { exportPatternUsingStrudelCC } from '@strudel/audio-export/src/exporter-strudelcc.js';
import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { patternAudioAnalyzer } from './pattern-audio-analyzer.js';
import { rag } from './rag/index.js';
import { AdvancedAudioAnalyzer } from './advanced-analyzer.js';

export class DazzleGenerator {
  constructor(options = {}) {
    this.sparkleMode = options.sparkleMode || false;
    this.debug = options.debug || false;
    this.llmProvider = options.llmProvider || null;
    // this.validator = new PatternValidator();
    this.dashboard = options.dashboard || null;
    this.analyzer = new AdvancedAudioAnalyzer();
    
    // Track conversation history
    this.conversation = [];
    
    // Track current pattern being worked on
    this.currentPattern = null;
    
    // Track combined patterns for each section
    this.sectionPatterns = {};
    
    // Section configurations
    this.sections = {
      intro: {
        bars: 8,
        layers: {},
        combinedPattern: null,
        instruments: {
          buildOrder: ['atmosphere', 'drums', 'bass'],
          mappings: {
            atmosphere: { sounds: ['fm', 'sawtooth:0.3', 'sine:0.2'], style: 'ambient pad' },
            drums: { sounds: ['bd', 'hh', 'sn'], style: 'minimal' },
            bass: { sounds: ['fm:1', 'sawtooth:0.5'], style: 'sub bass' }
          }
        }
      },
      verse: {
        bars: 16,
        layers: {},
        combinedPattern: null,
        instruments: {
          buildOrder: ['drums', 'bass', 'chords'],
          mappings: {
            drums: { sounds: ['bd', 'sn', 'hh', 'oh'], style: 'steady groove' },
            bass: { sounds: ['fm:1', 'sawtooth:0.7'], style: 'melodic bassline' },
            chords: { sounds: ['fm:3', 'sawtooth:0.4'], style: 'harmonic progression' }
          }
        }
      },
      chorus: {
        bars: 16,
        layers: {},
        combinedPattern: null,
        instruments: {
          buildOrder: ['drums', 'bass', 'chords', 'lead'],
          mappings: {
            drums: { sounds: ['bd', 'sn', 'hh', 'oh', 'cp'], style: 'energetic' },
            bass: { sounds: ['fm:1', 'sawtooth:0.8'], style: 'driving bassline' },
            chords: { sounds: ['fm:3', 'sawtooth:0.5'], style: 'full chords' },
            lead: { sounds: ['fm:5', 'square:0.6'], style: 'melodic hook' }
          }
        }
      },
      bridge: {
        bars: 8,
        layers: {},
        combinedPattern: null,
        instruments: {
          buildOrder: ['atmosphere', 'bass', 'lead'],
          mappings: {
            atmosphere: { sounds: ['fm:7', 'triangle:0.3'], style: 'ethereal' },
            bass: { sounds: ['sine:0.8', 'fm:1'], style: 'minimal' },
            lead: { sounds: ['fm:5', 'sawtooth:0.4'], style: 'expressive' }
          }
        }
      },
      outro: {
        bars: 8,
        layers: {},
        combinedPattern: null,
        instruments: {
          buildOrder: ['atmosphere', 'drums'],
          mappings: {
            atmosphere: { sounds: ['fm:9', 'sine:0.2'], style: 'fading' },
            drums: { sounds: ['bd', 'hh'], style: 'sparse' }
          }
        }
      }
    };
  }

  /**
   * Initialize LLM provider
   */
  async initializeLLM() {
    if (this.llmProvider) return;
    
    throw new Error('LLM provider not configured. Please pass llmProvider in options.');
  }

  /**
   * Generate cover in dazzle mode with conversational approach
   */
  async generateCoverConversational(audioFile, artistName, songName, options = {}) {
    console.log(chalk.cyan(`\n🌟 Dazzle Mode: Conversational Pattern Building\n`));
    
    // Store artist and song info
    this.artistName = artistName;
    this.songName = songName;
    
    // Check for lyrics file - try different patterns
    const lyricsFiles = [
      `${artistName.toLowerCase()}-${songName.toLowerCase()}.txt`,
      `${songName.toLowerCase()}.txt`,
      `${artistName}-${songName}.txt`,
      `${songName}.txt`
    ];
    
    for (const lyricsFile of lyricsFiles) {
      if (existsSync(lyricsFile)) {
        console.log(chalk.green(`📝 Found lyrics file: ${lyricsFile}`));
        this.lyrics = await fs.readFile(lyricsFile, 'utf-8');
        break;
      }
    }
    
    // Initialize LLM
    await this.initializeLLM();
    
    // Initialize dashboard if not provided
    if (!this.dashboard) {
      this.dashboard = new DazzleDashboard();
      try {
        await this.dashboard.start();
      } catch (error) {
        if (error.code === 'EADDRINUSE') {
          console.log(chalk.yellow('Dashboard already running on port 8888'));
        } else {
          throw error;
        }
      }
    }
    
    try {
      // Analyze audio
      console.log(chalk.yellow('Analyzing audio...'));
      const analysis = await this.analyzeAudio(audioFile);
      
      // Extract musical features
      const { tempo, key, scale, features } = this.extractMusicalFeatures(analysis);
      
      // Store for later use
      this.tempo = tempo;
      this.key = key;
      this.scale = scale;
      this.features = features;
      
      // Update dashboard
      this.dashboard.setPhase(`${songName} by ${artistName} - ${tempo} BPM, Key: ${key}`);
      
      // Start conversation
      await this.startConversation(artistName, songName, tempo, key, features, analysis);
      
      // Build song through conversation
      await this.buildSongThroughConversation();
      
      // Export final result
      const outputPath = await this.exportConversationalResult(artistName, songName);
      
      console.log(chalk.green(`\n✅ Cover generated successfully: ${outputPath}`));
      
      return outputPath;
      
    } catch (error) {
      console.error(chalk.red('Error generating cover:'), error);
      throw error;
    }
  }
  
  /**
   * Start the conversation with context about the song
   */
  async startConversation(artistName, songName, tempo, key, features, analysis) {
    const initialPrompt = `Let's recreate "${artistName} - ${songName}" together using Strudel patterns.

Song Analysis:
- Tempo: ${tempo} BPM
- Key: ${key}
- Energy: ${features.energy < 0.3 ? 'Low/Ambient' : features.energy < 0.7 ? 'Medium' : 'High'}
- Style: ${this.inferStyle(artistName, songName, features)}

I'll help you build this song layer by layer. Let's start with a simple foundation and build from there.

First, let's create a basic drum pattern for the intro. What do you think would work well for this ${features.energy < 0.3 ? 'ambient' : 'energetic'} track at ${tempo} BPM in the key of ${key}?

Please provide just the Strudel code for the drum pattern, starting simple. Remember that Strudel patterns must be expressions, not variable declarations. For example:
- Good: stack(sound("bd*4"), sound("hh*8"))
- Not good: let drums = stack(...)

Note: Please use only basic drum sounds (bd, sd, hh, cp, etc.) without bank specifications to avoid loading issues.`;

    this.conversation.push({ role: 'user', content: initialPrompt });
    
    const response = await this.llmProvider.generateCompletion(this.conversation);
    this.conversation.push({ role: 'assistant', content: response });
    
    // Extract and test the pattern
    const pattern = await this.extractPattern(response);
    console.log(chalk.cyan('\nLLM suggests:'));
    console.log(chalk.gray(pattern));
    
    // Log to dashboard
    this.dashboard.addLLMInteraction('conversation-start', initialPrompt, response, pattern);
    this.dashboard.updateConversationStep('start', 'complete');
    this.dashboard.updateConversationStep('drums', 'active');
    
    // Test it
    await this.testPattern(pattern, 'initial-drums');
  }
  
  /**
   * Continue building the song through conversation
   */
  async buildSongThroughConversation() {
    // First, let's understand the song structure
    const structureStep = {
      prompt: `Now let's think about the song structure. "${this.songName}" by ${this.artistName} typically follows a specific structure. 
      
Based on the original song (${this.tempo} BPM, ${this.key} key), what would be an appropriate song structure? 
Consider sections like: intro, verse 1, pre-chorus, chorus, verse 2, bridge, final chorus, outro.

${this.lyrics ? `Here are the lyrics for reference:\n\n${this.lyrics}\n` : ''}

Please suggest:
1. The song structure (e.g., Intro → Verse → Chorus → Verse → Chorus → Bridge → Chorus → Outro)
2. How many bars each section should be
3. What makes each section distinct musically
4. Which lyrics go with which section (map the lyrics to the structure)`,
      name: "structure-planning",
      dashboardStep: "structure"
    };
    
    console.log(chalk.yellow(`\n${structureStep.prompt}`));
    
    this.conversation.push({ role: 'user', content: structureStep.prompt });
    const structureResponse = await this.llmProvider.generateCompletion(this.conversation);
    this.conversation.push({ role: 'assistant', content: structureResponse });
    
    // Extract structure information
    this.songStructure = await this.extractStructure(structureResponse);
    console.log(chalk.cyan('\nSong Structure:'));
    console.log(chalk.gray(JSON.stringify(this.songStructure, null, 2)));
    
    // Now build each section progressively
    const sections = this.songStructure.sections || [
      { name: 'intro', bars: 8 },
      { name: 'verse1', bars: 16 },
      { name: 'chorus', bars: 16 },
      { name: 'verse2', bars: 16 },
      { name: 'chorus2', bars: 16 },
      { name: 'bridge', bars: 8 },
      { name: 'finalChorus', bars: 16 },
      { name: 'outro', bars: 8 }
    ];
    
    // Build patterns for each section
    for (const section of sections) {
      await this.buildSection(section);
    }
    
    // Now create the full song arrangement
    await this.createFullArrangement(sections);
  }
  
  /**
   * Build a specific section through conversation
   */
  async buildSection(section) {
    console.log(chalk.yellow(`\n📍 Building ${section.name} section (${section.bars} bars)`));
    
    const sectionPrompt = `Let's build the ${section.name} section. This is ${section.bars} bars long.
${section.description || ''}
${section.lyrics ? `\nLyrics for this section:\n"${section.lyrics}"` : ''}

Based on what we've built so far, create patterns for this section that:
1. Match the energy and mood of a ${section.name}
2. Are ${section.bars} bars long
3. Have appropriate dynamics (${this.getSectionDynamics(section.name)})
4. Include variations to keep it interesting

Please provide:
- Drum pattern
- Bass pattern  
- Chord/harmony pattern
- Lead/melody pattern (if appropriate)
- Any atmospheric elements

Remember to make it fit with the ${this.tempo} BPM and ${this.key} key.`;

    this.conversation.push({ role: 'user', content: sectionPrompt });
    const response = await this.llmProvider.generateCompletion(this.conversation);
    this.conversation.push({ role: 'assistant', content: response });
    
    const pattern = await this.extractPattern(response);
    
    // Store section pattern
    section.pattern = pattern;
    
    // Test it
    await this.testPattern(pattern, section.name);
    
    // Get feedback and refine if needed
    try {
      const feedbackPrompt = `That ${section.name} section sounds ${this.generateSectionFeedback(section.name)}. 
${section.lyrics ? 'Make sure the rhythm and phrasing work well with the lyrics timing.' : ''}
Can you add a smooth transition at the end to lead into the next section?`;
      
      this.conversation.push({ role: 'user', content: feedbackPrompt });
      const refinedResponse = await this.llmProvider.generateCompletion(this.conversation);
      this.conversation.push({ role: 'assistant', content: refinedResponse });
      
      const refinedPattern = await this.extractPattern(refinedResponse);
      section.pattern = refinedPattern;
      
      // Test the refined pattern
      await this.testPattern(refinedPattern, `${section.name}-refined`);
      
    } catch (error) {
      // Enhanced error handling with intelligent feedback
      console.error(chalk.red(`Error with ${section.name} section: ${error.message}`));
      section.pattern = await this.handlePatternError(pattern, error, section);
    }
    
    // Update dashboard
    this.dashboard.updateConversationStep(section.name, 'complete');
  }
  
  /**
   * Create the full song arrangement
   */
  async createFullArrangement(sections) {
    console.log(chalk.yellow('\n🎵 Creating full song arrangement...'));
    
    const arrangementPrompt = `Now let's put it all together! We have these sections:
${sections.map(s => `- ${s.name}: ${s.bars} bars`).join('\n')}

Create a complete arrangement that:
1. Flows smoothly from section to section
2. Uses cat() or seq() to arrange sections in order
3. Includes smooth transitions between sections
4. If there are lyrics, add them as comments at the right moments
5. Make sure the total length matches the original song structure

The final pattern should play the complete song from start to finish.`;

    this.conversation.push({ role: 'user', content: arrangementPrompt });
    const response = await this.llmProvider.generateCompletion(this.conversation);
    this.conversation.push({ role: 'assistant', content: response });
    
    this.currentPattern = await this.extractPattern(response);
    
    // Add lyrics check
    if (this.songStructure.hasLyrics) {
      await this.addLyricsComments();
    }
  }
  
  /**
   * Extract structure from LLM response
   */
  async extractStructure(response) {
    const structurePrompt = `Extract the song structure from this response and format it as JSON:
${response}

Return a JSON object with:
{
  "sections": [
    { "name": "intro", "bars": 8, "description": "...", "lyrics": "..." },
    ...
  ],
  "hasLyrics": true/false
}`;

    const structureJson = await this.llmProvider.generateCompletion([
      { role: 'user', content: structurePrompt }
    ]);
    
    try {
      return JSON.parse(structureJson);
    } catch (e) {
      // Fallback structure
      return {
        sections: [
          { name: 'intro', bars: 8 },
          { name: 'verse1', bars: 16 },
          { name: 'chorus', bars: 16 },
          { name: 'verse2', bars: 16 },
          { name: 'chorus2', bars: 16 },
          { name: 'bridge', bars: 8 },
          { name: 'finalChorus', bars: 16 },
          { name: 'outro', bars: 8 }
        ],
        hasLyrics: false
      };
    }
  }
  
  /**
   * Add lyrics as comments to the pattern
   */
  async addLyricsComments() {
    const lyricsPrompt = `The song structure includes lyrics. Please add the lyrics as comments in the Strudel pattern at the appropriate timing.
Current pattern:
${this.currentPattern}

Add comments like:
// [Verse 1]
// "First line of lyrics here"
// "Second line of lyrics here"

Make sure the comments align with when those sections play in the pattern.`;

    this.conversation.push({ role: 'user', content: lyricsPrompt });
    const response = await this.llmProvider.generateCompletion(this.conversation);
    this.conversation.push({ role: 'assistant', content: response });
    
    this.currentPattern = await this.extractPattern(response);
  }
  
  /**
   * Get appropriate dynamics for a section
   */
  getSectionDynamics(sectionName) {
    const dynamics = {
      intro: 'build up gradually',
      verse: 'moderate energy, leave space for vocals',
      'pre-chorus': 'building tension',
      chorus: 'high energy, full arrangement',
      bridge: 'different feel, maybe breakdown or build',
      outro: 'winding down, fading out'
    };
    
    return dynamics[sectionName.toLowerCase().replace(/[0-9]/g, '')] || 'moderate energy';
  }
  
  /**
   * Generate contextual feedback for sections
   */
  generateSectionFeedback(sectionName) {
    const feedback = {
      intro: 'good! It sets the mood well',
      verse: 'nice! The groove works well',
      chorus: 'great! Very catchy and energetic',
      bridge: 'interesting! Good contrast to the other sections',
      outro: 'perfect! Nice way to end the song'
    };
    
    return feedback[sectionName.toLowerCase().replace(/[0-9]/g, '')] || 'good';
  }
  
  /**
   * Enhanced error handling with intelligent feedback to LLM
   */
  async handlePatternError(originalPattern, error, section) {
    console.log(chalk.yellow('🔧 Analyzing error and providing intelligent feedback to LLM...'));
    
    // Analyze the error type and context
    const errorAnalysis = this.analyzeError(error, originalPattern);
    
    // Create detailed, educational feedback
    const intelligentFeedback = `There was an issue with the ${section.name} pattern. Let me help you understand and fix it:

ORIGINAL PATTERN:
${originalPattern}

ERROR DETAILS:
${errorAnalysis.description}

SPECIFIC PROBLEM:
${errorAnalysis.specificIssue}

COMMON CAUSES:
${errorAnalysis.commonCauses.map(cause => `• ${cause}`).join('\n')}

SUGGESTED FIXES:
${errorAnalysis.suggestedFixes.map(fix => `• ${fix}`).join('\n')}

EXAMPLES OF CORRECT SYNTAX:
${errorAnalysis.examples.map(ex => `• ${ex.description}: ${ex.code}`).join('\n')}

Please provide a corrected version of the pattern that addresses these specific issues. 
Remember: ${errorAnalysis.keyReminder}`;

    this.conversation.push({ role: 'user', content: intelligentFeedback });
    
    // Try up to 3 times with increasingly specific feedback
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(chalk.cyan(`🔄 Error correction attempt ${attempt}/3`));
      
      const correctionResponse = await this.llmProvider.generateCompletion(this.conversation);
      this.conversation.push({ role: 'assistant', content: correctionResponse });
      
      const correctedPattern = await this.extractPattern(correctionResponse);
      
      try {
        // Test the corrected pattern
        await this.testPattern(correctedPattern, `${section.name}-fix-${attempt}`);
        console.log(chalk.green(`✅ Pattern fixed on attempt ${attempt}`));
        return correctedPattern;
        
      } catch (retryError) {
        console.log(chalk.yellow(`❌ Attempt ${attempt} failed: ${retryError.message}`));
        
        if (attempt < 3) {
          // Provide more specific feedback for next attempt
          const refinedFeedback = this.generateRefinedErrorFeedback(retryError, correctedPattern, attempt);
          this.conversation.push({ role: 'user', content: refinedFeedback });
        } else {
          // Final attempt failed - fall back to a simple working pattern
          console.log(chalk.red('🚨 All correction attempts failed. Using fallback pattern.'));
          return this.generateFallbackPattern(section);
        }
      }
    }
  }
  
  /**
   * Analyze error type and provide structured information
   */
  analyzeError(error, pattern) {
    const errorMessage = error.message.toLowerCase();
    
    // Parse console errors if available
    const consoleErrors = error.consoleErrors || [];
    const strudelErrors = consoleErrors.filter(err => 
      err.includes('[cyclist] error:') || err.includes('[eval] error:')
    );
    
    if (strudelErrors.length > 0) {
      const mainError = strudelErrors[0];
      
      // Syntax errors
      if (mainError.includes('unexpected') || mainError.includes('parse error')) {
        return {
          description: 'Syntax Error - The pattern has invalid Strudel syntax',
          specificIssue: mainError.replace('%c[cyclist] error: ', '').replace(' background-color: black;color:white;border-radius:15px', ''),
          commonCauses: [
            'Missing or extra parentheses/brackets',
            'Incorrect function names or syntax',
            'Invalid characters or formatting',
            'Missing commas between parameters'
          ],
          suggestedFixes: [
            'Check parentheses and bracket matching',
            'Verify all function names are spelled correctly',
            'Ensure proper comma placement',
            'Use only valid Strudel syntax'
          ],
          examples: [
            { description: 'Correct stack syntax', code: 'stack(sound("bd*4"), sound("hh*8"))' },
            { description: 'Correct sequence', code: 'seq("bd", "sd", "hh", "sd")' },
            { description: 'Correct note syntax', code: 'note("c3 e3 g3").sound("piano")' }
          ],
          keyReminder: 'Strudel patterns must be valid JavaScript expressions using Strudel functions'
        };
      }
      
      // Sound loading errors
      if (mainError.includes('sound') && mainError.includes('not found')) {
        const soundName = mainError.match(/sound "([^"]+)"/)?.[1] || 'unknown';
        return {
          description: 'Sound Loading Error - A sound sample could not be found',
          specificIssue: `The sound "${soundName}" is not available`,
          commonCauses: [
            'Sound name doesn\'t exist in the sample library',
            'Typo in sound name',
            'Using bank notation that isn\'t loaded',
            'Sound not yet loaded when pattern starts'
          ],
          suggestedFixes: [
            'Use basic drum sounds: bd, sd, hh, oh, cp, perc',
            'Avoid bank notation like "bd:3" - use just "bd"',
            'Check sound name spelling',
            'Use only common, reliable sample names'
          ],
          examples: [
            { description: 'Safe drum sounds', code: 'sound("bd sd hh oh")' },
            { description: 'Basic percussion', code: 'sound("perc*4")' },
            { description: 'Simple hi-hats', code: 'sound("hh*8")' }
          ],
          keyReminder: 'Stick to basic, common sound names without bank specifications'
        };
      }
      
      // Type errors (hap.value issues)
      if (mainError.includes('expected hap.value to be an object')) {
        return {
          description: 'Type Error - Pattern value is not in expected format',
          specificIssue: 'Values need to be processed through .sound(), .note(), or .s() functions',
          commonCauses: [
            'Missing .sound() after string patterns',
            'Missing .note() for note patterns', 
            'Incorrect value types passed to functions',
            'Raw strings without proper conversion'
          ],
          suggestedFixes: [
            'Add .sound() after drum patterns: "bd sd".sound()',
            'Add .note() after note patterns: "c3 e3".note()',
            'Use sound() function: sound("bd sd")',
            'Use note() function: note("c3 e3")'
          ],
          examples: [
            { description: 'Correct sound usage', code: 'sound("bd sd hh oh")' },
            { description: 'Correct note usage', code: 'note("c3 e3 g3 c4")' },
            { description: 'Pattern with .sound()', code: '"bd*4".sound()' }
          ],
          keyReminder: 'Always use proper Strudel functions like sound() and note() to convert strings'
        };
      }
    }
    
    // Generic error fallback
    return {
      description: 'Pattern Error - There\'s an issue with the pattern',
      specificIssue: error.message,
      commonCauses: [
        'Syntax error in the pattern',
        'Invalid function usage',
        'Missing required parameters',
        'Incorrect pattern structure'
      ],
      suggestedFixes: [
        'Check the pattern syntax carefully',
        'Verify all function calls are correct',
        'Ensure proper use of Strudel functions',
        'Test with simpler patterns first'
      ],
      examples: [
        { description: 'Simple drum pattern', code: 'sound("bd*4")' },
        { description: 'Basic stack', code: 'stack(sound("bd*4"), sound("hh*8"))' },
        { description: 'Note sequence', code: 'note("c3 d3 e3 f3")' }
      ],
      keyReminder: 'Keep patterns simple and use only well-tested Strudel syntax'
    };
  }
  
  /**
   * Generate more specific feedback for subsequent attempts
   */
  generateRefinedErrorFeedback(error, pattern, attemptNumber) {
    const errorAnalysis = this.analyzeError(error, pattern);
    
    return `The correction attempt ${attemptNumber} still has issues. Let's be more specific:

CURRENT ATTEMPT:
${pattern}

NEW ERROR:
${errorAnalysis.specificIssue}

This suggests the problem is: ${errorAnalysis.description}

For attempt ${attemptNumber + 1}, please:
1. Start with the simplest possible version that works
2. ${errorAnalysis.suggestedFixes[0]}
3. Test each function call individually
4. ${attemptNumber === 2 ? 'Focus on basic, proven patterns only' : 'Double-check syntax carefully'}

Example of what definitely works:
${errorAnalysis.examples[0].code}`;
  }
  
  /**
   * Generate a simple fallback pattern when all else fails
   */
  generateFallbackPattern(section) {
    const fallbackPatterns = {
      intro: 'sound("bd ~ ~ ~").slow(2)',
      verse: 'stack(sound("bd ~ sd ~"), sound("hh*4").gain(0.5))',
      chorus: 'stack(sound("bd*2 sd*2"), sound("hh*8").gain(0.6))',
      bridge: 'sound("bd ~ ~ sd").slow(2).gain(0.7)',
      outro: 'sound("bd ~ ~ ~").slow(4).gain(0.5)'
    };
    
    const fallback = fallbackPatterns[section.name.toLowerCase().replace(/[0-9]/g, '')] || 'sound("bd ~ sd ~")';
    console.log(chalk.blue(`🔧 Using fallback pattern: ${fallback}`));
    return fallback;
  }
  
  /**
   * MOVED: Generate feedback based on what was created
   */
  generateFeedback_OLD(stepName, success) {
    const feedbacks = {
      'bass': [
        "That bass line works perfectly with the drums!",
        "Nice groove! The bass really locks in with the kick pattern.",
        "Great low-end foundation!"
      ],
      'atmosphere': [
        "Those pads add a beautiful texture!",
        "Perfect atmospheric touch - really sets the mood.",
        "Love how spacious that sounds!"
      ],
      'chords': [
        "The harmonic progression fits perfectly!",
        "Those chords add great depth to the arrangement.",
        "Nice voicings - they sit well in the mix!"
      ],
      'lead': [
        "That melody is catchy!",
        "Great hook - it really stands out!",
        "The lead line adds the perfect focal point!"
      ],
      'full-combination': [
        "Everything blends together beautifully!",
        "The full arrangement sounds cohesive and balanced!",
        "All the elements work together perfectly!"
      ]
    };
    
    if (success && feedbacks[stepName]) {
      return feedbacks[stepName][Math.floor(Math.random() * feedbacks[stepName].length)];
    }
    
    return success ? "That sounds great!" : "Let's try to fix that.";
  }
  
  /**
   * Test a pattern by exporting it
   */
  async testPattern(pattern, name) {
    const filename = `test-${name}-${Date.now()}.webm`;
    const outputPath = path.join(process.cwd(), 'previews', filename);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    console.log(chalk.gray(`Testing ${name} pattern...`));
    
    // Send pattern to dashboard iframe
    if (this.dashboard && this.dashboard.sendPatternTest) {
      this.dashboard.sendPatternTest(pattern);
    }
    
    const result = await exportPatternUsingStrudelCC({
      pattern,
      output: outputPath,
      duration: 10,
      format: 'webm',
      headless: false, // Never headless
      dashboard: this.dashboard // Pass dashboard for visualization
    });
    
    if (!result.success) {
      const error = new Error(result.error || 'Pattern test failed');
      // Pass along console errors if available
      if (result.details && result.details.consoleErrors) {
        error.consoleErrors = result.details.consoleErrors;
        // Extract the actual error message from console
        const evalError = result.details.consoleErrors.find(e => e.includes('[eval] error:'));
        if (evalError) {
          error.message = evalError.replace('[eval] error:', '').trim();
        }
      }
      throw error;
    }
    
    return outputPath;
  }
  
  /**
   * Export the final conversational result
   */
  async exportConversationalResult(artistName, songName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${artistName}-${songName}-conversational-${timestamp}.webm`;
    const outputPath = path.join(process.cwd(), 'output', filename);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    console.log(chalk.cyan('\n🎵 Exporting final composition...'));
    
    const result = await exportPatternUsingStrudelCC({
      pattern: this.currentPattern,
      output: outputPath,
      duration: 180, // 3 minutes
      format: 'webm',
      headless: false, // Show browser for final export
      dashboard: this.dashboard // Pass dashboard for visualization
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Final export failed');
    }
    
    return outputPath;
  }

  /**
   * Generate cover in dazzle mode with progressive pattern building
   */
  async generateCover(audioFile, artistName, songName, options = {}) {
    // Use conversational approach
    return this.generateCoverConversational(audioFile, artistName, songName, options);
    console.log(chalk.cyan(`\n🌟 Dazzle Mode: Progressive Pattern Building\n`));
    
    // Initialize LLM
    await this.initializeLLM();
    
    // Initialize dashboard if not provided
    if (!this.dashboard) {
      this.dashboard = new DazzleDashboard();
      try {
        await this.dashboard.start();
      } catch (error) {
        if (error.code === 'EADDRINUSE') {
          console.log(chalk.yellow('Dashboard already running on port 8888'));
        } else {
          throw error;
        }
      }
    }
    
    // We'll use strudel.cc exporter for all audio exports
    
    try {
      // Analyze audio
      console.log(chalk.yellow('Analyzing audio...'));
      const analysis = await this.analyzeAudio(audioFile);
      
      // Extract musical features
      const { tempo, key, scale, features } = this.extractMusicalFeatures(analysis);
      
      // Store for later use
      this.tempo = tempo;
      this.key = key;
      this.scale = scale;
      this.features = features;
      
      // Update dashboard
      this.dashboard.setPhase(`${songName} by ${artistName} - ${tempo} BPM, Key: ${key}`);
      
      // Generate patterns section by section
      const sections = ['intro', 'verse', 'chorus', 'bridge', 'outro'];
      
      for (const sectionName of sections) {
        await this.generateSection(sectionName, tempo, scale, features, analysis, artistName, songName);
      }
      
      // Combine all sections
      console.log(chalk.cyan('\n🎵 Combining all sections...'));
      const fullPattern = await this.combineAllSections(tempo);
      
      // Export final audio
      console.log(chalk.cyan('\n🎧 Exporting final audio...'));
      const outputPath = await this.exportFinalAudio(fullPattern, artistName, songName);
      
      console.log(chalk.green(`\n✅ Cover generated successfully: ${outputPath}`));
      
      return outputPath;
      
    } catch (error) {
      console.error(chalk.red('Error generating cover:'), error);
      throw error;
    } finally {
      // Cleanup is handled by the main process
    }
  }

  /**
   * Generate a complete section with progressive pattern building
   */
  async generateSection(sectionName, tempo, scale, features, analysis, artistName, songName) {
    console.log(chalk.yellow(`\n📍 Generating ${sectionName} section...`));
    
    // Store artist and song for use in prompts
    this.artist = artistName;
    this.song = songName;
    
    const section = this.sections[sectionName];
    
    // Initialize section
    this.dashboard.setCurrentSection(sectionName);
    this.dashboard.setPhase(`Building ${sectionName} - ${section.bars} bars`);
    
    // Build layers progressively
    const { buildOrder } = section.instruments;
    let combinedPattern = null;
    
    for (const layer of buildOrder) {
      console.log(chalk.cyan(`  Building ${layer} layer...`));
      
      // Generate pattern for this layer
      const layerPattern = await this.generateLayerPattern(
        sectionName,
        layer,
        tempo,
        scale,
        features,
        analysis,
        artistName,
        songName,
        section.instruments.mappings[layer]
      );
      
      // Store individual layer
      section.layers[layer] = layerPattern;
      
      // Update dashboard
      this.dashboard.addPattern(sectionName, layer, layerPattern);
      
      // Combine with existing layers by asking LLM
      if (combinedPattern && layer !== buildOrder[0]) {
        console.log(chalk.cyan('  Combining layers...'));
        combinedPattern = await this.combineLayersWithLLM(
          Object.entries(section.layers).map(([name, pattern]) => ({ name, pattern }))
        );
      } else {
        combinedPattern = layerPattern;
      }
      
      // Test combined pattern (not individual layers)
      console.log(chalk.gray(`  Testing combined pattern with ${Object.keys(section.layers).length} layers...`));
      
      try {
        // Only export audio preview after we have at least 2 layers
        if (Object.keys(section.layers).length >= 2 || layer === buildOrder[buildOrder.length - 1]) {
          const previewPath = await this.generatePreviewAudio(
            sectionName,
            'combined',
            combinedPattern,
            `${Object.keys(section.layers).length}-layers`
          );
          
          console.log(chalk.gray(`  Preview generated: ${previewPath}`));
        }
      } catch (error) {
        console.error(chalk.red(`Preview generation failed: ${error.message}`));
        
        // Extract actual error from browser console if available
        let actualError = error.message;
        if (error.details && error.details.consoleErrors && error.details.consoleErrors.length > 0) {
          actualError = error.details.consoleErrors.join('\n');
          console.log(chalk.yellow('Console errors detected:'));
          error.details.consoleErrors.forEach(err => console.log(chalk.yellow(`  ${err}`)));
        }
        
        // Try to fix the combined pattern using conversation history
        console.log(chalk.cyan('Attempting to fix pattern with LLM...'));
        const fixedPattern = await this.fixPatternWithLLM(combinedPattern, actualError, sectionName, layer);
        
        if (fixedPattern && fixedPattern !== combinedPattern) {
          combinedPattern = fixedPattern;
          
          // Update stored patterns
          section.combinedPattern = combinedPattern;
          
          // Try to export again
          try {
            console.log(chalk.cyan('Retrying export with fixed pattern...'));
            const previewPath = await this.generatePreviewAudio(
              sectionName,
              'combined-fixed',
              combinedPattern,
              `${Object.keys(section.layers).length}-layers`
            );
            console.log(chalk.green(`  Preview generated after fix: ${previewPath}`));
          } catch (retryError) {
            console.error(chalk.red(`Still failed after fix: ${retryError.message}`));
            // Continue anyway - the show must go on!
          }
        }
      }
      
      // Update progress
      const progress = ((buildOrder.indexOf(layer) + 1) / buildOrder.length) * 100;
      this.dashboard.updateProgress(Math.floor(progress));
    }
    
    // Store final combined pattern for section
    section.combinedPattern = combinedPattern;
    
    // Mark section complete
    console.log(chalk.green(`✓ Completed ${sectionName} section`));
  }

  /**
   * Generate pattern for a specific layer
   */
  async generateLayerPattern(sectionType, layer, tempo, scale, features, analysis, artistName, songName, instrumentMapping) {
    // Use pattern audio analyzer to find matching patterns
    const targetAnalysis = {
      tempo,
      key: scale.key,
      features: {
        energy: features.energy || 0.5,
        spectralCentroid: features.brightness || 500
      },
      genre: this.inferStyle(artistName, songName, features)
    };
    
    // Find matching patterns from database
    const matchingPatterns = patternAudioAnalyzer.findMatchingPatterns(targetAnalysis, {
      preferredTags: this.getLayerTags(layer),
      complexity: this.getSectionComplexity(sectionType),
      limit: 3
    });
    
    // Get the actual pattern code for each match
    const examples = matchingPatterns.map(match => ({
      pattern: {
        name: match.pattern.name,
        code: patternAudioAnalyzer.getPatternContent(match.pattern.id)
      }
    })).filter(ex => ex.pattern.code); // Only include patterns with code
    
    // Build prompt
    const prompt = this.buildLayerPrompt(
      sectionType, 
      layer, 
      tempo, 
      scale, 
      features, 
      instrumentMapping,
      examples
    );
    
    // Keep conversation history for error fixing
    const messages = [{
      role: 'user',
      content: prompt
    }];
    
    // Log prompt concisely
    console.log(chalk.yellow(`\n📝 Generating ${layer} pattern...`));
    console.log(chalk.gray(`Prompt preview: ${prompt.substring(0, 200)}...`));
    
    // Generate pattern
    const response = await this.llmProvider.generateCompletion(messages);
    
    // Log response length
    console.log(chalk.cyan(`📨 LLM responded with ${response.length} characters`));
    
    let pattern = this.extractPattern(response);
    
    // Log extraction result
    console.log(chalk.green(`✅ Extracted pattern: ${pattern.length} characters`));
    
    // Send full details to dashboard
    if (this.dashboard) {
      this.dashboard.addLLMInteraction(layer, prompt, response, pattern);
    }
    
    // Store the conversation for potential error fixing
    this.layerConversations = this.layerConversations || {};
    this.layerConversations[`${sectionType}-${layer}`] = {
      messages: [...messages, { role: 'assistant', content: response }],
      lastPattern: pattern
    };
    
    return pattern;
  }

  /**
   * Combine multiple patterns into one
   */
  combinePatterns(patterns) {
    // Just combine what we have without modifying
    const validPatterns = patterns.filter(p => p && p.trim());
    
    if (validPatterns.length === 0) return '';
    if (validPatterns.length === 1) return validPatterns[0];
    
    // Let the LLM handle the combination in the next iteration
    return validPatterns.join('\n\n');
  }

  /**
   * Generate preview audio for a pattern
   */
  async generatePreviewAudio(sectionType, layerName, pattern, suffix) {
    const filename = `${sectionType}-${layerName}-${suffix}.webm`;
    const outputPath = path.join(process.cwd(), 'previews', filename);
    
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      
      // Log the pattern being exported
      console.log(chalk.yellow(`Exporting ${layerName} preview using strudel.cc...`));
      console.log(chalk.gray('Pattern to export:'));
      console.log(chalk.gray(pattern));
      
      // Always use strudel.cc for full compatibility
      const result = await exportPatternUsingStrudelCC({
        pattern,
        output: outputPath,
        duration: 15, // 15 second preview
        format: 'webm',
        headless: false, // Show browser for dazzle mode
        dashboard: this.dashboard // Pass dashboard for visualization
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Export failed');
      }
      
      console.log(chalk.green(`✓ Preview generated: ${filename}`));
      return outputPath;
    } catch (error) {
      console.error(chalk.red(`Audio export failed for ${layerName}: ${error.message}`));
      
      // Log more details if available
      if (error.details) {
        console.error(chalk.red('Error details:'), error.details);
        if (error.details.consoleErrors) {
          console.error(chalk.red('Console errors:'));
          error.details.consoleErrors.forEach(err => console.error(chalk.red(`  ${err}`)));
        }
      }
      
      // Include console errors in the error for upstream handling
      if (error.details && error.details.consoleErrors) {
        error.consoleErrors = error.details.consoleErrors;
      }
      
      throw error;
    }
  }

  /**
   * Ask LLM to combine multiple layer patterns
   */
  async combineLayersWithLLM(layers) {
    const prompt = `Combine these patterns using stack():

${layers.map(l => `// ${l.name}
${l.pattern}`).join('\n\n')}

IMPORTANT: Return ONLY Strudel code.
- Start with "$:"
- Use stack() to combine the patterns
- NO markdown blocks (no \`\`\`)
- NO explanations
- Just the code`;

    const response = await this.llmProvider.generateCompletion([{
      role: 'user',
      content: prompt
    }]);
    
    return this.extractPattern(response);
  }
  
  /**
   * Fix a pattern that's causing errors
   */
  async fixPatternWithLLM(pattern, errorMessage, sectionType, layer) {
    console.log(chalk.yellow('Asking LLM to fix pattern...'));
    
    const prompt = `Fix this Strudel pattern error:

Error: ${errorMessage}

Pattern:
${pattern}

IMPORTANT: Return ONLY the fixed Strudel code.
- Start with "$:"
- NO markdown blocks (no \`\`\`)
- NO explanations
- Just the corrected code`;

    const response = await this.llmProvider.generateCompletion([{
      role: 'user',
      content: prompt
    }]);
    
    return this.extractPattern(response);
  }

  /**
   * Combine all sections into final pattern
   */
  async combineAllSections(tempo) {
    const sectionOrder = ['intro', 'verse', 'chorus', 'verse', 'chorus', 'bridge', 'chorus', 'outro'];
    const patterns = [];
    
    for (const sectionName of sectionOrder) {
      const section = this.sections[sectionName];
      if (section.combinedPattern) {
        // Wrap section pattern with timing
        const bars = section.bars;
        const sectionPattern = `$: ${section.combinedPattern}\n.slow(${bars})`;
        patterns.push(sectionPattern);
      }
    }
    
    // Create sequential pattern
    return patterns.join('\n.seq(\n') + '\n' + ')'.repeat(patterns.length - 1);
  }

  /**
   * Export final audio
   */
  async exportFinalAudio(pattern, artistName, songName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${artistName}-${songName}-dazzle-${timestamp}.webm`;
    const outputPath = path.join(process.cwd(), 'output', filename);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    // Always use strudel.cc for full compatibility
    console.log(chalk.cyan('Exporting final audio using strudel.cc...'));
    const result = await exportPatternUsingStrudelCC({
      pattern,
      output: outputPath,
      duration: 180, // 3 minutes
      format: 'webm',
      headless: false // Show browser for dazzle mode
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Final export failed');
    }
    
    return outputPath;
  }

  // Helper methods...
  
  getLayerTags(layer) {
    const tagMap = {
      drums: ['drums', 'kick', 'bd', 'sn', 'hh'],
      bass: ['bass', 'sub'],
      chords: ['chords', 'harmony'],
      lead: ['lead', 'melody'],
      atmosphere: ['atmosphere', 'pad', 'ambient']
    };
    return tagMap[layer] || [];
  }
  
  getSectionComplexity(sectionType) {
    const complexityMap = {
      intro: 'simple',
      verse: 'medium',
      chorus: 'medium',
      bridge: 'complex',
      outro: 'simple'
    };
    return complexityMap[sectionType] || 'medium';
  }
  
  buildLayerPrompt(sectionType, layer, tempo, scale, features, instrumentMapping, examples) {
    // Pick the best example to show
    const bestExample = examples.length > 0 ? examples[0] : null;
    
    let prompt = `You are creating a Strudel pattern to recreate "${this.artist} - ${this.song}".

CONTEXT:
- Building the ${sectionType.toUpperCase()} section (${this.sections[sectionType].bars} bars)
- Currently working on: ${layer} layer (${instrumentMapping.style})
- Musical parameters: ${tempo} BPM, Key: ${scale.key}
- Style: ${this.inferStyle(this.artist, this.song, features)}
- Energy level: ${features.energy < 0.3 ? 'low/ambient' : features.energy < 0.7 ? 'medium' : 'high'}

`;

    // Add section-specific guidance
    const sectionGuidance = {
      intro: 'Start sparse and atmospheric, gradually building tension',
      verse: 'Establish the main groove and harmonic foundation',
      chorus: 'Full energy with all elements, memorable and catchy',
      bridge: 'Create contrast, maybe breakdown or build-up',
      outro: 'Wind down, return to sparse elements'
    };
    
    prompt += `SECTION GOAL: ${sectionGuidance[sectionType] || 'Create an engaging pattern'}

`;

    if (bestExample && bestExample.pattern.code) {
      // Show just one good example
      prompt += `REFERENCE PATTERN (similar style):
${bestExample.pattern.code}

`;
    }

    // Layer-specific instructions
    const layerInstructions = {
      atmosphere: 'Create ambient pads, textures, and space',
      drums: 'Build the rhythmic foundation - kick, snare, hats',
      bass: 'Provide low-end support and groove',
      chords: 'Add harmonic content and progression',
      lead: 'Create melodic interest and hooks'
    };

    prompt += `YOUR TASK: Generate a ${layer} pattern that ${layerInstructions[layer] || 'fits the section'}.

IMPORTANT: Return ONLY the Strudel code. 
- NO markdown code blocks (no \`\`\`)
- NO explanations before or after
- NO comments
- Just the raw Strudel code that can be played directly`;

    return prompt;
  }
  
  async extractPattern(response) {
    // Use LLM to extract the code and convert explanations to comments
    const extractionPrompt = `Convert the following response into valid Strudel code.

Rules:
1. Extract all Strudel pattern code
2. Convert any explanatory text BEFORE or AFTER code into Strudel comments (using // syntax)
3. Keep the comments concise and relevant to understanding the pattern
4. Remove any markdown formatting (like \`\`\`)
5. The result must be valid, executable Strudel code

Response to convert:
${response}

IMPORTANT: Return ONLY Strudel code with comments. Do not add any additional explanation.`;

    const cleanPattern = await this.llmProvider.generateCompletion([
      { role: 'user', content: extractionPrompt }
    ]);
    
    // Basic cleanup just in case
    return cleanPattern
      .replace(/```javascript\n?/g, '')
      .replace(/```js\n?/g, '')
      .replace(/```strudel\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
  }
  
  inferStyle(artistName, songName, features) {
    // Simple style inference
    if (artistName.toLowerCase().includes('grimes')) return 'electronic';
    if (features.energy > 0.7) return 'energetic';
    if (features.energy < 0.3) return 'ambient';
    return 'general';
  }
  
  async fixPattern(pattern, errors) {
    const prompt = `Fix these errors in the Strudel pattern:
    
Errors: ${errors.join(', ')}

Pattern:
${pattern}

Return only the fixed pattern.`;

    const response = await this.llmProvider.generateCompletion([{
      role: 'user',
      content: prompt
    }]);
    
    return this.extractPattern(response);
  }
  
  async analyzeAudio(audioFile) {
    // Use the actual audio analyzer
    const analysis = await this.analyzer.analyzeAdvanced(audioFile);
    return {
      tempo: analysis.tempo || 120,
      key: analysis.key || 'C',
      energy: analysis.energy || 0.5,
      brightness: analysis.spectralCentroid || 500,
      ...analysis
    };
  }
  
  extractMusicalFeatures(analysis) {
    return {
      tempo: analysis.tempo || 120,
      key: analysis.key || 'C',
      scale: { key: analysis.key || 'C', mode: 'major' },
      features: {
        energy: analysis.energy || 0.5,
        brightness: analysis.brightness || 500
      }
    };
  }
}