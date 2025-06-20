/**
 * Retrieval system for finding relevant Strudel patterns
 * Implements search, ranking, and context-aware retrieval
 */

import chalk from 'chalk';

export class RetrievalSystem {
  constructor(database, embeddingsGenerator) {
    this.database = database;
    this.embeddingsGenerator = embeddingsGenerator;
  }

  /**
   * Retrieve relevant patterns based on musical context
   */
  async retrieve(context) {
    const {
      type,
      section,
      tempo,
      key,
      style,
      query,
      topK = 5
    } = context;
    
    console.log(chalk.gray(`Retrieving ${type} patterns for ${section} section...`));
    
    // Build search query from context
    const searchQuery = this.buildSearchQuery(context);
    
    // For now, use simple type-based retrieval
    const allPatterns = this.database.patterns;
    const allMetadata = this.database.metadata;
    
    // Filter by type if specified
    let results = [];
    for (let i = 0; i < allPatterns.length; i++) {
      const metadata = allMetadata[i];
      if (!metadata) continue;
      
      // Score based on matching criteria
      let score = 0;
      if (type && metadata.type === type) score += 3;
      if (section && metadata.section === section) score += 2;
      if (tempo && Math.abs((metadata.tempo || 120) - tempo) < 20) score += 1;
      if (key && metadata.key === key) score += 1;
      if (style && metadata.style === style) score += 1;
      
      if (score > 0) {
        results.push({
          pattern: allPatterns[i],
          metadata: metadata,
          score: score,
          similarity: score / 8 // Normalize to 0-1
        });
      }
    }
    
    // Sort by score
    results.sort((a, b) => b.score - a.score);
    
    // Re-rank results based on musical relevance
    const rankedResults = this.rerankResults(results, context);
    
    // Take top K after re-ranking
    const topResults = rankedResults.slice(0, topK);
    
    // Format results for use in prompts
    return this.formatResults(topResults, context);
  }

  /**
   * Build search query from context
   */
  buildSearchQuery(context) {
    const parts = [];
    
    if (context.type) {
      parts.push(`${context.type} pattern`);
    }
    
    if (context.section) {
      parts.push(`for ${context.section} section`);
    }
    
    if (context.tempo) {
      parts.push(`at ${context.tempo} BPM`);
    }
    
    if (context.key) {
      parts.push(`in ${context.key}`);
    }
    
    if (context.style) {
      parts.push(`${context.style} style`);
    }
    
    if (context.query) {
      parts.push(context.query);
    }
    
    // Add musical characteristics
    if (context.energy) {
      if (context.energy > 0.7) parts.push('high energy');
      else if (context.energy < 0.3) parts.push('low energy ambient');
    }
    
    if (context.complexity) {
      parts.push(`${context.complexity} complexity`);
    }
    
    return parts.join(' ');
  }

  /**
   * Build filters for database search
   */
  buildFilters(context) {
    const filters = {};
    
    if (context.type) {
      filters.type = context.type;
    }
    
    if (context.section) {
      // Map section types to database values
      const sectionMap = {
        intro: 'intro',
        verse: 'verse',
        chorus: 'chorus',
        bridge: 'bridge',
        outro: 'outro',
        buildup: 'buildup',
        drop: 'drop',
        breakdown: 'breakdown'
      };
      
      filters.section = sectionMap[context.section] || context.section;
    }
    
    if (context.tempo) {
      // Allow tempo range of ±10 BPM
      filters.tempoRange = [context.tempo - 10, context.tempo + 10];
    }
    
    if (context.style) {
      filters.style = context.style;
    }
    
    if (context.instrument) {
      filters.instrument = context.instrument;
    }
    
    return filters;
  }

  /**
   * Re-rank results based on musical relevance
   */
  rerankResults(results, context) {
    return results.map(result => {
      let score = result.similarity;
      const meta = result.metadata;
      
      // Boost score for exact type match
      if (meta.type === context.type) {
        score += 0.1;
      }
      
      // Boost for section match
      if (meta.section === context.section) {
        score += 0.05;
      }
      
      // Boost for close tempo match
      if (context.tempo && meta.tempo) {
        const tempoDiff = Math.abs(context.tempo - meta.tempo);
        if (tempoDiff < 5) score += 0.05;
        else if (tempoDiff < 10) score += 0.03;
        else if (tempoDiff > 20) score -= 0.05;
      }
      
      // Boost for style match
      if (meta.style === context.style) {
        score += 0.05;
      }
      
      // Boost for appropriate complexity
      if (context.complexity) {
        if (meta.complexity === context.complexity) {
          score += 0.03;
        }
      }
      
      // Penalize overly complex patterns for simple contexts
      if (context.section === 'intro' && meta.complexity === 'complex') {
        score -= 0.05;
      }
      
      return {
        ...result,
        rerankedScore: score
      };
    }).sort((a, b) => b.rerankedScore - a.rerankedScore);
  }

  /**
   * Format results for use in LLM prompts
   */
  formatResults(results, context) {
    return results.map((result, index) => {
      const meta = result.metadata;
      const pattern = result.pattern;
      
      // Build description
      const descriptions = [];
      if (meta.name) descriptions.push(meta.name);
      if (meta.type) descriptions.push(`${meta.type} pattern`);
      if (meta.tempo) descriptions.push(`${meta.tempo} BPM`);
      if (meta.key) descriptions.push(`Key: ${meta.key}`);
      if (meta.complexity) descriptions.push(`Complexity: ${meta.complexity}`);
      
      return {
        index: index + 1,
        code: pattern.code,
        description: descriptions.join(', '),
        metadata: meta,
        similarity: result.similarity,
        source: pattern.source
      };
    });
  }

  /**
   * Retrieve examples for a specific pattern type
   */
  async retrieveByType(type, limit = 3) {
    const patterns = this.database.getPatternsByType(type);
    
    // Sort by some quality metric (could be popularity, complexity, etc.)
    patterns.sort((a, b) => {
      // Prefer medium complexity
      const complexityScore = {
        simple: 1,
        medium: 3,
        complex: 2
      };
      
      const scoreA = complexityScore[a.metadata.complexity] || 1;
      const scoreB = complexityScore[b.metadata.complexity] || 1;
      
      return scoreB - scoreA;
    });
    
    return patterns.slice(0, limit).map((p, i) => ({
      index: i + 1,
      code: p.pattern.code,
      description: `${p.metadata.type} pattern`,
      metadata: p.metadata
    }));
  }

  /**
   * Get similar patterns to a given pattern
   */
  async getSimilar(patternCode, metadata = {}, topK = 3) {
    // Generate embedding for the pattern
    const embedding = await this.embeddingsGenerator.generateEmbedding(
      patternCode,
      metadata
    );
    
    // Search for similar patterns
    const results = await this.database.search(embedding, {
      topK,
      minSimilarity: 0.7
    });
    
    return this.formatResults(results, metadata);
  }

  /**
   * Retrieve patterns for building a complete section
   */
  async retrieveForSection(section, tempo, key, style) {
    const layerTypes = ['drums', 'bass', 'chords', 'lead', 'atmosphere'];
    const sectionPatterns = {};
    
    for (const layerType of layerTypes) {
      const context = {
        type: layerType,
        section,
        tempo,
        key,
        style
      };
      
      const patterns = await this.retrieve(context);
      if (patterns.length > 0) {
        sectionPatterns[layerType] = patterns[0]; // Take best match
      }
    }
    
    return sectionPatterns;
  }
}