import { AudioAnalyzer } from './analyzer.js';
import { PatternGenerator } from './generator.js';
import { LLMProviderFactory } from './llm/index.js';
import StrudelAudioExport from '@strudel/audio-export';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

/**
 * StrudelCover - AI-powered song recreation in Strudel
 */
export class StrudelCover {
  constructor(options = {}) {
    // Initialize LLM provider
    let llmProvider;
    
    // Legacy support - if openaiKey provided, use OpenAI
    if (options.openaiKey) {
      llmProvider = LLMProviderFactory.create('openai', { 
        apiKey: options.openaiKey,
        model: options.model 
      });
    } 
    // New way - explicit provider configuration
    else if (options.llm) {
      if (typeof options.llm === 'string') {
        // Simple provider name, must have API key in env or config
        const envKey = `${options.llm.toUpperCase()}_API_KEY`;
        const apiKey = options.llmConfig?.apiKey || process.env[envKey];
        
        if (!apiKey && options.llm !== 'ollama') {
          throw new Error(`${options.llm} requires API key via llmConfig.apiKey or ${envKey} env var`);
        }
        
        llmProvider = LLMProviderFactory.create(options.llm, {
          apiKey,
          ...options.llmConfig
        });
      } else {
        // Direct provider instance
        llmProvider = options.llm;
      }
    } else {
      throw new Error('LLM configuration required. Use options.openaiKey (legacy) or options.llm');
    }
    
    this.analyzer = new AudioAnalyzer();
    this.generator = new PatternGenerator(llmProvider);
    this.exporter = new StrudelAudioExport({ 
      headless: true,
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
   * Main cover generation function
   */
  async cover(songPath, artistName, songName, options = {}) {
    console.log(chalk.blue(`\n🎵 StrudelCover: "${songName}" by ${artistName}\n`));
    
    try {
      // Step 1: Analyze original song
      console.log(chalk.gray('Analyzing original audio...'));
      const originalAnalysis = await this.analyzer.analyze(songPath);
      this.logAnalysis('Original', originalAnalysis);
      
      // Step 2: Generate initial pattern
      console.log(chalk.gray('\nGenerating initial Strudel pattern...'));
      let pattern = await this.generator.generateFromAnalysis(
        originalAnalysis, 
        artistName, 
        songName
      );
      
      console.log(chalk.green('Initial pattern:'));
      console.log(chalk.gray(pattern));
      
      // Step 3: Iterative refinement
      let iteration = 0;
      let bestPattern = pattern;
      let bestScore = 0;
      let history = [];
      
      while (iteration < this.maxIterations) {
        console.log(chalk.blue(`\n--- Iteration ${iteration + 1} ---`));
        
        // Export current pattern to audio
        const audioPath = join(this.outputDir, `iteration-${iteration}.wav`);
        console.log(chalk.gray('Exporting pattern to audio...'));
        
        await this.exporter.exportToFile(pattern, audioPath, {
          duration: Math.min(originalAnalysis.duration, 30),
          format: 'wav'
        });
        
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
        
        console.log(chalk.yellow(`Score: ${comparison.score}/100`));
        this.logComparison(comparison);
        
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
      
      // Save pattern to file
      const patternPath = join(this.outputDir, 'pattern.strudel');
      const { writeFileSync } = await import('fs');
      writeFileSync(patternPath, bestPattern);
      
      console.log(chalk.green(`\n✨ StrudelCover Complete!`));
      console.log(chalk.gray(`Final score: ${bestScore}/100`));
      console.log(chalk.gray(`Pattern saved to: ${patternPath}`));
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
}

// Export everything
export { AudioAnalyzer } from './analyzer.js';
export { PatternGenerator } from './generator.js';
export { LLMProviderFactory, BaseLLMProvider, OpenAIProvider, AnthropicProvider, OllamaProvider } from './llm/index.js';
export default StrudelCover;