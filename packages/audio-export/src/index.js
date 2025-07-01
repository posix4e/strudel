import { exportPattern } from './exporter.js';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';

/**
 * Main API for Strudel audio export
 */
export class StrudelAudioExport {
  constructor(options = {}) {
    this.defaultOptions = {
      duration: 8,
      format: 'webm',
      quality: 'high',
      headless: true,
      sampleRate: 44100,
      bitRate: '192k',
      prebake: "samples('github:tidalcycles/dirt-samples')",
      ...options
    };
  }

  /**
   * Export a pattern to a file
   * @param {string} pattern - Strudel pattern code
   * @param {string} outputPath - Output file path
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportToFile(pattern, outputPath, options = {}) {
    const exportOptions = {
      ...this.defaultOptions,
      ...options,
      pattern,
      output: outputPath
    };

    const result = await exportPattern(exportOptions);
    
    // Check if export failed
    if (result && result.success === false) {
      const error = new Error(result.error || 'Export failed');
      error.details = result;
      throw error;
    }
    
    return result;
  }

  /**
   * Export a pattern to a buffer
   * @param {string} pattern - Strudel pattern code
   * @param {Object} options - Export options
   * @returns {Promise<Buffer>} Audio buffer
   */
  async exportToBuffer(pattern, options = {}) {
    const tempFile = `/tmp/strudel-export-${Date.now()}.${options.format || this.defaultOptions.format}`;
    
    try {
      await this.exportToFile(pattern, tempFile, options);
      const { readFile } = await import('fs/promises');
      return await readFile(tempFile);
    } finally {
      // Clean up temp file
      const { unlink } = await import('fs/promises');
      try { await unlink(tempFile); } catch {}
    }
  }

  /**
   * Export a pattern to a stream
   * @param {string} pattern - Strudel pattern code
   * @param {Object} options - Export options
   * @returns {Promise<ReadStream>} Audio stream
   */
  async exportToStream(pattern, options = {}) {
    const tempFile = `/tmp/strudel-export-${Date.now()}.${options.format || this.defaultOptions.format}`;
    
    await this.exportToFile(pattern, tempFile, options);
    
    // Return stream that auto-deletes temp file when done
    const stream = createReadStream(tempFile);
    stream.on('end', async () => {
      const { unlink } = await import('fs/promises');
      try { await unlink(tempFile); } catch {}
    });
    
    return stream;
  }

  /**
   * Export multiple patterns in batch
   * @param {Array} patterns - Array of {pattern, output, options} objects
   * @returns {Promise<Array>} Array of export results
   */
  async exportBatch(patterns) {
    const results = [];
    
    for (const item of patterns) {
      try {
        const result = await this.exportToFile(
          item.pattern,
          item.output,
          item.options || {}
        );
        results.push({ success: true, ...result });
      } catch (error) {
        results.push({ 
          success: false, 
          pattern: item.pattern,
          output: item.output,
          error: error.message 
        });
      }
    }
    
    return results;
  }

  /**
   * Create a render queue for continuous pattern export
   */
  createRenderQueue() {
    return new RenderQueue(this);
  }
}

/**
 * Render queue for managing multiple exports
 */
class RenderQueue {
  constructor(exporter) {
    this.exporter = exporter;
    this.queue = [];
    this.processing = false;
    this.concurrency = 1; // Sequential by default to avoid overload
  }

  /**
   * Add a pattern to the queue
   */
  add(pattern, output, options = {}) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        pattern,
        output,
        options,
        resolve,
        reject
      });
      
      if (!this.processing) {
        this.process();
      }
    });
  }

  /**
   * Process the queue
   */
  async process() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.concurrency);
      
      await Promise.all(batch.map(async (item) => {
        try {
          const result = await this.exporter.exportToFile(
            item.pattern,
            item.output,
            item.options
          );
          item.resolve(result);
        } catch (error) {
          item.reject(error);
        }
      }));
    }
    
    this.processing = false;
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      pending: this.queue.length,
      processing: this.processing
    };
  }

  /**
   * Clear the queue
   */
  clear() {
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }
}

// Export convenience functions
export { exportPattern } from './exporter.js';

// Default export
export default StrudelAudioExport;