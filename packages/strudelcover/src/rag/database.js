/**
 * Vector database interface for storing and searching Strudel patterns
 * Using a local implementation with Faiss for now, but can be swapped for cloud solutions
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export class VectorDatabase {
  constructor(dbPath = './rag-db') {
    this.dbPath = dbPath;
    this.patternsPath = join(dbPath, 'patterns.json');
    this.embeddingsPath = join(dbPath, 'embeddings.json');
    this.metadataPath = join(dbPath, 'metadata.json');
    
    // Ensure database directory exists
    mkdirSync(dbPath, { recursive: true });
    
    // Load existing data or initialize empty
    this.patterns = this.loadData(this.patternsPath, []);
    this.embeddings = this.loadData(this.embeddingsPath, []);
    this.metadata = this.loadData(this.metadataPath, []);
  }

  /**
   * Load data from file or return default
   */
  loadData(path, defaultValue) {
    if (existsSync(path)) {
      try {
        return JSON.parse(readFileSync(path, 'utf-8'));
      } catch (e) {
        console.error(`Error loading ${path}:`, e);
        return defaultValue;
      }
    }
    return defaultValue;
  }

  /**
   * Save data to file
   */
  saveData(path, data) {
    writeFileSync(path, JSON.stringify(data, null, 2));
  }

  /**
   * Add a pattern to the database
   */
  async addPattern(pattern, embedding, metadata) {
    const id = this.patterns.length;
    
    this.patterns.push({
      id,
      code: pattern.code,
      source: pattern.source,
      timestamp: new Date().toISOString()
    });
    
    this.embeddings.push({
      id,
      vector: embedding
    });
    
    this.metadata.push({
      id,
      ...metadata,
      tempo: metadata.tempo || null,
      key: metadata.key || null,
      type: metadata.type || 'unknown',
      section: metadata.section || null,
      instruments: metadata.instruments || [],
      style: metadata.style || null,
      complexity: metadata.complexity || 'medium',
      tags: metadata.tags || []
    });
    
    // Persist to disk
    this.saveData(this.patternsPath, this.patterns);
    this.saveData(this.embeddingsPath, this.embeddings);
    this.saveData(this.metadataPath, this.metadata);
    
    return id;
  }

  /**
   * Search for similar patterns using cosine similarity
   */
  async search(queryEmbedding, options = {}) {
    const {
      topK = 5,
      minSimilarity = 0.7,
      filters = {}
    } = options;
    
    // Calculate similarities
    const similarities = this.embeddings.map((item, idx) => ({
      id: item.id,
      similarity: this.cosineSimilarity(queryEmbedding, item.vector)
    }));
    
    // Filter by minimum similarity
    let results = similarities.filter(s => s.similarity >= minSimilarity);
    
    // Apply metadata filters
    if (Object.keys(filters).length > 0) {
      results = results.filter(result => {
        const meta = this.metadata[result.id];
        
        // Type filter
        if (filters.type && meta.type !== filters.type) return false;
        
        // Section filter
        if (filters.section && meta.section !== filters.section) return false;
        
        // Tempo range filter
        if (filters.tempoRange) {
          const [min, max] = filters.tempoRange;
          if (!meta.tempo || meta.tempo < min || meta.tempo > max) return false;
        }
        
        // Style filter
        if (filters.style && meta.style !== filters.style) return false;
        
        // Instrument filter
        if (filters.instrument && !meta.instruments.includes(filters.instrument)) return false;
        
        return true;
      });
    }
    
    // Sort by similarity and take top K
    results.sort((a, b) => b.similarity - a.similarity);
    results = results.slice(0, topK);
    
    // Return full pattern data
    return results.map(r => ({
      pattern: this.patterns[r.id],
      metadata: this.metadata[r.id],
      similarity: r.similarity
    }));
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a, b) {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (normA * normB);
  }

  /**
   * Get pattern by ID
   */
  getPattern(id) {
    return {
      pattern: this.patterns[id],
      metadata: this.metadata[id]
    };
  }

  /**
   * Get all patterns of a specific type
   */
  getPatternsByType(type) {
    return this.metadata
      .map((meta, idx) => ({
        pattern: this.patterns[idx],
        metadata: meta
      }))
      .filter(item => item.metadata.type === type);
  }

  /**
   * Get database statistics
   */
  getStats() {
    const typeCount = {};
    const sectionCount = {};
    const styleCount = {};
    
    this.metadata.forEach(meta => {
      typeCount[meta.type] = (typeCount[meta.type] || 0) + 1;
      if (meta.section) sectionCount[meta.section] = (sectionCount[meta.section] || 0) + 1;
      if (meta.style) styleCount[meta.style] = (styleCount[meta.style] || 0) + 1;
    });
    
    return {
      totalPatterns: this.patterns.length,
      byType: typeCount,
      bySection: sectionCount,
      byStyle: styleCount
    };
  }

  /**
   * Clear the database
   */
  clear() {
    this.patterns = [];
    this.embeddings = [];
    this.metadata = [];
    
    this.saveData(this.patternsPath, this.patterns);
    this.saveData(this.embeddingsPath, this.embeddings);
    this.saveData(this.metadataPath, this.metadata);
  }
}