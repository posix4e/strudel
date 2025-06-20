import { BaseLLMProvider } from './base.js';

/**
 * Ollama Local LLM Provider
 */
export class OllamaProvider extends BaseLLMProvider {
  constructor(config) {
    super(config);
    
    this.baseURL = config.baseURL || 'http://localhost:11434';
    this.model = config.model || 'llama2';
    this.temperature = config.temperature || 0.3;
  }

  async generateCompletion(messages, options = {}) {
    // Convert messages to Ollama format
    const prompt = messages.map(m => {
      if (m.role === 'system') return `System: ${m.content}`;
      if (m.role === 'user') return `User: ${m.content}`;
      if (m.role === 'assistant') return `Assistant: ${m.content}`;
      return m.content;
    }).join('\n\n');

    const response = await fetch(`${this.baseURL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model || this.model,
        prompt: prompt + '\n\nAssistant: ',
        temperature: options.temperature ?? this.temperature,
        stream: false,
        ...options
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  }

  getProviderName() {
    return 'Ollama';
  }

  validateConfig() {
    // Ollama doesn't require API keys
  }
}