import { AudioAnalyzer } from './analyzer.js';
import { PatternGenerator } from './generator.js';
import StrudelAudioExport from '@strudel/audio-export';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

/**
 * StrudelCover - AI-powered song recreation in Strudel
 */
export class StrudelCover {
  constructor(options = {}) {
    this.analyzer = new AudioAnalyzer();
    this.generator = options.openaiKey ? 
      new PatternGenerator(options.openaiKey) : null;
    this.exporter = new StrudelAudioExport({ 
      headless: true,
      duration: 30 // Default to 30 seconds
    });
    
    this.maxIterations = options.maxIterations || 5;
    this.targetScore = options.targetScore || 80;
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
      let pattern;
      if (this.generator && !options.noLLM) {
        pattern = await this.generator.generateFromAnalysis(
          originalAnalysis, 
          artistName, 
          songName
        );
      } else {
        // Use basic pattern generation
        const generator = this.generator || new PatternGenerator();
        pattern = generator.generateBasicPattern(originalAnalysis);
      }
      
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
        
        // Compare analyses
        const comparison = this.analyzer.compareAnalyses(
          originalAnalysis, 
          generatedAnalysis
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
        if (comparison.score >= this.targetScore) {
          console.log(chalk.green(`\n✅ Target score reached!`));
          break;
        }
        
        // Refine pattern
        if (this.generator && !options.noLLM && iteration < this.maxIterations - 1) {
          console.log(chalk.gray('\nRefining pattern...'));
          pattern = await this.generator.refinePattern(
            pattern,
            comparison,
            originalAnalysis
          );
          console.log(chalk.green('Refined pattern:'));
          console.log(chalk.gray(pattern));
        } else {
          break; // No LLM or max iterations
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
}

// Export everything
export { AudioAnalyzer } from './analyzer.js';
export { PatternGenerator } from './generator.js';
export default StrudelCover;