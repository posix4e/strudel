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
   * Generate cover in dazzle mode with progressive pattern building
   */
  async generateCover(audioFile, artistName, songName, options = {}) {
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
        headless: false // Show browser for dazzle mode
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
  
  extractPattern(response) {
    // Remove any markdown code blocks first
    let cleaned = response
      .replace(/```javascript\n?/g, '')
      .replace(/```js\n?/g, '')
      .replace(/```strudel\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    // Check if the response contains $: (which is mini-notation)
    const dollarColonIndex = cleaned.indexOf('$:');
    if (dollarColonIndex !== -1) {
      // Remove the $: prefix - it's not valid JavaScript
      let pattern = cleaned.substring(dollarColonIndex + 2).trim();
      
      // Only cut off at explanation markers, not blank lines
      const explanationMarkers = [
        '\nExplanation:',
        '\nNote:',
        '\nThis pattern',
        '\nThe pattern',
        '\nI\'ve created',
        '\nI created',
        '\nHere\'s what',
        '\n---',
        '\n###',
        '\n##'
      ];
      
      let endIndex = pattern.length;
      for (const marker of explanationMarkers) {
        const idx = pattern.indexOf(marker);
        if (idx > 0 && idx < endIndex) {
          endIndex = idx;
        }
      }
      
      return pattern.substring(0, endIndex).trim();
    }
    
    // Return the cleaned pattern as-is (no $: prefix)
    return cleaned;
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