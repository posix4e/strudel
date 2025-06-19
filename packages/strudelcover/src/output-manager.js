import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

/**
 * Manages output directory structure and file tracking for StrudelCover
 */
export class OutputManager {
  constructor(baseDir = './strudelcover-output', artistName = '', songName = '') {
    this.baseDir = baseDir;
    this.artistName = this.sanitizeName(artistName);
    this.songName = this.sanitizeName(songName);
    this.timestamp = this.getTimestamp();
    this.sessionDir = this.createSessionDirectory();
    this.iterationCount = 0;
    this.logs = [];
    
    console.log(chalk.blue('\n📁 Output Directory:'), chalk.white(this.sessionDir));
    console.log(chalk.gray('All files will be saved here\n'));
  }
  
  /**
   * Create timestamp string
   */
  getTimestamp() {
    const now = new Date();
    return now.toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, -5); // Remove milliseconds and Z
  }
  
  /**
   * Sanitize names for filesystem
   */
  sanitizeName(name) {
    return name.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 50);
  }
  
  /**
   * Create main session directory structure
   */
  createSessionDirectory() {
    const dirName = `${this.timestamp}_${this.artistName}_${this.songName}`;
    const sessionDir = join(this.baseDir, dirName);
    
    // Create directory structure
    const dirs = [
      sessionDir,
      join(sessionDir, 'analysis'),
      join(sessionDir, 'iterations'),
      join(sessionDir, 'final'),
      join(sessionDir, 'logs')
    ];
    
    dirs.forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
    
    // Save initial config
    const config = {
      timestamp: this.timestamp,
      artist: this.artistName,
      song: this.songName,
      created: new Date().toISOString()
    };
    
    this.sessionDir = sessionDir; // Set sessionDir before using it
    this.saveJSON('config.json', config);
    
    return sessionDir;
  }
  
  /**
   * Create a new iteration directory
   */
  createIterationDirectory() {
    this.iterationCount++;
    const iterDir = join(this.sessionDir, 'iterations', `iteration_${String(this.iterationCount).padStart(3, '0')}`);
    const layersDir = join(iterDir, 'layers');
    
    [iterDir, layersDir].forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
    
    console.log(chalk.cyan(`\n🔄 Iteration ${this.iterationCount}:`), chalk.gray(iterDir));
    
    return { iterDir, layersDir };
  }
  
  /**
   * Save JSON data
   */
  saveJSON(filename, data, subdir = '') {
    const filepath = subdir && subdir !== '' ? join(this.sessionDir, subdir, filename) : join(this.sessionDir, filename);
    writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(chalk.gray(`  💾 Saved: ${filename}`));
    return filepath;
  }
  
  /**
   * Save text file
   */
  saveText(filename, content, subdir = '') {
    const filepath = subdir ? join(this.sessionDir, subdir, filename) : join(this.sessionDir, filename);
    writeFileSync(filepath, content);
    console.log(chalk.gray(`  💾 Saved: ${filename}`));
    return filepath;
  }
  
  /**
   * Save pattern file
   */
  savePattern(filename, pattern, subdir = '') {
    return this.saveText(filename, pattern, subdir);
  }
  
  /**
   * Save layer pattern
   */
  saveLayerPattern(iterDir, layerName, pattern) {
    const layersDir = join(iterDir, 'layers');
    if (!existsSync(layersDir)) {
      mkdirSync(layersDir, { recursive: true });
    }
    const filepath = join(layersDir, `${layerName}.strudel`);
    writeFileSync(filepath, pattern);
    console.log(chalk.gray(`  💾 Saved layer: ${layerName}.strudel`));
    return filepath;
  }
  
  /**
   * Log message
   */
  log(message, level = 'info') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message
    };
    
    this.logs.push(logEntry);
    
    // Append to log file
    const logFile = join(this.sessionDir, 'logs', 'console.log');
    appendFileSync(logFile, `${logEntry.timestamp} [${level.toUpperCase()}] ${message}\n`);
  }
  
  /**
   * Log error
   */
  logError(error) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      error: error.message || error,
      stack: error.stack
    };
    
    // Append to error log
    const errorFile = join(this.sessionDir, 'logs', 'errors.log');
    appendFileSync(errorFile, `${errorEntry.timestamp} ERROR: ${errorEntry.error}\n${errorEntry.stack || ''}\n\n`);
    
    this.log(`Error: ${error.message || error}`, 'error');
  }
  
  /**
   * Save LLM interaction
   */
  saveLLMInteraction(prompt, response, iterDir) {
    const llmFile = join(iterDir, 'llm_prompts.txt');
    const content = `=== LLM INTERACTION ===\nTime: ${new Date().toISOString()}\n\nPROMPT:\n${prompt}\n\nRESPONSE:\n${response}\n\n`;
    appendFileSync(llmFile, content);
  }
  
  /**
   * Save analysis results
   */
  saveAnalysis(analysisType, data) {
    return this.saveJSON(`${analysisType}.json`, data, 'analysis');
  }
  
  /**
   * Save comparison results
   */
  saveComparison(iterDir, comparison) {
    return this.saveJSON('comparison.json', comparison, iterDir.split('/').slice(-2).join('/'));
  }
  
  /**
   * Generate final report
   */
  generateReport(summary) {
    const report = `# StrudelCover Generation Report

## Session Information
- **Artist**: ${this.artistName}
- **Song**: ${this.songName}
- **Generated**: ${new Date().toISOString()}
- **Total Iterations**: ${this.iterationCount}

## Best Result
- **Iteration**: ${summary.bestIteration}
- **Similarity Score**: ${summary.bestScore}%
- **Audio File**: ${summary.audioFile}
- **Pattern File**: ${summary.patternFile}

## Process Summary
${summary.processSummary || 'No summary provided'}

## Key Metrics
- **Tempo Match**: ${summary.tempoMatch || 'N/A'}
- **Key Match**: ${summary.keyMatch || 'N/A'}
- **Energy Match**: ${summary.energyMatch || 'N/A'}
- **Rhythm Similarity**: ${summary.rhythmSimilarity || 'N/A'}

## Pattern Evolution
${summary.patternEvolution || 'See iterations folder for pattern progression'}
`;
    
    return this.saveText('report.md', report, 'final');
  }
  
  /**
   * Get session info
   */
  getSessionInfo() {
    return {
      sessionDir: this.sessionDir,
      timestamp: this.timestamp,
      artist: this.artistName,
      song: this.songName,
      iterations: this.iterationCount
    };
  }
}