/**
 * Local embeddings generator for Strudel patterns
 * Uses feature extraction instead of neural embeddings
 */

export class LocalEmbeddingsGenerator {
  constructor() {
    // Feature dimensions
    this.dimensions = 128;
  }

  /**
   * Generate embedding for a pattern using feature extraction
   */
  async generate(pattern, metadata = {}) {
    const features = [];
    
    // Extract numeric features from pattern
    const patternFeatures = this.extractPatternFeatures(pattern);
    const metadataFeatures = this.extractMetadataFeatures(metadata);
    
    // Combine features
    features.push(...patternFeatures);
    features.push(...metadataFeatures);
    
    // Pad or truncate to fixed dimensions
    while (features.length < this.dimensions) {
      features.push(0);
    }
    
    return features.slice(0, this.dimensions);
  }

  /**
   * Extract features from pattern code
   */
  extractPatternFeatures(code) {
    const features = [];
    
    // Length features
    features.push(code.length / 1000); // Normalized length
    features.push(code.split('\n').length / 50); // Line count
    
    // Sound type features
    features.push(code.includes('bd') ? 1 : 0);
    features.push(code.includes('sd') ? 1 : 0);
    features.push(code.includes('hh') ? 1 : 0);
    features.push(code.includes('cp') ? 1 : 0);
    features.push(code.includes('sine') ? 1 : 0);
    features.push(code.includes('square') ? 1 : 0);
    features.push(code.includes('sawtooth') ? 1 : 0);
    features.push(code.includes('fm') ? 1 : 0);
    
    // Method features
    features.push(code.match(/\.sound\(/g)?.length || 0);
    features.push(code.match(/\.note\(/g)?.length || 0);
    features.push(code.match(/\.scale\(/g)?.length || 0);
    features.push(code.match(/\.gain\(/g)?.length || 0);
    features.push(code.match(/\.room\(/g)?.length || 0);
    features.push(code.match(/\.delay\(/g)?.length || 0);
    features.push(code.match(/\.lpf\(/g)?.length || 0);
    features.push(code.match(/\.stack\(/g)?.length || 0);
    
    // Pattern features
    features.push(code.includes('*') ? 1 : 0); // Has euclidean
    features.push(code.includes('~') ? 1 : 0); // Has rests
    features.push(code.includes('<') ? 1 : 0); // Has cycles
    features.push(code.includes('[') ? 1 : 0); // Has subsequences
    
    // Complexity score
    const complexity = (
      code.length / 100 +
      code.split('\n').length +
      (code.match(/\./g)?.length || 0) +
      (code.match(/\(/g)?.length || 0)
    ) / 10;
    features.push(Math.min(complexity, 10));
    
    return features;
  }

  /**
   * Extract features from metadata
   */
  extractMetadataFeatures(metadata) {
    const features = [];
    
    // Type encoding (one-hot)
    const types = ['drums', 'bass', 'lead', 'chords', 'atmosphere', 'full'];
    types.forEach(t => features.push(metadata.type === t ? 1 : 0));
    
    // Section encoding
    const sections = ['intro', 'verse', 'chorus', 'bridge', 'outro', 'full'];
    sections.forEach(s => features.push(metadata.section === s ? 1 : 0));
    
    // Tempo (normalized)
    features.push((metadata.tempo || 120) / 200);
    
    // Style encoding
    const styles = ['techno', 'house', 'ambient', 'jazz', 'rock', 'electronic', 'general'];
    styles.forEach(s => features.push(metadata.style === s ? 1 : 0));
    
    // Key features
    if (metadata.key) {
      features.push(metadata.key.includes('major') ? 1 : 0);
      features.push(metadata.key.includes('minor') ? 1 : 0);
      
      // Root note
      const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
      notes.forEach(n => features.push(metadata.key.startsWith(n) ? 1 : 0));
    } else {
      features.push(...new Array(9).fill(0));
    }
    
    // Complexity
    features.push(metadata.complexity === 'simple' ? 0.3 : 
                  metadata.complexity === 'medium' ? 0.6 : 
                  metadata.complexity === 'complex' ? 1 : 0.5);
    
    return features;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}