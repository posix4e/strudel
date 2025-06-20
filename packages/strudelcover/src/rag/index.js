/**
 * Main RAG interface for StrudelCover
 * Orchestrates pattern retrieval, embedding generation, and database management
 */

import { VectorDatabase } from './database.js';
import { LocalEmbeddingsGenerator } from './embeddings-local.js';
import { PatternParser } from './parser.js';
import { RetrievalSystem } from './retrieval.js';
import { PatternValidator } from './validator.js';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';

export class RAGSystem {
  constructor(config = {}) {
    const {
      dbPath = join(process.cwd(), 'rag-db'),
      openaiApiKey = process.env.OPENAI_API_KEY
    } = config;
    
    // Initialize components
    this.database = new VectorDatabase(dbPath);
    this.embeddingsGenerator = new LocalEmbeddingsGenerator(); // Always use local embeddings
    this.parser = new PatternParser();
    this.retrieval = new RetrievalSystem(this.database, this.embeddingsGenerator);
    this.validator = new PatternValidator();
    
    this.dbPath = dbPath;
    this.initialized = false;
  }

  /**
   * Initialize the RAG system with pattern data
   */
  async initialize() {
    if (this.initialized) return;
    
    console.log(chalk.blue('Initializing RAG system...'));
    
    // Check if database already has data
    const stats = this.database.getStats();
    if (stats.totalPatterns > 0) {
      console.log(chalk.green(`RAG database loaded with ${stats.totalPatterns} patterns`));
      this.initialized = true;
      return;
    }
    
    // Initialize with patterns from various sources
    await this.loadDefaultPatterns();
    await this.loadStrudelSongsCollection();
    
    this.initialized = true;
    console.log(chalk.green('RAG system initialized successfully'));
  }

  /**
   * Load default patterns
   */
  async loadDefaultPatterns() {
    console.log(chalk.gray('Loading default patterns...'));
    
    const defaultPatterns = [
      // Basic drum patterns
      {
        code: '$: "bd sd bd sd".sound().gain(0.8)',
        metadata: {
          type: 'drums',
          name: 'basic-beat',
          complexity: 'simple',
          tempo: 120,
          section: 'verse'
        }
      },
      {
        code: '$: "bd*2 sd bd sd".sound().gain(0.8)',
        metadata: {
          type: 'drums',
          name: 'double-kick',
          complexity: 'simple',
          tempo: 120,
          section: 'chorus'
        }
      },
      {
        code: '$: stack("bd*4", "~ sd ~ sd", "hh*8").sound().gain(0.8)',
        metadata: {
          type: 'drums',
          name: 'full-beat',
          complexity: 'medium',
          tempo: 120,
          section: 'verse'
        }
      },
      
      // Bass patterns
      {
        code: '$: "0 0 7 5".scale("C:minor").note().sound("sine").gain(0.7)',
        metadata: {
          type: 'bass',
          name: 'minor-bassline',
          complexity: 'simple',
          key: 'C minor',
          tempo: 120,
          section: 'verse'
        }
      },
      {
        code: '$: "0 ~ 0 3 5 ~ 5 7".scale("C:major").note().sound("fm").gain(0.6)',
        metadata: {
          type: 'bass',
          name: 'walking-bass',
          complexity: 'medium',
          key: 'C major',
          tempo: 120,
          section: 'verse'
        }
      },
      
      // Chord patterns
      {
        code: '$: "<C@m Em F G>".note().sound("superpiano").gain(0.5)',
        metadata: {
          type: 'chords',
          name: 'basic-progression',
          complexity: 'simple',
          key: 'C major',
          tempo: 120,
          section: 'verse'
        }
      },
      {
        code: '$: "<Am F C G>".note().sound("supersquare").gain(0.4).room(0.5)',
        metadata: {
          type: 'chords',
          name: 'pop-progression',
          complexity: 'simple',
          key: 'A minor',
          tempo: 120,
          section: 'chorus'
        }
      },
      
      // Lead patterns
      {
        code: '$: "0 2 4 7 4 2".scale("C:major").note().sound("triangle").gain(0.6)',
        metadata: {
          type: 'lead',
          name: 'simple-melody',
          complexity: 'simple',
          key: 'C major',
          tempo: 120,
          section: 'verse'
        }
      },
      {
        code: '$: "7 5 3 2 0 ~ 2 4".scale("C:minor").note().sound("supersaw").gain(0.5).delay(0.25)',
        metadata: {
          type: 'lead',
          name: 'descending-melody',
          complexity: 'medium',
          key: 'C minor',
          tempo: 120,
          section: 'chorus'
        }
      },
      
      // Atmosphere patterns
      {
        code: '$: "<C@m7 Em7>".note().sound("pad").gain(0.3).room(0.8).slow(4)',
        metadata: {
          type: 'atmosphere',
          name: 'ambient-pad',
          complexity: 'simple',
          key: 'C major',
          tempo: 120,
          section: 'intro'
        }
      }
    ];
    
    // Add patterns to database
    if (this.embeddingsGenerator) {
      for (const pattern of defaultPatterns) {
        try {
          const embedding = await this.embeddingsGenerator.generate(
            pattern.code,
            pattern.metadata
          );
          await this.database.addPattern(
            { code: pattern.code, source: 'default' },
            embedding,
            pattern.metadata
          );
        } catch (error) {
          console.error(chalk.red(`Error adding pattern: ${error.message}`));
        }
      }
    } else {
      console.log(chalk.yellow('No OpenAI API key provided - embeddings will not be generated'));
      // Add patterns without embeddings for testing
      for (const pattern of defaultPatterns) {
        await this.database.addPattern(
          { code: pattern.code, source: 'default' },
          new Array(1536).fill(0), // Dummy embedding
          pattern.metadata
        );
      }
    }
  }

