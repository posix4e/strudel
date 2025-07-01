import { StrudelCover, LLMProviderFactory } from '../src/index.js';

// Example 1: Using OpenAI (default)
async function exampleOpenAI() {
  const cover = new StrudelCover({
    llm: 'openai',
    llmConfig: {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o'
    },
    maxIterations: 3,
    targetScore: 75
  });
  
  console.log('Using OpenAI GPT-4o...');
  // Would call: await cover.cover('song.mp3', 'Artist', 'Song');
}

// Example 2: Using Anthropic Claude
async function exampleAnthropic() {
  const cover = new StrudelCover({
    llm: 'anthropic',
    llmConfig: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-5-sonnet-20241022'
    },
    maxIterations: 3,
    targetScore: 75
  });
  
  console.log('Using Anthropic Claude...');
  // Would call: await cover.cover('song.mp3', 'Artist', 'Song');
}

// Example 3: Using Ollama (local)
async function exampleOllama() {
  const cover = new StrudelCover({
    llm: 'ollama',
    llmConfig: {
      model: 'codellama',
      baseURL: 'http://localhost:11434'
    },
    maxIterations: 3,
    targetScore: 75
  });
  
  console.log('Using Ollama with CodeLlama...');
  // Would call: await cover.cover('song.mp3', 'Artist', 'Song');
}

// Example 4: Legacy OpenAI support
async function exampleLegacy() {
  const cover = new StrudelCover({
    openaiKey: process.env.OPENAI_API_KEY,
    maxIterations: 3,
    targetScore: 75
  });
  
  console.log('Using legacy OpenAI configuration...');
  // Would call: await cover.cover('song.mp3', 'Artist', 'Song');
}

// Show available providers
console.log('Available LLM providers:', LLMProviderFactory.getAvailableProviders());

// Example usage
if (process.env.OPENAI_API_KEY) {
  exampleOpenAI();
} else {
  console.log('Set OPENAI_API_KEY to test OpenAI provider');
}

if (process.env.ANTHROPIC_API_KEY) {
  exampleAnthropic();
} else {
  console.log('Set ANTHROPIC_API_KEY to test Anthropic provider');
}

// Ollama doesn't need API key
console.log('\nTo test Ollama, make sure ollama is running locally');
console.log('Install ollama: https://ollama.ai');
console.log('Pull a model: ollama pull codellama');
console.log('Then uncomment the line below:');
// exampleOllama();