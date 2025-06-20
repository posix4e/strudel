/**
 * Embeddings generator for Strudel patterns
 * Uses OpenAI embeddings API with musical context enhancement
 */

import OpenAI from 'openai';
import chalk from 'chalk';

export class EmbeddingsGenerator {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key required for embeddings');
    }
    
    this.openai = new OpenAI({ apiKey });
    this.model = 'text-embedding-3-small'; // Efficient model for code embeddings
  }

  /**
   * Generate embedding for a Strudel pattern with enhanced musical context
   */
  async generateEmbedding(pattern, metadata = {}) {
    try {
      // Construct enhanced text representation
      const enhancedText = this.constructEnhancedText(pattern, metadata);
      
      // Generate embedding
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: enhancedText
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error(chalk.red('Error generating embedding:'), error);
      throw error;
    }
  }

  /**
   * Batch generate embeddings for multiple patterns
   */
  async generateBatchEmbeddings(patterns) {
    const batchSize = 100; // OpenAI limit
    const results = [];
    
    console.log(chalk.blue(`Generating embeddings for ${patterns.length} patterns...`));
    
    for (let i = 0; i < patterns.length; i += batchSize) {
      const batch = patterns.slice(i, i + batchSize);
      const texts = batch.map(p => this.constructEnhancedText(p.code, p.metadata));
      
      try {
        const response = await this.openai.embeddings.create({
          model: this.model,
          input: texts
        });
        
        results.push(...response.data.map(d => d.embedding));
        
        console.log(chalk.gray(`Progress: ${Math.min(i + batchSize, patterns.length)}/${patterns.length}`));
      } catch (error) {
        console.error(chalk.red(`Error in batch ${i / batchSize}:`), error);
        // Add null embeddings for failed batch
        results.push(...new Array(batch.length).fill(null));
      }
    }
    
    return results;
  }

  /**
   * Construct enhanced text representation for better embeddings
   */
  constructEnhancedText(code, metadata = {}) {
    const parts = [];
    
    // Add metadata context
    if (metadata.type) parts.push(`TYPE: ${metadata.type}`);
    if (metadata.section) parts.push(`SECTION: ${metadata.section}`);
    if (metadata.tempo) parts.push(`TEMPO: ${metadata.tempo} BPM`);
    if (metadata.key) parts.push(`KEY: ${metadata.key}`);
    if (metadata.style) parts.push(`STYLE: ${metadata.style}`);
    if (metadata.instruments?.length) {
      parts.push(`INSTRUMENTS: ${metadata.instruments.join(', ')}`);
    }
    
    // Add the actual code
    parts.push('CODE:');
    parts.push(code);
    
    // Extract and add pattern characteristics
    const characteristics = this.extractPatternCharacteristics(code);
    if (characteristics.length > 0) {
      parts.push('CHARACTERISTICS:');
      parts.push(characteristics.join(', '));
    }
    
    return parts.join('\n');
  }

  /**
   * Extract musical characteristics from Strudel code
   */
  extractPatternCharacteristics(code) {
    const characteristics = [];
    
    // Check for common Strudel methods
    if (code.includes('.sound(')) characteristics.push('uses samples');
    if (code.includes('.note(')) characteristics.push('uses notes');
    if (code.includes('.scale(')) characteristics.push('uses scales');
    if (code.includes('.euclidLegato(')) characteristics.push('euclidean rhythm');
    if (code.includes('.jux(')) characteristics.push('stereo effects');
    if (code.includes('.rev(')) characteristics.push('reversed');
    if (code.includes('.slow(')) characteristics.push('slow pattern');
    if (code.includes('.fast(')) characteristics.push('fast pattern');
    if (code.includes('.sometimes(')) characteristics.push('probabilistic');
    if (code.includes('.rarely(')) characteristics.push('sparse variations');
    if (code.includes('.often(')) characteristics.push('dense variations');
    if (code.includes('.stack(')) characteristics.push('layered');
    if (code.includes('.cat(')) characteristics.push('sequential');
    if (code.includes('.delay(')) characteristics.push('has delay');
    if (code.includes('.room(')) characteristics.push('has reverb');
    if (code.includes('.lpf(')) characteristics.push('filtered');
    if (code.includes('.gain(')) characteristics.push('gain control');
    if (code.includes('.pan(')) characteristics.push('panning');
    
    // Check for drum patterns
    if (code.includes('bd') || code.includes('kick')) characteristics.push('has kick');
    if (code.includes('sd') || code.includes('snare')) characteristics.push('has snare');
    if (code.includes('hh') || code.includes('hat')) characteristics.push('has hihat');
    
    // Check for complexity
    const lineCount = code.split('\n').length;
    if (lineCount > 20) characteristics.push('complex');
    else if (lineCount < 5) characteristics.push('simple');
    else characteristics.push('moderate');
    
    return characteristics;
  }

  /**
   * Generate embedding for a search query
   */
  async generateQueryEmbedding(query, context = {}) {
    // Enhance query with context
    const parts = [query];
    
    if (context.type) parts.push(`Looking for ${context.type} patterns`);
    if (context.section) parts.push(`For ${context.section} section`);
    if (context.tempo) parts.push(`Around ${context.tempo} BPM`);
    if (context.style) parts.push(`In ${context.style} style`);
    
    const enhancedQuery = parts.join('. ');
    
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: enhancedQuery
    });
    
    return response.data[0].embedding;
  }
}