import { AdvancedAudioAnalyzer } from './advanced-analyzer.js';
import { LLMProviderFactory } from './llm/index.js';
import { DazzleDashboard } from './dazzle-dashboard.js';
import { DazzleGenerator } from './dazzle-generator.js';
import { existsSync, mkdirSync } from 'fs';
import chalk from 'chalk';

/**
 * StrudelCover - AI-powered song recreation in Strudel (Dazzle Mode Only)
 */
export class StrudelCover {
  constructor(options = {}) {
    this.options = options;
    
    // Dazzle mode - real-time construction dashboard
    this.dazzleDashboard = null;
    
    // Always use advanced analyzer
    this.analyzer = new AdvancedAudioAnalyzer();
    
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
    if (this.llmProvider) return; // Already initialized
    
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
    
    this.llmProvider = llmProvider;
  }

  /**
   * Main cover generation function
   */
  async cover(songPath, artistName, songName, options = {}) {
    // Initialize LLM provider if not already done
    await this.initializeLLM();
    
    if (this.sparkleMode) {
      await this.sparkle.showIntro();
      await this.sparkle.glitchEffect();
    }
    
    // Initialize dazzle dashboard
    if (this.dazzleMode) {
      const { DazzleDashboard } = await import('./dazzle-dashboard.js');
      this.dazzleDashboard = new DazzleDashboard();
      await this.dazzleDashboard.start();
      this.dazzleDashboard.setPhase('analyzing');
    }
    
    console.log(chalk.blue(`\n🎵 StrudelCover: "${songName}" by ${artistName}\n`));
    
    try {
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      throw error;
    }
  }

}

// Export everything
export { AdvancedAudioAnalyzer } from './advanced-analyzer.js';
export { LLMProviderFactory, BaseLLMProvider } from './llm/index.js';
export { DazzleDashboard } from './dazzle-dashboard.js';
export { DazzleGenerator } from './dazzle-generator.js';
export default StrudelCover;