  /**
   * Load patterns from strudel-songs-collection
   */
  async loadStrudelSongsCollection() {
    console.log(chalk.gray('Checking for strudel-songs-collection...'));
    
    const repoPath = join(process.cwd(), '..', 'strudel-songs-collection');
    
    if (!existsSync(repoPath)) {
      console.log(chalk.yellow('strudel-songs-collection not found. Attempting to clone...'));
      
      try {
        const parentDir = join(process.cwd(), '..');
        execSync(
          'git clone https://github.com/strudel-cc/strudel-songs-collection.git',
          { cwd: parentDir, stdio: 'inherit' }
        );
      } catch (error) {
        console.log(chalk.yellow('Could not clone strudel-songs-collection. Skipping...'));
        return;
      }
    }
    
    // Parse patterns from repository
    const patterns = await this.parser.parseRepository(repoPath);
    
    console.log(chalk.gray(`Found ${patterns.length} patterns in strudel-songs-collection`));
    
    // Generate embeddings and add to database
    if (this.embeddingsGenerator && patterns.length > 0) {
      // Generate embeddings one by one with local embeddings
      const embeddings = [];
      for (const pattern of patterns) {
        try {
          const embedding = await this.embeddingsGenerator.generate(pattern.code, pattern.metadata);
          embeddings.push(embedding);
        } catch (error) {
          console.error(chalk.red(`Error generating embedding: ${error.message}`));
          embeddings.push(null);
        }
      }
      
      for (let i = 0; i < patterns.length; i++) {
        if (embeddings[i]) {
          await this.database.addPattern(
            patterns[i],
            embeddings[i],
            patterns[i].metadata
          );
        }
      }
    }
  }

  /**
   * Retrieve relevant patterns for a given context
   */
  async retrieve(context) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.embeddingsGenerator) {
      console.log(chalk.yellow('Embeddings generator not available - using type-based retrieval'));
      return this.retrieval.retrieveByType(context.type, context.topK || 5);
    }
    
    return this.retrieval.retrieve(context);
  }

  /**
   * Validate a pattern
   */
  validatePattern(pattern) {
    return this.validator.validate(pattern);
  }

  /**
   * Auto-fix common pattern issues
   */
  autoFixPattern(pattern) {
    return this.validator.autoFix(pattern);
  }

  /**
   * Get database statistics
   */
  getStats() {
    return this.database.getStats();
  }

  /**
   * Build a prompt with retrieved examples
   */
  buildPromptWithExamples(basePrompt, examples) {
    if (!examples || examples.length === 0) {
      return basePrompt;
    }
    
    const exampleSection = examples.map((ex, i) => 
      `Example ${ex.index}: ${ex.description}\n${ex.code}`
    ).join('\n\n');
    
    return `${basePrompt}

Here are some relevant pattern examples to reference:

${exampleSection}

Use these examples as inspiration but create something unique that fits the specific requirements.`;
  }

  /**
   * Add a new pattern to the database
   */
  async addPattern(code, metadata) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Validate pattern first
    const validation = this.validator.validate(code);
    if (!validation.valid) {
      throw new Error(`Invalid pattern: ${validation.errors.join(', ')}`);
    }
    
    // Generate embedding
    let embedding;
    if (this.embeddingsGenerator) {
      embedding = await this.embeddingsGenerator.generate(code, metadata);
    } else {
      embedding = new Array(1536).fill(0); // Dummy embedding
    }
    
    // Add to database
    return this.database.addPattern(
      { code, source: 'user' },
      embedding,
      metadata
    );
  }

  /**
   * Search for patterns by query
   */
  async search(query, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.embeddingsGenerator) {
      console.log(chalk.yellow('Search requires embeddings generator'));
      return [];
    }
    
    const context = {
      query,
      ...options
    };
    
    return this.retrieval.retrieve(context);
  }
}

// Export a singleton instance
export const rag = new RAGSystem();