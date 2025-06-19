import { AudioAnalyzer } from './analyzer.js';
import { PatternGenerator } from './generator.js';
import { LLMProviderFactory } from './llm/index.js';
import { SparkleMode } from './sparkle.js';
import { DazzleMode } from './dazzle.js';
import { SongStructureAnalyzer } from './structure-analyzer.js';
import { OutputManager } from './output-manager.js';
import StrudelAudioExport from '@strudel/audio-export';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { analyzePatternError, buildErrorRecoveryPrompt, createFallbackPattern } from './error-recovery.js';

/**
 * StrudelCover - AI-powered song recreation in Strudel
 */
export class StrudelCover {
  constructor(options = {}) {
    this.options = options;
    
    // Sparkle mode!
    this.sparkleMode = options.sparkle || false;
    this.sparkle = this.sparkleMode ? new SparkleMode() : null;
    
    // Dazzle mode!
    this.dazzleMode = options.dazzle || false;
    this.dazzle = this.dazzleMode ? new DazzleMode() : null;
    
    // Complex mode for full songs
    this.complexMode = options.complex || false;
    
    this.analyzer = new AudioAnalyzer();
    
    this.exporter = new StrudelAudioExport({ 
      headless: !this.sparkleMode && !this.dazzleMode, // Show browser in sparkle and dazzle modes
      duration: 30 // Default to 30 seconds
    });
    
    // Auto mode defaults
    this.autoMode = options.autoMode !== false; // Default to true
    this.maxIterations = options.maxIterations || 5;
    this.targetScore = options.targetScore || 80;
    
    // Per-metric thresholds (used when autoMode is false)
    this.thresholds = {
      tempo: options.thresholds?.tempo || 5,        // Max BPM difference
      key: options.thresholds?.key !== false,       // Must match? (boolean)
      energy: options.thresholds?.energy || 0.1,    // Max energy difference
      brightness: options.thresholds?.brightness || 0.2, // Max brightness difference  
      kickSimilarity: options.thresholds?.kickSimilarity || 0.7,    // Min similarity
      snareSimilarity: options.thresholds?.snareSimilarity || 0.7,  // Min similarity
      ...options.thresholds // Allow overrides
    };
    
    // Metric weights for scoring
    this.weights = {
      tempo: options.weights?.tempo || 0.3,
      key: options.weights?.key || 0.2,
      energy: options.weights?.energy || 0.1,
      brightness: options.weights?.brightness || 0.1,
      kickSimilarity: options.weights?.kickSimilarity || 0.15,
      snareSimilarity: options.weights?.snareSimilarity || 0.15,
      ...options.weights // Allow overrides
    };
    
    this.outputDir = options.outputDir || './strudelcover-output';
    
    // Create output directory
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Initialize LLM provider
   */
  async initializeLLM() {
    if (this.generator) return; // Already initialized
    
    let llmProvider;
    
    // Legacy support - if openaiKey provided, use OpenAI
    if (this.options.openaiKey) {
      llmProvider = await LLMProviderFactory.create('openai', { 
        apiKey: this.options.openaiKey,
        model: this.options.model 
      });
    } 
    // New way - explicit provider configuration
    else if (this.options.llm) {
      if (typeof this.options.llm === 'string') {
        // Simple provider name, must have API key in env or config
        const envKey = `${this.options.llm.toUpperCase()}_API_KEY`;
        const apiKey = this.options.llmConfig?.apiKey || process.env[envKey];
        
        if (!apiKey && this.options.llm !== 'ollama') {
          throw new Error(`${this.options.llm} requires API key via llmConfig.apiKey or ${envKey} env var`);
        }
        
        llmProvider = await LLMProviderFactory.create(this.options.llm, {
          apiKey,
          ...this.options.llmConfig
        });
      } else {
        // Direct provider instance
        llmProvider = this.options.llm;
      }
    } else {
      throw new Error('LLM configuration required. Use options.openaiKey (legacy) or options.llm');
    }
    
    this.generator = new PatternGenerator(llmProvider, { 
      sparkle: this.sparkleMode,
      complex: this.complexMode 
    });
  }

  /**
   * Main cover generation function
   */
  async cover(songPath, artistName, songName, options = {}) {
    // Initialize output manager
    this.outputManager = new OutputManager(this.outputDir, artistName, songName);
    
    // Store current song info
    this.currentArtistName = artistName;
    this.currentSongName = songName;
    
    this.outputManager.log(`Starting StrudelCover for "${songName}" by ${artistName}`);
    
    // Use dazzle mode if enabled
    if (this.dazzleMode) {
      return this.dazzleCover(songPath, artistName, songName, options);
    }
    // Initialize LLM provider if not already done
    await this.initializeLLM();
    
    if (this.sparkleMode) {
      await this.sparkle.showIntro();
      await this.sparkle.glitchEffect();
    }
    
    console.log(chalk.blue(`\n🎵 StrudelCover: "${songName}" by ${artistName}\n`));
    
    try {
      // Step 1: Analyze original song
      console.log(chalk.gray('Analyzing original audio...'));
      const originalAnalysis = await this.analyzer.analyze(songPath);
      
      // Save analysis
      this.outputManager.saveAnalysis('basic_analysis', originalAnalysis);
      
      if (this.sparkleMode) {
        await this.sparkle.showAnalysisVisualization(originalAnalysis);
      } else {
        this.logAnalysis('Original', originalAnalysis);
      }
      
      // Step 2: Generate initial pattern
      console.log(chalk.gray('\nGenerating initial Strudel pattern...'));
      
      if (this.sparkleMode) {
        const prompt = this.generator.buildPrompt(originalAnalysis, artistName, songName);
        await this.sparkle.showLLMThinking(prompt);
      }
      
      let pattern = await this.generator.generateFromAnalysis(
        originalAnalysis, 
        artistName, 
        songName
      );
      
      if (this.sparkleMode) {
        this.sparkle.showGeneratedCode(pattern);
      } else {
        console.log(chalk.green('Initial pattern:'));
        console.log(chalk.gray(pattern));
      }
      
      // Step 3: Iterative refinement
      let iteration = 0;
      let bestPattern = pattern;
      let bestScore = 0;
      let history = [];
      
      while (iteration < this.maxIterations) {
        console.log(chalk.blue(`\n--- Iteration ${iteration + 1} ---`));
        
        // Create iteration directory
        const { iterDir } = this.outputManager.createIterationDirectory();
        
        // Export current pattern to audio
        const audioPath = join(iterDir, 'audio.wav');
        const patternPath = join(iterDir, 'pattern.strudel');
        console.log(chalk.gray('Exporting pattern to audio...'));
        
        // Save pattern file
        writeFileSync(patternPath, pattern, 'utf8');
        
        if (this.sparkleMode) {
          await this.sparkle.showExportProgress(Math.min(originalAnalysis.duration, 30));
        }
        
        let exportResult;
        let errorRecoveryAttempts = 0;
        const maxErrorRecovery = 2;
        
        while (errorRecoveryAttempts <= maxErrorRecovery) {
          try {
            exportResult = await this.exporter.exportToFile(pattern, audioPath, {
              duration: Math.min(originalAnalysis.duration, 30),
              format: 'wav'
            });
            
            // Check if export failed due to silence
            if (!exportResult || exportResult === false) {
              throw new Error('Pattern is generating silence');
            }
            
            break; // Success, exit loop
            
          } catch (error) {
            console.log(chalk.red(`\n⚠️  Export failed: ${error.message}`));
            
            if (error.message.includes('silence') && errorRecoveryAttempts < maxErrorRecovery) {
              errorRecoveryAttempts++;
              console.log(chalk.yellow(`\n🔧 Attempting error recovery (${errorRecoveryAttempts}/${maxErrorRecovery})...`));
              
              // Analyze the error
              const errorAnalysis = analyzePatternError(pattern, error.details);
              console.log(chalk.gray('Detected issues:'));
              errorAnalysis.errors.forEach(e => console.log(chalk.gray(`  - ${e}`)));
              
              // Try to fix with LLM
              const recoveryPrompt = buildErrorRecoveryPrompt(pattern, errorAnalysis, originalAnalysis);
              pattern = await this.generator.fixPatternError(recoveryPrompt, originalAnalysis);
              
              // Save the fixed pattern
              writeFileSync(patternPath + `.fix${errorRecoveryAttempts}`, pattern, 'utf8');
              console.log(chalk.green('Generated fixed pattern, retrying...'));
              
            } else if (errorRecoveryAttempts >= maxErrorRecovery) {
              // Final fallback
              console.log(chalk.red('\n❌ Error recovery failed. Using fallback pattern...'));
              pattern = createFallbackPattern(originalAnalysis.tempo, originalAnalysis.key);
              writeFileSync(patternPath + '.fallback', pattern, 'utf8');
              
              await this.exporter.exportToFile(pattern, audioPath, {
                duration: Math.min(originalAnalysis.duration, 30),
                format: 'wav'
              });
              break;
            } else {
              throw error; // Re-throw if not a silence error
            }
          }
        }
        
        // Analyze generated audio
        console.log(chalk.gray('Analyzing generated audio...'));
        const generatedAnalysis = await this.analyzer.analyze(audioPath);
        
        // Compare analyses with custom weights if provided
        const comparison = this.analyzer.compareAnalyses(
          originalAnalysis, 
          generatedAnalysis,
          this.autoMode ? null : this.weights
        );
        
        history.push({
          iteration,
          pattern,
          score: comparison.score,
          comparison,
          audioPath
        });
        
        if (this.sparkleMode) {
          this.sparkle.showComparison(comparison);
        } else {
          console.log(chalk.yellow(`Score: ${comparison.score}/100`));
          this.logComparison(comparison);
        }
        
        // Update best if improved
        if (comparison.score > bestScore) {
          bestScore = comparison.score;
          bestPattern = pattern;
        }
        
        // Check if target reached
        const targetReached = this.autoMode 
          ? comparison.score >= this.targetScore
          : this.checkThresholds(comparison);
          
        if (targetReached) {
          console.log(chalk.green(`\n✅ Target ${this.autoMode ? 'score' : 'thresholds'} reached!`));
          break;
        }
        
        // Refine pattern
        if (iteration < this.maxIterations - 1) {
          console.log(chalk.gray('\nRefining pattern...'));
          pattern = await this.generator.refinePattern(
            pattern,
            comparison,
            originalAnalysis
          );
          console.log(chalk.green('Refined pattern:'));
          console.log(chalk.gray(pattern));
        }
        
        iteration++;
      }
      
      // Save final results
      const results = {
        artistName,
        songName,
        originalAnalysis,
        bestPattern,
        bestScore,
        history,
        finalAudioPath: join(this.outputDir, 'final.wav')
      };
      
      // Export final pattern
      await this.exporter.exportToFile(bestPattern, results.finalAudioPath, {
        duration: Math.min(originalAnalysis.duration, 30),
        format: 'wav'
      });
      
      // Save final pattern to file
      const finalPatternPath = join(this.outputDir, 'final.strudel');
      
      // Apply sparkle enhancement to the final pattern if sparkle mode is enabled
      let finalPattern = bestPattern;
      if (this.sparkleMode) {
        const { sparkleEnhance } = await import('./visualizers.js');
        finalPattern = sparkleEnhance(bestPattern);
      }
      
      writeFileSync(finalPatternPath, finalPattern);
      
      console.log(chalk.green(`\n✨ StrudelCover Complete!`));
      console.log(chalk.gray(`Final score: ${bestScore}/100`));
      console.log(chalk.gray(`Pattern saved to: ${finalPatternPath}`));
      console.log(chalk.gray(`Audio saved to: ${results.finalAudioPath}`));
      
      return results;
      
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      throw error;
    }
  }

  /**
   * Log analysis results
   */
  logAnalysis(label, analysis) {
    console.log(chalk.cyan(`\n${label} Analysis:`));
    console.log(`  Tempo: ${analysis.tempo} BPM`);
    console.log(`  Key: ${analysis.key}`);
    console.log(`  Duration: ${analysis.duration.toFixed(1)}s`);
    console.log(`  Energy: ${analysis.features.energy.toFixed(3)}`);
    console.log(`  Brightness: ${analysis.features.spectralCentroid.toFixed(0)} Hz`);
  }

  /**
   * Log comparison results
   */
  logComparison(comparison) {
    console.log(chalk.cyan('Comparison:'));
    console.log(`  Tempo difference: ${comparison.tempoDiff} BPM`);
    console.log(`  Key match: ${comparison.keyMatch ? '✓' : '✗'}`);
    console.log(`  Energy difference: ${comparison.energyDiff.toFixed(3)}`);
    console.log(`  Brightness difference: ${comparison.brightnessDiff.toFixed(3)}`);
    console.log(`  Kick similarity: ${(comparison.kickSimilarity * 100).toFixed(0)}%`);
    console.log(`  Snare similarity: ${(comparison.snareSimilarity * 100).toFixed(0)}%`);
  }
  
  /**
   * Check if all thresholds are met (manual mode)
   */
  checkThresholds(comparison) {
    const checks = {
      tempo: comparison.tempoDiff <= this.thresholds.tempo,
      key: !this.thresholds.key || comparison.keyMatch,
      energy: comparison.energyDiff <= this.thresholds.energy,
      brightness: comparison.brightnessDiff <= this.thresholds.brightness,
      kickSimilarity: comparison.kickSimilarity >= this.thresholds.kickSimilarity,
      snareSimilarity: comparison.snareSimilarity >= this.thresholds.snareSimilarity
    };
    
    // Log threshold status
    console.log(chalk.cyan('Threshold Status:'));
    Object.entries(checks).forEach(([metric, passed]) => {
      console.log(`  ${metric}: ${passed ? chalk.green('✓') : chalk.red('✗')}`);
    });
    
    // All must pass
    return Object.values(checks).every(passed => passed);
  }

  /**
   * Dazzle mode - Visual hierarchical song construction
   * Builds: Analysis → Structure → Sections → Measures → Layers → Full Song
   */
  async dazzleCover(songPath, artistName, songName, options = {}) {
    // Output manager and song info already initialized in cover()
    
    // Initialize
    await this.initializeLLM();
    await this.dazzle.initialize();
    await this.dazzle.updateSongInfo(artistName, songName);
    
    console.log(chalk.magenta('\n🎪 Dazzle Mode Activated!\n'));
    console.log(chalk.gray('Analyzing song structure and building hierarchically...\n'));
    
    try {
      // Step 1: Basic audio analysis
      console.log(chalk.gray('Step 1: Performing basic audio analysis...'));
      const analysis = await this.analyzer.analyze(songPath);
      this.analysis = analysis; // Store for use in generateLayerPattern
      
      // Save analysis
      this.outputManager.saveAnalysis('basic_analysis', analysis);
      
      await this.dazzle.updateTempo(analysis.tempo);
      await this.dazzle.updateStatus('Analyzing basic audio features...');
      await this.dazzle.updateProgress(5);
      
      // Step 2: Search for musical information online
      console.log(chalk.gray('Step 2: Searching for musical information online...'));
      await this.dazzle.updateStatus('Searching for chords and musical info...');
      let musicalInfo = null;
      try {
        musicalInfo = await this.searchMusicInfo(this.currentArtistName, this.currentSongName);
        if (musicalInfo) {
          this.outputManager.saveAnalysis('musical_info', musicalInfo);
          console.log(chalk.green('✓ Found musical information:'));
          if (musicalInfo.key) console.log(chalk.gray(`  Key: ${musicalInfo.key}`));
          if (musicalInfo.chords) console.log(chalk.gray(`  Chords: ${musicalInfo.chords}`));
          if (musicalInfo.tempo) console.log(chalk.gray(`  Tempo: ${musicalInfo.tempo} BPM`));
          
          // Store for later use in pattern generation
          this.musicalInfo = musicalInfo;
        }
      } catch (error) {
        console.log(chalk.yellow('⚠ Could not find musical information online'));
      }
      
      await this.dazzle.updateProgress(10);
      
      // Step 3: Deep structural analysis
      console.log(chalk.gray('Step 3: Analyzing song structure...'));
      await this.dazzle.updateStatus('Detecting song sections and structure...');
      
      const structureAnalyzer = new SongStructureAnalyzer();
      const songStructure = await structureAnalyzer.analyzeStructure(songPath, analysis.duration);
      
      // Save structure analysis
      this.outputManager.saveAnalysis('structure_analysis', songStructure);
      
      console.log(chalk.blue('Detected structure:'));
      console.log(chalk.gray(`Form: ${songStructure.songForm}`));
      console.log(chalk.gray(`Sections: ${songStructure.sections.length}`));
      console.log(chalk.gray(`Total bars: ${songStructure.sections.reduce((sum, s) => sum + s.bars, 0)}`));
      
      await this.dazzle.updateProgress(15);
      
      // Step 4: Visualize detected sections
      console.log(chalk.gray('Step 4: Visualizing song structure...'));
      const sections = songStructure.sections;
      
      // Add sections to dashboard with enhanced info
      for (const section of sections) {
        await this.dazzle.addSection({
          id: section.type + '-' + sections.indexOf(section),
          name: section.type.charAt(0).toUpperCase() + section.type.slice(1),
          measures: section.bars,
          duration: section.endTime - section.startTime,
          energy: section.energy,
          characteristics: section.characteristics
        });
        await this.sleep(300);
      }
      
      await this.dazzle.updateProgress(20);
      
      // Step 5: Analyze each section for layers
      console.log(chalk.gray('Step 5: Analyzing section layers...'));
      await this.dazzle.updateStatus('Detecting instrumental layers...');
      
      const sectionLayers = [];
      for (const section of sections) {
        // Analyze section characteristics to determine layers
        const layers = await this.analyzeSectionLayers(section, analysis);
        sectionLayers.push({
          section,
          layers
        });
      }
      
      await this.dazzle.updateProgress(30);
      
      // Step 6: Build patterns hierarchically
      console.log(chalk.gray('Step 6: Building patterns layer by layer...'));
      console.log(chalk.magenta('🎵 Starting interactive pattern building - you\'ll hear the song grow!\n'));
      
      const outputDir = options.outputDir || 'dazzle-output';
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }
      
      // Use the structure's tempo (from aubio) instead of the basic analysis
      const actualTempo = songStructure.tempo || analysis.tempo;
      console.log(chalk.gray(`Using tempo: ${actualTempo} BPM`));
      let fullBuiltPattern = 'setcps(' + actualTempo + '/60/4)\n\n';
      const builtSections = [];
      let totalProgress = 30;
      let currentLivePattern = ''; // Currently playing pattern
      let accumulatedLayers = []; // All layers built so far
      let isFirstPattern = true;
      let loopDuration = 4; // Start with 4 beat loops
      let globalPatternParts = []; // Accumulate ALL patterns across sections
      
      // Process up to 4 sections to avoid timeout
      const maxSections = Math.min(4, sectionLayers.length);
      console.log(chalk.gray(`Processing ${maxSections} of ${sectionLayers.length} sections`));
      
      for (let sectionIdx = 0; sectionIdx < maxSections; sectionIdx++) {
        const { section, layers } = sectionLayers[sectionIdx];
        const sectionId = section.type + '-' + sectionIdx;
        
        await this.dazzle.selectSection(sectionId);
        
        // Stop playback between sections (except for the first)
        if (sectionIdx > 0) {
          console.log(chalk.gray('\n🛑 Stopping playback before next section...'));
          await this.dazzle.stopContinuousPlay();
          await this.sleep(1000); // Brief pause
        }
        
        // Fun section transition messages
        const transitionMessages = {
          intro: '🎅 Opening the sonic portal...',
          verse: '🎸 Laying down the groove...',
          chorus: '🎆 Here comes the hook!',
          bridge: '🌉 Building a bridge to the stars...',
          outro: '🌇 Fading into the sunset...',
          drop: '💥 DROPPING THE BASS!',
          build: '🚀 Building up the energy...'
        };
        
        const message = transitionMessages[section.type] || `🎵 Creating ${section.type}...`;
        console.log(chalk.cyan(`\n${message}`));
        await this.dazzle.updateStatus(message);
        
        // Add instrument tracks based on layers
        for (const layer of layers) {
          await this.dazzle.addInstrumentTrack({
            id: layer.id,
            name: layer.name
          });
          await this.sleep(200);
        }
        
        // Build each measure
        let sectionPattern = '';
        let sectionMeasures = [];
        const measuresPerSection = section.bars;
        
        // Create iteration directory for this section
        const { iterDir, layersDir } = this.outputManager.createIterationDirectory();
        console.log(chalk.cyan(`  📂 Section: ${section.type}`));
        
        // Process 1 complete measure per section
        const actualMeasures = 1;
        
        for (let measure = 0; measure < actualMeasures; measure++) {
          console.log(chalk.gray(`  - Building ${section.type} measure ${measure + 1}/${actualMeasures}`));
          await this.dazzle.highlightMeasure(measure);
          await this.dazzle.updateStatus(`Building ${section.type}`);
          await this.dazzle.updateDetailedStatus(section.type, measure, null);
          
          // Build this measure layer by layer WITH PLAYBACK
          let measurePatterns = [];
          let accumulatedSectionPattern = ''; // Pattern for this section so far
          
          // Start playback if this is the first layer
          let playbackStarted = false;
          
          for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
            const layer = layers[layerIdx];
            
            // Update detailed status for current layer
            await this.dazzle.highlightLayer(layer.id);
            await this.dazzle.updateDetailedStatus(section.type, measure, layer.name);
            
            console.log(chalk.magenta(`\n🎵 Adding ${layer.name} (${layerIdx + 1}/${layers.length})`));
            
            // Generate pattern for this layer and measure with retry logic
            let layerPattern = null;
            let retries = 0;
            const maxRetries = 3;
            
            // Pass context of existing layers to the generator
            const existingPatterns = measurePatterns.map(mp => `${mp.layerName}: ${mp.pattern}`).join('\n');
            
            while (retries < maxRetries) {
              try {
                layerPattern = await this.generateLayerPatternWithContext(
                  layer, 
                  section, 
                  measure, 
                  analysis, 
                  existingPatterns,
                  retries > 0
                );
                
                // Don't clean up - let errors happen and learn from them
                // layerPattern = this.cleanupPattern(layerPattern);
                
                // Validate the pattern before using it
                const validationError = this.validatePattern(layerPattern);
                if (validationError) {
                  console.log(chalk.yellow(`  ⚠️  ${layer.name}: ${validationError}`));
                  this.lastPatternError = validationError;
                  retries++;
                  continue;
                }
                
                // Pattern is valid
                break;
              } catch (error) {
                console.log(chalk.yellow(`  ⚠️  ${layer.name}: ${error.message}`));
                retries++;
                if (retries >= maxRetries) {
                  // Use a safe fallback pattern
                  console.log(chalk.yellow(`  🔄 Using fallback for ${layer.name}`));
                  layerPattern = this.getFallbackPattern(layer);
                }
              }
            }
            
            if (layerPattern && layerPattern.trim()) {
              // Save the layer pattern
              this.outputManager.saveLayerPattern(iterDir, layer.id, layerPattern);
              
              // Add visual block
              await this.dazzle.addPatternBlock(layer.id, layerPattern, 60);
              
              // Add to measure patterns
              measurePatterns.push({
                pattern: layerPattern,
                layerName: layer.name
              });
              
              // Build accumulated pattern with all layers so far
              const patterns = measurePatterns.map(mp => mp.pattern);
              accumulatedSectionPattern = patterns.length > 1 
                ? `stack(\n  ${patterns.join(',\n  ')}\n)`
                : patterns[0] || '';
              
              // Test the pattern before playing it
              const testResult = await this.dazzle.testPattern(accumulatedSectionPattern);
              if (!testResult.success) {
                console.log(chalk.red(`  ❌ Runtime error in pattern: ${testResult.error}`));
                // Remove the last pattern that caused the error
                measurePatterns.pop();
                // Set error for retry
                this.lastPatternError = `Runtime error: ${testResult.error}`;
                // Force a retry with this specific error
                retries = 0; // Reset retries for this specific runtime error
                continue;
              }
              
              // Start or update continuous playback
              if (accumulatedSectionPattern) {
                if (!playbackStarted) {
                  console.log(chalk.cyan('\n🎶 Starting playback with first layer...'));
                  await this.dazzle.startContinuousPlay(accumulatedSectionPattern);
                  playbackStarted = true;
                  await this.sleep(2000); // Let first layer play for 2 seconds
                } else {
                  console.log(chalk.cyan(`🎶 Adding ${layer.name} to the mix...`));
                  await this.dazzle.updateContinuousPattern(accumulatedSectionPattern);
                  await this.sleep(2000); // Let combined pattern play for 2 seconds
                }
              }
              
              await this.sleep(100);
            }
          }
          
          // Let the complete section play for a bit longer
          if (playbackStarted && measurePatterns.length > 0) {
            console.log(chalk.green(`\n✨ Playing complete ${section.type} pattern...`));
            await this.sleep(5000); // Play complete section for 5 seconds
          }
          
          // Build measure pattern
          const patterns = measurePatterns.map(mp => mp.pattern);
          let measurePattern = patterns.length > 1 
            ? `stack(\n  ${patterns.join(',\n  ')}\n)`
            : patterns[0] || '';
          
          // Get the last layer name for status
          const lastLayerName = measurePatterns.length > 0 
            ? measurePatterns[measurePatterns.length - 1].layerName 
            : 'pattern';
          
          // Update current pattern for continuous preview
          if (measurePattern) {
            // Add this measure to accumulated layers
            accumulatedLayers.push(measurePattern);
            
            // NOTE: The layer-by-layer playback is now handled in the loop above
            // This section is for any additional processing after all layers are complete
          }
          
          // Accumulate section pattern
          if (measurePattern) {
            if (!sectionMeasures) {
              sectionMeasures = [];
            }
            sectionMeasures.push(measurePattern);
          }
          
          // Update progress
          const sectionProgress = ((measure + 1) / measuresPerSection) * (50 / sectionLayers.length);
          await this.dazzle.updateProgress(totalProgress + sectionProgress);
        }
        
        // Combine measures for this section
        if (sectionMeasures.length > 0) {
          // If we have multiple measures, sequence them
          if (sectionMeasures.length > 1) {
            sectionPattern = `cat(\n  ${sectionMeasures.join(',\n  ')}\n)`;
          } else {
            sectionPattern = sectionMeasures[0];
          }
          
          // Save the complete section pattern
          this.outputManager.savePattern('section_pattern.strudel', sectionPattern, join('iterations', `iteration_${String(this.outputManager.iterationCount).padStart(3, '0')}`));
          
          // Section is complete - stop playback before moving to next
          await this.dazzle.stopContinuousPlay();
        }
        
        // Save section pattern with proper comment
        const sectionComment = `// ${section.type.toUpperCase()} (${section.bars} bars, ${section.energy.toFixed(2)} energy)\n`;
        builtSections.push({
          name: section.type.charAt(0).toUpperCase() + section.type.slice(1),
          code: sectionComment + (sectionPattern || '// (empty section)'),
          type: section.type,
          bars: section.bars
        });
        
        // Update code display
        await this.dazzle.updatePatternCode(builtSections);
        
        // Add to full pattern
        if (sectionPattern) {
          fullBuiltPattern += sectionComment;
          fullBuiltPattern += sectionPattern + '\n\n';
        }
        
        totalProgress += 50 / sectionLayers.length;
        await this.dazzle.updateProgress(totalProgress);
      }
      
      // Step 7: Combine all sections into final pattern
      console.log(chalk.gray('Step 7: Combining sections into full song...'));
      await this.dazzle.updateStatus('Assembling final pattern...');
      
      // Build the complete pattern with proper sequencing
      const finalPattern = await this.buildSequencedPattern(builtSections, analysis, songStructure);
      
      // Save final pattern - both in outputDir and in the structured location
      const patternFile = join(outputDir, 'pattern.strudel');
      writeFileSync(patternFile, finalPattern);
      
      // Also save to the structured output
      this.outputManager.savePattern('pattern.strudel', finalPattern, 'final');
      
      await this.dazzle.updateProgress(90);
      
      // Stop continuous playback and add grand finale
      await this.dazzle.updateStatus('🎆 Finalizing your masterpiece...');
      await this.sleep(2000);
      await this.dazzle.stopContinuousPlay();
      
      console.log(chalk.green('\n✨ Dazzle mode complete!'));
      await this.dazzle.updateStatus('🎉 Song construction complete! Listen to your creation!');
      await this.dazzle.updateProgress(100);
      
      // Play the full pattern once
      console.log(chalk.magenta('\n🎶 Playing complete song...'));
      await this.dazzle.updateStatus('🎶 Playing complete song...');
      const fullPreviewPattern = `setcps(${analysis.tempo}/60/4)\n${finalPattern.split('setcps')[1]}`;
      await this.dazzle.previewPattern(fullPreviewPattern, 20000); // Play for 20 seconds
      
      // Export the final audio
      console.log(chalk.cyan('\n📦 Exporting audio file...'));
      await this.dazzle.updateStatus('📦 Exporting final audio...');
      
      const audioFile = join(outputDir, 'dazzle-output.wav');
      const exportDuration = Math.min(60, songStructure.duration); // Export up to 60 seconds
      
      try {
        await this.exporter.exportToFile(finalPattern, audioFile, {
          duration: exportDuration,
          format: 'wav'
        });
        console.log(chalk.green(`\n✅ Audio exported: ${audioFile}`));
        await this.dazzle.updateStatus(`✅ Audio exported to ${audioFile}`);
      } catch (error) {
        console.log(chalk.yellow(`\n⚠️  Export failed: ${error.message}`));
        console.log(chalk.gray('Pattern saved, but audio export failed'));
      }
      
      // Show where files were saved
      console.log(chalk.green('\n📁 Output Directory Structure:'));
      console.log(chalk.white(`   Base: ${this.outputManager.sessionDir}`));
      console.log(chalk.gray(`   ├── analysis/`));
      console.log(chalk.gray(`   │   ├── basic_analysis.json`));
      console.log(chalk.gray(`   │   └── structure_analysis.json`));
      console.log(chalk.gray(`   ├── iterations/ (${this.outputManager.iterationCount} sections processed)`));
      console.log(chalk.gray(`   │   └── iteration_XXX/`));
      console.log(chalk.gray(`   │       ├── layers/ (individual instruments)`));
      console.log(chalk.gray(`   │       └── section_pattern.strudel`));
      console.log(chalk.gray(`   ├── final/`));
      console.log(chalk.white(`   │   ├── pattern.strudel`));
      console.log(chalk.white(`   │   └── dazzle-output.wav`));
      console.log(chalk.gray(`   └── logs/`));
      console.log(chalk.gray(`       └── console.log`));
      console.log(chalk.cyan(`\n💡 To play the pattern in Strudel, copy from: ${patternFile}`));
      
      return {
        pattern: finalPattern,
        audioFile,
        patternFile,
        analysis,
        structure: songStructure
      };
      
    } finally {
      await this.sleep(5000); // Let user see the final result
      await this.dazzle.close();
    }
  }
  
  /**
   * Build a properly sequenced pattern from sections
   */
  async buildSequencedPattern(builtSections, analysis, songStructure) {
    let pattern = `// "${songStructure.songForm}" - Auto-generated by Dazzle Mode
// Tempo: ${songStructure.tempo} BPM, Key: ${songStructure.key || analysis.key}
// Duration: ${Math.floor(songStructure.duration)}s
// Sections: ${builtSections.length}

// Load samples
await samples('github:tidalcycles/dirt-samples')

setcps(${songStructure.tempo}/60/4)

`;
    
    // Extract unique patterns from sections
    const uniquePatterns = new Map();
    let patternIndex = 0;
    
    builtSections.forEach(section => {
      const sectionCode = section.code.replace(/^\/\/.*\n/, '').trim();
      if (sectionCode && sectionCode !== '// (empty section)') {
        // Check if we've seen this pattern before
        let found = false;
        for (const [key, value] of uniquePatterns) {
          if (value.code === sectionCode) {
            found = true;
            section.patternRef = key;
            break;
          }
        }
        
        if (!found) {
          const patternName = `pattern${patternIndex++}`;
          uniquePatterns.set(patternName, {
            code: sectionCode,
            type: section.name
          });
          section.patternRef = patternName;
        }
      }
    });
    
    // Define unique patterns
    for (const [name, data] of uniquePatterns) {
      pattern += `// ${data.type} pattern\n`;
      pattern += `const ${name} = ${data.code}\n\n`;
    }
    
    // Build sequence
    const sequence = builtSections
      .filter(s => s.patternRef)
      .map(s => s.patternRef);
    
    if (sequence.length > 0) {
      // Repeat the sequence to make it longer
      const repeats = Math.max(2, Math.floor(16 / sequence.length)); // At least 2 repeats
      const fullSequence = [];
      for (let i = 0; i < repeats; i++) {
        fullSequence.push(...sequence);
      }
      
      pattern += '// Full song sequence (looped for longer playback)\n';
      pattern += `$: cat(${fullSequence.join(', ')}).room(0.2).gain(0.8)\n`;
    }
    
    return pattern;
  }

  /**
   * Parse AI-generated pattern into individual layers
   */
  parsePatternLayers(fullPattern) {
    const layers = [];
    const colors = ['#ff006e', '#8338ec', '#3a86ff', '#06ffa5', '#ffbe0b', '#ff006e'];
    let colorIndex = 0;
    
    // Parse stack() structure
    const stackMatch = fullPattern.match(/stack\s*\(([\s\S]*)\)/);
    if (stackMatch) {
      // Split by commas that are not inside parentheses
      const parts = this.splitPattern(stackMatch[1]);
      
      parts.forEach((part, i) => {
        const trimmed = part.trim();
        if (trimmed) {
          // Identify component type
          let component = 'Unknown';
          let name = `Layer ${i + 1}`;
          
          if (trimmed.includes('bd') || trimmed.includes('kick')) {
            component = 'Drums';
            name = 'Kick';
          } else if (trimmed.includes('sd') || trimmed.includes('cp') || trimmed.includes('snare')) {
            component = 'Drums';
            name = 'Snare';
          } else if (trimmed.includes('hh') || trimmed.includes('hat')) {
            component = 'Drums';
            name = 'Hi-hats';
          } else if (trimmed.match(/note.*[0-2]\d/) || trimmed.includes('bass')) {
            component = 'Bass';
            name = 'Bass line';
          } else if (trimmed.match(/note.*[4-7]\d/) || trimmed.includes('lead')) {
            component = 'Melody';
            name = 'Lead';
          } else if (trimmed.includes('pad') || trimmed.includes('room')) {
            component = 'Pads';
            name = 'Atmosphere';
          }
          
          layers.push({
            pattern: trimmed,
            component,
            name,
            color: colors[colorIndex % colors.length]
          });
          colorIndex++;
        }
      });
    } else {
      // Single pattern, not stacked
      layers.push({
        pattern: fullPattern.trim(),
        component: 'Main',
        name: 'Full pattern',
        color: colors[0]
      });
    }
    
    return layers;
  }

  /**
   * Split pattern by commas at the correct nesting level
   */
  splitPattern(pattern) {
    const parts = [];
    let current = '';
    let depth = 0;
    
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i];
      
      if (char === '(') depth++;
      else if (char === ')') depth--;
      
      if (char === ',' && depth === 0) {
        parts.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current) parts.push(current);
    return parts;
  }

  /**
   * Identify components from parsed layers
   */
  identifyComponentsFromLayers(layers) {
    const componentMap = new Map();
    
    layers.forEach(layer => {
      if (!componentMap.has(layer.component)) {
        componentMap.set(layer.component, {
          name: layer.component,
          details: `Contains ${layer.name}`,
          layers: []
        });
      }
      componentMap.get(layer.component).layers.push(layer.name);
    });
    
    // Convert to array and enhance details
    return Array.from(componentMap.values()).map(comp => ({
      name: comp.name,
      details: `${comp.layers.length} layer${comp.layers.length > 1 ? 's' : ''}: ${comp.layers.join(', ')}`
    }));
  }

  /**
   * Generate structured song with AI
   */
  async generateStructuredSong(analysis, artistName, songName) {
    // Use the generator's existing method which handles complex mode
    return await this.generator.generateFromAnalysis(
      analysis, 
      artistName, 
      songName
    );
  }

  /**
   * Parse song sections from AI-generated pattern
   */
  parseSongSections(pattern) {
    // For complex mode patterns, extract structure from comments
    const structureMatch = pattern.match(/SONG STRUCTURE:\n([\s\S]*?)\*\//);
    if (structureMatch) {
      const sections = [];
      const structureLines = structureMatch[1].split('\n');
      
      structureLines.forEach((line, index) => {
        const match = line.match(/\d+\.\s+(\w+(?:\s+\w+)?)\s+\((\d+)\s+bars\)/);
        if (match) {
          const [, name, bars] = match;
          sections.push({
            id: `section-${index}`,
            name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
            type: name.toLowerCase().replace(/\s+\d+/, ''), // Remove numbers from type
            measures: parseInt(bars),
            duration: (parseInt(bars) * 4 * 60) / 120, // Default duration
            pattern: pattern // Use the full pattern for now
          });
        }
      });
      
      if (sections.length > 0) {
        return sections;
      }
    }
    
    // Fallback to old parsing method for non-complex patterns
    const sections = [];
    const lines = pattern.split('\n');
    let currentSection = null;
    let sectionPattern = '';
    let sectionId = 0;
    
    for (const line of lines) {
      // Check for section markers
      const sectionMatch = line.match(/\/\/\s*(INTRO|VERSE|CHORUS|BRIDGE|OUTRO|BREAK|DROP|BUILD|PRECHORUS|HOOK|DEVELOPMENT|CLIMAX|RESOLUTION|CODA).*?(\d+)?\s*\((\d+)\s*bars?\)/i);
      
      if (sectionMatch) {
        // Save previous section
        if (currentSection && sectionPattern.trim()) {
          currentSection.pattern = sectionPattern.trim();
          sections.push(currentSection);
        }
        
        // Start new section
        const [, type, number, bars] = sectionMatch;
        const name = number ? `${type} ${number}` : type;
        currentSection = {
          id: `section-${sectionId++}`,
          name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
          type: type.toLowerCase(),
          measures: parseInt(bars),
          duration: (parseInt(bars) * 4 * 60) / 120, // Default 120 BPM, will be updated later
          pattern: ''
        };
        sectionPattern = '';
      } else if (currentSection) {
        sectionPattern += line + '\n';
      }
    }
    
    // Don't forget the last section
    if (currentSection && sectionPattern.trim()) {
      currentSection.pattern = sectionPattern.trim();
      sections.push(currentSection);
    }
    
    // If no sections found, create a default one
    if (sections.length === 0) {
      sections.push({
        id: 'section-0',
        name: 'Main',
        type: 'main',
        measures: 16,
        duration: 32,
        pattern: pattern
      });
    }
    
    return sections;
  }

  /**
   * Parse instruments from a section pattern
   */
  parseInstruments(pattern) {
    const instruments = [];
    const seen = new Set();
    
    // Common instrument patterns
    const instrumentPatterns = [
      { regex: /bd|kick/i, id: 'kick', name: 'Kick' },
      { regex: /sd|snare|cp/i, id: 'snare', name: 'Snare' },
      { regex: /hh|hat/i, id: 'hihat', name: 'Hi-Hat' },
      { regex: /bass|sub/i, id: 'bass', name: 'Bass' },
      { regex: /lead|melody/i, id: 'lead', name: 'Lead' },
      { regex: /pad|chord/i, id: 'pad', name: 'Pad' },
      { regex: /arp/i, id: 'arp', name: 'Arpeggio' }
    ];
    
    for (const inst of instrumentPatterns) {
      if (inst.regex.test(pattern) && !seen.has(inst.id)) {
        instruments.push(inst);
        seen.add(inst.id);
      }
    }
    
    // If no instruments detected, add a generic one
    if (instruments.length === 0) {
      instruments.push({ id: 'pattern', name: 'Pattern' });
    }
    
    return instruments;
  }

  /**
   * Extract pattern for specific instrument and measure
   */
  extractMeasurePattern(instrument, sectionPattern, measureIndex, totalMeasures) {
    // Look for the pattern with stack() wrapper removed
    let cleanPattern = sectionPattern;
    
    // Remove outer stack() if present
    const stackMatch = sectionPattern.match(/stack\s*\(([^]*)\)/);
    if (stackMatch) {
      cleanPattern = stackMatch[1];
    }
    
    // Split by lines and look for instrument patterns
    const lines = cleanPattern.split('\n').map(l => l.trim()).filter(l => l);
    
    for (const line of lines) {
      // Skip comments and empty lines
      if (line.startsWith('//') || !line) continue;
      
      // Remove trailing commas
      let cleanLine = line.replace(/,\s*$/, '');
      
      // Check if this line matches the instrument
      if (instrument.regex && instrument.regex.test(cleanLine)) {
        // For drums, we can split the pattern by measure
        if (instrument.id === 'kick' || instrument.id === 'hihat' || instrument.id === 'snare') {
          // Simple division - in reality you'd parse more carefully
          return cleanLine;
        }
        
        return cleanLine;
      }
    }
    
    return null;
  }

  /**
   * Analyze section characteristics to determine what layers it should have
   */
  async analyzeSectionLayers(section, analysis) {
    const layers = [];
    
    // Core rhythm section - always include drums for most sections
    if (section.type !== 'intro' && section.type !== 'outro') {
      layers.push({ id: 'kick', name: 'Kick', type: 'drums' });
      
      if (section.energy > 0.3) {
        layers.push({ id: 'snare', name: 'Snare', type: 'drums' });
      }
      
      if (section.characteristics.percussiveness > 0.4) {
        layers.push({ id: 'hihat', name: 'Hi-Hat', type: 'drums' });
      }
      
      // Add more percussion for energetic sections
      if (section.energy > 0.7) {
        layers.push({ id: 'percussion', name: 'Percussion', type: 'drums' });
      }
    }
    
    // Bass foundation
    if (section.type === 'verse' || section.type === 'chorus' || section.type === 'bridge') {
      layers.push({ id: 'bass', name: 'Bass', type: 'bass' });
      
      // Add sub-bass for powerful sections
      if (section.energy > 0.6) {
        layers.push({ id: 'sub', name: 'Sub Bass', type: 'bass' });
      }
    }
    
    // Harmonic layers - be more generous with harmonies
    if (section.type === 'verse' || section.type === 'chorus' || section.type === 'bridge') {
      layers.push({ id: 'chords', name: 'Chords', type: 'harmony' });
      
      if (section.type === 'chorus' || section.type === 'drop' || section.energy > 0.5) {
        layers.push({ id: 'pad', name: 'Pad', type: 'harmony' });
      }
      
      // Add arpeggios for interesting sections
      if (section.characteristics.brightness > 0.5) {
        layers.push({ id: 'arp', name: 'Arpeggio', type: 'harmony' });
      }
    }
    
    // Lead/melody layers
    if (section.type === 'chorus' || section.type === 'hook' || section.characteristics.brightness > 0.5) {
      layers.push({ id: 'lead', name: 'Lead', type: 'melody' });
      
      // Add counter-melody for complex sections
      if (section.energy > 0.6) {
        layers.push({ id: 'counter', name: 'Counter-melody', type: 'melody' });
      }
    }
    
    // Atmospheric and textural elements
    if (section.type === 'intro' || section.type === 'outro' || section.type === 'breakdown' || section.energy < 0.4) {
      layers.push({ id: 'atmosphere', name: 'Atmosphere', type: 'fx' });
    }
    
    // Add ambient layers for spacious sections
    if (section.characteristics.fullness < 0.5) {
      layers.push({ id: 'ambient', name: 'Ambient', type: 'fx' });
    }
    
    // Ensure we always have at least 3 layers for interesting composition
    if (layers.length < 3) {
      layers.push({ id: 'texture', name: 'Texture', type: 'fx' });
    }
    
    return layers;
  }
  
  /**
   * Validate a pattern for common errors
   */
  validatePattern(pattern) {
    if (!pattern || !pattern.trim()) {
      return "Pattern is empty";
    }
    
    // Just basic syntax check - let runtime errors teach the LLM
    return null;
      return ".every() needs two parameters: .every(n, x => x.something())";
    }
    
    // Check for + operator (should use stack() or commas)
    if (pattern.includes(' + ')) {
      return "Don't use + to combine patterns. Use stack() or commas inside stack()";
    }
    
    // Check for malformed function calls
    if (pattern.match(/\.(range|slow|fast)\s*\([^)]*,[^)]*,[^)]*\)/)) {
      return "Invalid function arguments (too many parameters)";
    }
    
    // Check for unclosed parentheses/brackets
    const openParens = (pattern.match(/\(/g) || []).length;
    const closeParens = (pattern.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      return "Unmatched parentheses";
    }
    
    const openBrackets = (pattern.match(/\[/g) || []).length;
    const closeBrackets = (pattern.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      return "Unmatched brackets";
    }
    
    return null; // No errors
  }
  
  /**
   * Get a safe fallback pattern for a layer
   */
  getFallbackPattern(layer) {
    const fallbacks = {
      kick: 's("bd*4").gain(0.5)',
      snare: 's("~ sn ~ sn").gain(0.4)',
      hihat: 's("hh*8").gain(0.2)',
      percussion: 's("~ ~ perc ~").gain(0.3)',
      bass: 'note("c2 ~ g2 ~").s("sawtooth").gain(0.4)',
      sub: 'note("c1*2").s("sine").gain(0.5)',
      chords: 'note("<[c4,e4,g4] [f4,a4,c5]>").s("square").gain(0.3)',
      pad: 'note("[c4,e4,g4]").s("sine").room(0.8).gain(0.2)',
      arp: 'note("c4 e4 g4 c5").fast(2).s("triangle").gain(0.3)',
      lead: 'note("c5 ~ e5 ~ g5 ~").s("triangle").gain(0.3)',
      counter: 'note("e5 ~ g5 ~").s("square").gain(0.2)',
      atmosphere: 'note("c6").s("sine").room(0.9).gain(0.1)',
      ambient: 'note("g6").s("sine").room(0.95).gain(0.08)',
      texture: 's("gtr:3").gain(0.15).room(0.7)'
    };
    
    return fallbacks[layer.id] || 's("~")';
  }

  /**
   * Generate pattern for a specific layer with context of existing patterns
   */
  async generateLayerPatternWithContext(layer, section, measure, analysis, existingPatterns, isRetry = false) {
    // Ensure generator is initialized
    if (!this.generator) {
      await this.initializeLLM();
    }
    
    // Ensure the generator's LLM is initialized
    await this.generator.initializeLLM();
    
    // Add error context if this is a retry
    const errorContext = isRetry && this.lastPatternError ? 
      `\n\nPREVIOUS ATTEMPT FAILED WITH ERROR: ${this.lastPatternError}\nPlease generate a different pattern that avoids this error.\n` : '';
    
    // Add existing patterns context
    const contextSection = existingPatterns ? 
      `\n\nEXISTING LAYERS (your pattern must complement these):\n${existingPatterns}\n` : '';
    
    // Add musical info if available
    const musicalContext = this.musicalInfo ? `
- ACTUAL CHORDS: ${this.musicalInfo.chords || 'unknown'}
- ACTUAL KEY: ${this.musicalInfo.key || analysis.key}
- BASS PATTERN: ${this.musicalInfo.bassPattern || 'unknown'}
- MELODY NOTES: ${this.musicalInfo.melodyNotes || 'unknown'}` : '';
    
    const prompt = `Generate a Strudel pattern for ${layer.name} in a ${section.type} section.${errorContext}${contextSection}

Context:
- Song: "${this.currentSongName}" by ${this.currentArtistName}
- Measure ${measure + 1} of ${section.bars} in ${section.type}
- Tempo: ${analysis.tempo} BPM
- Key: ${this.musicalInfo?.key || analysis.key}
- Section energy: ${section.energy.toFixed(2)} (${section.energy < 0.3 ? 'low' : section.energy < 0.7 ? 'medium' : 'high'})
- Detected rhythm patterns: kick every ${analysis.rhythm?.kick?.length > 0 ? (1 / (analysis.rhythm.kick.length / 4)).toFixed(2) : '4'} beats${musicalContext}

Layer specifics:
- Instrument: ${layer.name} (${layer.type})
- ${existingPatterns ? 'Add this layer to complement what\'s already playing' : 'This is the first layer - establish the foundation'}

Requirements:
- Generate ONLY a SINGLE pattern on ONE LINE for ${layer.name}
- NEVER use + to combine patterns - return just one pattern expression
- Match the energy and feel of a ${section.type} section
- Use appropriate Strudel syntax (s() for samples, note() for synths)
- For ${layer.name}: ${this.getLayerGuidance(layer, section, analysis)}
- ${existingPatterns ? 'Make sure your pattern works musically with the existing layers' : 'Create a strong foundation that other layers can build on'}
- ${this.musicalInfo?.chords ? `USE THESE ACTUAL CHORDS: ${this.musicalInfo.chords}` : ''}
- ${this.musicalInfo?.melodyNotes ? `BASE MELODIES ON: ${this.musicalInfo.melodyNotes}` : ''}
- Use Strudel's pattern language creatively: *, ~, <>, [], .fast(), .slow(), .sometimes(), .every(n, x => ...)
- Use ~ for rests/silence, NOT dots (.)
- .every() needs TWO parameters: .every(4, x => x.fast(2))
- NO comments, NO explanations, NO multiple patterns, just ONE pattern

Example format: ${this.getLayerExample(layer)}`;

    const messages = [
      {
        role: "system",
        content: `You are a Strudel pattern generator. Generate patterns that work together musically.`
      },
      {
        role: "user",
        content: prompt
      }
    ];
    
    const response = await this.generator.llm.generateCompletion(messages, { 
      temperature: 0.7, // Lower temperature for more consistent patterns
      max_tokens: 150
    });
    
    // Save LLM interaction if we have an output manager
    if (this.outputManager) {
      const currentIter = `iteration_${String(this.outputManager.iterationCount).padStart(3, '0')}`;
      this.outputManager.saveLLMInteraction(prompt, response, join(this.outputManager.sessionDir, 'iterations', currentIter));
    }
    
    return this.generator.cleanPattern(response);
  }

  /**
   * Generate pattern for a specific layer in a measure
   */
  async generateLayerPattern(layer, section, measure, analysis, isRetry = false) {
    // Ensure generator is initialized
    if (!this.generator) {
      await this.initializeLLM();
    }
    
    // Ensure the generator's LLM is initialized
    await this.generator.initializeLLM();
    
    // Add error context if this is a retry
    const errorContext = isRetry && this.lastPatternError ? 
      `\n\nPREVIOUS ATTEMPT FAILED WITH ERROR: ${this.lastPatternError}\nPlease generate a different pattern that avoids this error.\n` : '';
    
    const prompt = `Generate a Strudel pattern for ${layer.name} in a ${section.type} section.${errorContext}

Context:
- Song: "${this.currentSongName}" by ${this.currentArtistName}
- Measure ${measure + 1} of ${section.bars} in ${section.type}
- Tempo: ${analysis.tempo} BPM
- Key: ${analysis.key}
- Section energy: ${section.energy.toFixed(2)} (${section.energy < 0.3 ? 'low' : section.energy < 0.7 ? 'medium' : 'high'})
- Section characteristics: brightness=${section.characteristics.brightness.toFixed(2)}, percussiveness=${section.characteristics.percussiveness.toFixed(2)}

Layer specifics:
- Instrument: ${layer.name} (${layer.type})
- Previous measures: ${measure > 0 ? 'build on previous' : 'establish the groove'}

Requirements:
- Generate ONLY a single line pattern for ${layer.name}
- Match the energy and feel of a ${section.type} section
- Use appropriate Strudel syntax (s() for samples, note() for synths)
- For ${layer.name}: ${this.getLayerGuidance(layer, section, analysis)}
- Make patterns INTERESTING and VARIED - avoid simple repetition
- Use advanced Strudel functions like: .fast(), .slow(), .sometimes(), .every(), .rev(), .jux()
- Layer ${measure + 1}: ${measure === 0 ? 'Establish foundation' : measure === 1 ? 'Add complexity' : 'Full development with variations'}
- NO comments, NO explanations, just the pattern
- Use rhythm notations: * for repeat, ~ for rest, <> for alternating, [] for together
- Keep pan values between -0.8 and 0.8, gain between 0.1 and 0.6
- IMPORTANT: Only use VALID sample names from dirt-samples: bd, sn, cp, hh, oh, perc, tabla, arpy, gtr, etc.
- IMPORTANT: For synths use VALID waveforms: sine, sawtooth, square, triangle
- IMPORTANT: Use proper function syntax - sine.range(-0.8,0.8) NOT sine.range(-0.8, 0.8, other)
- IMPORTANT: Notes must be like "a#3" NOT "a#m3" - no 'm' or 'M' in note names!
- IMPORTANT: Use tri.range() or sine.range(), NOT triangle.range()
- IMPORTANT: jux needs a parameter like jux(rev), not just .jux
- IMPORTANT: rev needs parentheses - use .rev() not .rev
- IMPORTANT: Check angle brackets < > are balanced - don't have extra > at the end
- Make each pattern unique and musically interesting
- Examples of VALID CREATIVE patterns:
  - s("bd*4").sometimes(fast(2)).every(4, x => x.gain(0.6))
  - s("~ sn ~ sn").jux(rev).room(0.3)
  - s("hh*8").fast("<1 2 1 3>").gain(0.2)
  - note("<c3 e3 g3 c4>").s("sawtooth").sometimes(rev).pan(sine.range(-0.5,0.5))

Example format: ${this.getLayerExample(layer)}`;

    const messages = [
      {
        role: "system",
        content: `You are a Strudel pattern generator. Generate creative, musical patterns that match the song section and energy.
CRITICAL RULES:
1. Only use VALID dirt-samples: bd, sn, cp, hh, oh, perc, tabla, arpy, gtr, psr, pluck, etc.
2. Only use VALID synth waveforms: sine, sawtooth, square, triangle
3. Use proper syntax: sine.range(-0.8,0.8) not sine.range(-0.8, 0.8, extra)
4. Notes MUST be like "a#3" NOT "a#m3" - no 'm' in note names!
5. Use tri.range() or sine.range(), NOT triangle.range()
6. jux needs a parameter like jux(rev), not just .jux by itself
7. Return ONLY the pattern code - no comments, no explanations
8. Make patterns musical and interesting with functions like .sometimes(), .every(), .jux(rev), .rev()`
      },
      {
        role: "user",
        content: prompt
      }
    ];
    
    const response = await this.generator.llm.generateCompletion(messages, { 
      temperature: 0.9,
      max_tokens: 150
    });
    
    // Save LLM interaction if we have an output manager
    if (this.outputManager) {
      const currentIter = `iteration_${String(this.outputManager.iterationCount).padStart(3, '0')}`;
      this.outputManager.saveLLMInteraction(prompt, response, join(this.outputManager.sessionDir, 'iterations', currentIter));
    }
    
    return this.generator.cleanPattern(response);
  }
  
  getLayerGuidance(layer, section, analysis) {
    const guidance = {
      kick: `Create a kick pattern that drives the ${section.type}. Energy: ${section.energy < 0.5 ? 'sparse, minimal' : 'full, driving'}`,
      snare: `Add snare/clap hits that complement the kick. ${section.type === 'verse' ? 'Simple backbeat' : 'More complex pattern'}`,
      hihat: `Hi-hat pattern with ${section.energy < 0.5 ? 'occasional hits' : 'steady rhythm'}. Can use closed (hh) and open (oh)`,
      bass: `Bass line in ${analysis?.key || 'the key'}. ${section.energy < 0.5 ? 'Simple root notes' : 'Moving bassline'}`,
      chords: `Chord progression that fits ${section.type}. Use stacked notes or chord patterns`,
      pad: `Atmospheric pad sound. ${section.type === 'chorus' ? 'Full, lush' : 'Subtle, ambient'}`,
      lead: `Melodic lead line. ${section.type === 'chorus' ? 'Memorable hook' : 'Supporting melody'}`,
      atmosphere: `Ambient texture. Use effects like room(), delay(), pan()`
    };
    return guidance[layer.id] || 'Create an appropriate pattern for this instrument';
  }
  
  getLayerExample(layer) {
    const examples = {
      kick: 's("bd*4").sometimes(fast(2)).every(3, x => x.room(0.2)).gain(0.6)',
      snare: 's("~ sn ~ sn").jux(rev).sometimes(x => x.s("cp")).room(0.3).gain(0.4)',
      hihat: 's("hh*8").fast("<1 2 1 3>").sometimes(x => x.s("oh")).gain(0.2).pan(sine.slow(4))',
      percussion: 's("~ ~ perc ~").sometimes(x => x.s("tabla")).gain(0.3).pan(0.4)',
      bass: 'note("<c2 e2 g2 c3>").s("sawtooth").sometimes(rev).gain(0.4).pan(sine.range(-0.3,0.3))',
      sub: 'note("c1*2").s("sine").gain(0.5).sometimes(fast(0.5)).room(0.1)',
      chords: 'note("<[c4,e4,g4] [f4,a4,c5]>*2").s("square").sometimes(slow(2)).room(0.4).gain(0.3)',
      pad: 'note("[c4,e4,g4,c5]").s("sine").room(0.8).gain(0.2).pan(0.3).sometimes(rev)',
      arp: 'note("c4 e4 g4 c5").fast(4).s("pluck").sometimes(rev).gain(0.3).pan(0.1)',
      lead: 'note("c5 e5 g5 c6").fast("<1 2 1>").s("triangle").sometimes(jux(rev)).gain(0.3).pan(-0.2)',
      counter: 'note("e5 g5 c6 e6").slow(2).s("square").gain(0.2).pan(0.3).room(0.6)',
      atmosphere: 'note("c6").s("sine").room(0.9).gain(0.1).pan(sine.slow(8)).sometimes(fast(0.5))',
      ambient: 'note("g6").s("sine").room(0.95).gain(0.08).pan(sine.slow(12)).slow(4)',
      texture: 's("click*16").gain(0.15).room(0.7).pan(sine.range(-0.5,0.5)).sometimes(fast(2))'
    };
    return examples[layer.id] || 's("~")';
  }
  
  
  /**
   * Clean up common pattern errors
   */
  cleanupPattern(pattern) {
    if (!pattern) return pattern;
    
    // Fix .rev without parentheses
    pattern = pattern.replace(/\.rev(?!\s*\()/g, '.rev()');
    
    // Fix . used as rest notation (should be ~)
    pattern = pattern.replace(/"([^"]*)"/g, (match, content) => {
      // Replace standalone dots with tildes within quotes
      const fixed = content.replace(/(\s|^)\.(\s|$)/g, '$1~$2');
      return `"${fixed}"`;
    });
    
    // Fix unbalanced angle brackets by removing extra closing ones at the end
    const openAngles = (pattern.match(/</g) || []).length;
    const closeAngles = (pattern.match(/>/g) || []).length;
    if (closeAngles > openAngles) {
      // Remove extra closing brackets from the end
      const diff = closeAngles - openAngles;
      for (let i = 0; i < diff; i++) {
        pattern = pattern.replace(/>([^>]*)$/, '$1');
      }
    }
    
    // Fix note syntax like a#m3 to a#3
    pattern = pattern.replace(/([a-g][#b]?)m(\d)/gi, '$1$2');
    
    // Fix e# and b# notes (should be f and c)
    pattern = pattern.replace(/e#/gi, 'f');
    pattern = pattern.replace(/b#/gi, 'c');
    
    // Replace musical symbols with text equivalents
    pattern = pattern.replace(/♭/g, 'b'); // flat symbol to b
    pattern = pattern.replace(/♯/g, '#'); // sharp symbol to #
    pattern = pattern.replace(/♮/g, '');  // natural symbol (remove)
    
    // Fix prob() which doesn't exist - replace with rev
    pattern = pattern.replace(/prob\([^)]+\)/g, 'rev');
    
    // Fix triangle.range to tri.range
    pattern = pattern.replace(/triangle\.range/g, 'tri.range');
    
    // Fix standalone .sine.range() or .tri.range() - should be .pan(sine.range())
    pattern = pattern.replace(/\.(sine|tri)\.range\(([^)]+)\)/g, '.pan($1.range($2))');
    
    // Fix arrow function syntax: x = x.something() should be x => x.something()
    pattern = pattern.replace(/\b(\w+)\s*=\s*\1\./g, '$1 => $1.');
    
    // Fix sometimes(rev()) to sometimes(rev)
    pattern = pattern.replace(/sometimes\(rev\(\)\)/g, 'sometimes(rev)');
    
    // Fix .every() with only one parameter
    pattern = pattern.replace(/\.every\s*\(\s*(\d+)\s*\)/g, '.every($1, x => x)');
    
    // Fix + operator used to combine patterns
    if (pattern.includes(' + ')) {
      // If the pattern uses +, it's trying to combine multiple patterns
      // We should reject this entirely as it's fundamentally wrong
      return 's("~")'; // Return silence as fallback
    }
    
    // Fix unclosed angle brackets in strings like "<1 2 1 3"
    // Look for patterns where we have an opening < but no closing > before the quote ends
    pattern = pattern.replace(/"<([^">]+)"/g, (match, content) => {
      const openCount = (content.match(/</g) || []).length;
      const closeCount = (content.match(/>/g) || []).length;
      if (openCount > closeCount) {
        return `"<${content}>"`; // Add missing closing bracket
      }
      return match;
    });
    
    return pattern;
  }
  
  /**
   * Search for musical information online
   */
  async searchMusicInfo(artist, song) {
    console.log(chalk.gray(`Searching for chords and musical info for "${song}" by ${artist}...`));
    
    // Initialize LLM if needed
    if (!this.generator) {
      await this.initializeLLM();
    }
    await this.generator.initializeLLM();
    
    const prompt = `Search online for the musical structure of "${song}" by ${artist}. Find:
1. Key and scale
2. Chord progression (main chords used)
3. Tempo/BPM
4. Bass pattern description
5. Main melody notes or patterns
6. Any signature riffs or arpeggios

Format the response as JSON with these fields:
{
  "key": "the key",
  "scale": "major/minor",
  "chords": "chord progression",
  "tempo": number,
  "bassPattern": "description",
  "melodyNotes": "main melody",
  "signature": "any signature elements"
}`;

    const messages = [
      {
        role: "system",
        content: "You are a music analysis assistant. Search for and provide accurate musical information about songs."
      },
      {
        role: "user",
        content: prompt
      }
    ];
    
    try {
      const response = await this.generator.llm.generateCompletion(messages, { 
        temperature: 0.3,
        max_tokens: 500
      });
      
      // Try to parse as JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        let jsonStr = jsonMatch[0];
        // Clean up musical symbols before parsing
        jsonStr = jsonStr.replace(/♭/g, 'b').replace(/♯/g, '#').replace(/♮/g, '');
        return JSON.parse(jsonStr);
      }
      
      // Fallback: extract key information from text
      const keyMatch = response.match(/key[:\s]+([A-G][#b]?\s*(major|minor))/i);
      const tempoMatch = response.match(/(\d+)\s*BPM/i);
      const chordsMatch = response.match(/chords?[:\s]+([^.\n]+)/i);
      
      if (keyMatch || tempoMatch || chordsMatch) {
        return {
          key: keyMatch ? keyMatch[1] : null,
          tempo: tempoMatch ? parseInt(tempoMatch[1]) : null,
          chords: chordsMatch ? chordsMatch[1].trim() : null,
          source: 'extracted from text'
        };
      }
    } catch (error) {
      console.log(chalk.yellow(`Could not retrieve musical info: ${error.message}`));
    }
    
    return null;
  }

  /**
   * Helper sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export everything
export { AudioAnalyzer } from './analyzer.js';
export { PatternGenerator } from './generator.js';
export { LLMProviderFactory, BaseLLMProvider } from './llm/index.js';
export { SparkleMode } from './sparkle.js';
export default StrudelCover;