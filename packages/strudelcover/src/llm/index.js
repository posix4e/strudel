import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';

/**
 * LLM Provider Factory
 */
export class LLMProviderFactory {
  static providers = {
    openai: OpenAIProvider,
    anthropic: AnthropicProvider,
    ollama: OllamaProvider
  };

  /**
   * Create an LLM provider instance
   * @param {string} provider - Provider name (openai, anthropic, ollama)
   * @param {Object} config - Provider configuration
   * @returns {BaseLLMProvider}
   */
  static create(provider, config) {
    const Provider = this.providers[provider.toLowerCase()];
    
    if (!Provider) {
      throw new Error(`Unknown LLM provider: ${provider}. Available: ${Object.keys(this.providers).join(', ')}`);
    }
    
    return new Provider(config);
  }

  /**
   * Register a custom provider
   * @param {string} name - Provider name
   * @param {Class} providerClass - Provider class extending BaseLLMProvider
   */
  static registerProvider(name, providerClass) {
    this.providers[name.toLowerCase()] = providerClass;
  }

  /**
   * Get available providers
   * @returns {string[]}
   */
  static getAvailableProviders() {
    return Object.keys(this.providers);
  }
}

// Export everything
export { BaseLLMProvider } from './base.js';
export { OpenAIProvider } from './openai.js';
export { AnthropicProvider } from './anthropic.js';
export { OllamaProvider } from './ollama.js';