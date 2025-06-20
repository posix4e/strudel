/**
 * Parser for extracting Strudel patterns from various sources
 * Handles strudel-songs-collection and other pattern repositories
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import chalk from 'chalk';

export class PatternParser {
  constructor() {
    this.patterns = [];
  }

  /**
   * Parse patterns from strudel-songs-collection repository
   */
  async parseRepository(repoPath) {
    console.log(chalk.blue(`Parsing patterns from ${repoPath}...`));
    
    const patterns = [];
    const files = this.findStrudelFiles(repoPath);
    
    for (const file of files) {
      try {
        const parsedPatterns = await this.parseFile(file);
        patterns.push(...parsedPatterns);
      } catch (error) {
        console.error(chalk.red(`Error parsing ${file}:`), error.message);
      }
    }
    
    console.log(chalk.green(`Parsed ${patterns.length} patterns from ${files.length} files`));
    return patterns;
  }

  /**
   * Find all Strudel files in a directory recursively
   */
  findStrudelFiles(dir, files = []) {
    const items = readdirSync(dir);
    
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules and hidden directories
        if (!item.startsWith('.') && item !== 'node_modules') {
          this.findStrudelFiles(fullPath, files);
        }
      } else if (stat.isFile()) {
        // Look for .js files that might contain Strudel patterns
        if (extname(item) === '.js' || extname(item) === '.strudel') {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }

  /**
   * Parse a single file for Strudel patterns
   */
  async parseFile(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    const fileName = basename(filePath);
    const patterns = [];
    
    // Extract metadata from file
    const fileMetadata = this.extractFileMetadata(content, fileName);
    
    // Try different parsing strategies
    const extractedPatterns = [
      ...this.extractCommentedPatterns(content),
      ...this.extractFunctionPatterns(content),
      ...this.extractVariablePatterns(content),
      ...this.extractInlinePatterns(content)
    ];
    
    // Deduplicate and enhance patterns
    const uniquePatterns = this.deduplicatePatterns(extractedPatterns);
    
    for (const pattern of uniquePatterns) {
      const enhanced = {
        code: pattern.code,
        source: filePath,
        metadata: {
          ...fileMetadata,
          ...pattern.metadata,
          ...this.analyzePattern(pattern.code)
        }
      };
      
      patterns.push(enhanced);
    }
    
    return patterns;
  }

  /**
   * Extract metadata from file content and name
   */
  extractFileMetadata(content, fileName) {
    const metadata = {};
    
    // Extract from filename
    const fileNameLower = fileName.toLowerCase();
    if (fileNameLower.includes('drum')) metadata.type = 'drums';
    else if (fileNameLower.includes('bass')) metadata.type = 'bass';
    else if (fileNameLower.includes('melody')) metadata.type = 'melody';
    else if (fileNameLower.includes('chord')) metadata.type = 'chords';
    
    // Extract tempo from comments or code
    const tempoMatch = content.match(/(?:tempo|bpm|setcps).*?(\d{2,3})/i);
    if (tempoMatch) {
      metadata.tempo = parseInt(tempoMatch[1]);
    }
    
    // Extract key from comments
    const keyMatch = content.match(/(?:key|scale).*?([A-G]#?\s*(?:major|minor|maj|min)?)/i);
    if (keyMatch) {
      metadata.key = keyMatch[1].trim();
    }
    
    // Extract style/genre from comments
    const styleMatch = content.match(/(?:style|genre).*?([a-zA-Z]+)/i);
    if (styleMatch) {
      metadata.style = styleMatch[1].toLowerCase();
    }
    
    return metadata;
  }

  /**
   * Extract patterns that are marked with comments
   */
  extractCommentedPatterns(content) {
    const patterns = [];
    const sections = content.split(/\/\/\s*(?:pattern|section|part)/i);
    
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const lines = section.split('\n');
      const name = lines[0].trim();
      
      // Look for pattern code
      const codeLines = [];
      let inPattern = false;
      
      for (const line of lines.slice(1)) {
        if (line.includes('$:') || line.includes('note(') || line.includes('sound(')) {
          inPattern = true;
        }
        
        if (inPattern) {
          if (line.trim() === '' && codeLines.length > 0) break;
          codeLines.push(line);
        }
      }
      
      if (codeLines.length > 0) {
        patterns.push({
          code: codeLines.join('\n').trim(),
          metadata: { name }
        });
      }
    }
    
    return patterns;
  }

  /**
   * Extract patterns defined as functions
   */
  extractFunctionPatterns(content) {
    const patterns = [];
    const functionRegex = /(?:const|let|var|function)\s+(\w+).*?=.*?[\(\{][\s\S]*?(?:\$:|note\(|sound\()[\s\S]*?[\)\}];?/g;
    
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const name = match[1];
      const code = this.extractCodeBlock(content, match.index);
      
      if (code && this.isStrudelPattern(code)) {
        patterns.push({
          code: this.cleanPattern(code),
          metadata: { name, type: this.inferPatternType(name, code) }
        });
      }
    }
    
    return patterns;
  }

  /**
   * Extract patterns assigned to variables
   */
  extractVariablePatterns(content) {
    const patterns = [];
    const varRegex = /(?:const|let|var)\s+(\w+)\s*=\s*\$[\s\S]*?(?=\n(?:const|let|var|function|\/\/)|$)/g;
    
    let match;
    while ((match = varRegex.exec(content)) !== null) {
      const name = match[1];
      const code = match[0].replace(/^(?:const|let|var)\s+\w+\s*=\s*/, '');
      
      if (this.isStrudelPattern(code)) {
        patterns.push({
          code: this.cleanPattern(code),
          metadata: { name, type: this.inferPatternType(name, code) }
        });
      }
    }
    
    return patterns;
  }

  /**
   * Extract inline patterns
   */
  extractInlinePatterns(content) {
    const patterns = [];
    const inlineRegex = /\$[\s\S]*?\.(?:sound|note|scale|n)\([^)]+\)[\s\S]*?(?=\n\n|$)/g;
    
    let match;
    while ((match = inlineRegex.exec(content)) !== null) {
      const code = match[0];
      
      if (this.isStrudelPattern(code) && code.length > 20) {
        patterns.push({
          code: this.cleanPattern(code),
          metadata: { type: this.inferPatternType('', code) }
        });
      }
    }
    
    return patterns;
  }

  /**
   * Extract a complete code block starting from an index
   */
  extractCodeBlock(content, startIndex) {
    let depth = 0;
    let inString = false;
    let stringChar = null;
    let code = '';
    
    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];
      code += char;
      
      if (!inString) {
        if (char === '"' || char === "'" || char === '`') {
          inString = true;
          stringChar = char;
        } else if (char === '{' || char === '(') {
          depth++;
        } else if (char === '}' || char === ')') {
          depth--;
          if (depth === 0) break;
        }
      } else if (char === stringChar && content[i - 1] !== '\\') {
        inString = false;
      }
    }
    
    return code;
  }

  /**
   * Check if code is a valid Strudel pattern
   */
  isStrudelPattern(code) {
    return code.includes('$') && (
      code.includes('.sound(') ||
      code.includes('.note(') ||
      code.includes('.n(') ||
      code.includes('.scale(') ||
      code.includes('.s(')
    );
  }

  /**
   * Clean pattern code
   */
  cleanPattern(code) {
    return code
      .trim()
      .replace(/^(?:const|let|var)\s+\w+\s*=\s*/, '')
      .replace(/;$/, '')
      .replace(/^\$/, '$:');
  }

  /**
   * Infer pattern type from name and code
   */
  inferPatternType(name, code) {
    const nameLower = name.toLowerCase();
    const codeLower = code.toLowerCase();
    
    if (nameLower.includes('drum') || nameLower.includes('beat') || 
        codeLower.includes('bd') || codeLower.includes('sd') || codeLower.includes('hh')) {
      return 'drums';
    }
    if (nameLower.includes('bass') || codeLower.includes('bass')) {
      return 'bass';
    }
    if (nameLower.includes('lead') || nameLower.includes('melody')) {
      return 'lead';
    }
    if (nameLower.includes('chord') || nameLower.includes('harmony')) {
      return 'chords';
    }
    if (nameLower.includes('pad') || nameLower.includes('atmosphere')) {
      return 'atmosphere';
    }
    
    return 'unknown';
  }

  /**
   * Analyze pattern to extract additional metadata
   */
  analyzePattern(code) {
    const metadata = {};
    
    // Count complexity
    const lines = code.split('\n').filter(l => l.trim()).length;
    if (lines <= 3) metadata.complexity = 'simple';
    else if (lines <= 10) metadata.complexity = 'medium';
    else metadata.complexity = 'complex';
    
    // Extract instruments
    const instruments = [];
    const soundMatches = code.matchAll(/\.sound\(['"]([^'"]+)['"]\)/g);
    for (const match of soundMatches) {
      instruments.push(match[1]);
    }
    if (instruments.length > 0) {
      metadata.instruments = [...new Set(instruments)];
    }
    
    // Detect pattern style
    if (code.includes('.euclidLegato(')) metadata.style = 'euclidean';
    else if (code.includes('.rarely(') || code.includes('.sometimes(')) metadata.style = 'generative';
    else if (code.includes('.cat(')) metadata.style = 'sequential';
    else if (code.includes('.stack(')) metadata.style = 'layered';
    
    return metadata;
  }

  /**
   * Deduplicate patterns based on code similarity
   */
  deduplicatePatterns(patterns) {
    const unique = [];
    const seen = new Set();
    
    for (const pattern of patterns) {
      const normalized = pattern.code.replace(/\s+/g, ' ').trim();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(pattern);
      }
    }
    
    return unique;
  }

  /**
   * Parse patterns from Strudel documentation
   */
  async parseDocumentation(docPath) {
    // This would parse the Strudel documentation website
    // For now, we'll return some example patterns
    return [
      {
        code: '$: "bd sd bd sd".sound().gain(0.8)',
        source: 'docs',
        metadata: {
          type: 'drums',
          name: 'basic-beat',
          complexity: 'simple',
          tempo: 120
        }
      },
      {
        code: '$: "0 2 4 5".scale("C:minor").note().sound("fm")',
        source: 'docs',
        metadata: {
          type: 'bass',
          name: 'minor-bassline',
          complexity: 'simple',
          key: 'C minor'
        }
      }
    ];
  }
}