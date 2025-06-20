import chalk from 'chalk';
import ora from 'ora';

/**
 * Sparkle Mode - Maximum visual feedback and cyber aesthetics
 */
export class SparkleMode {
  constructor() {
    this.matrixChars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
    this.colors = ['green', 'cyan', 'magenta', 'yellow', 'blue'];
    this.spinners = [];
    this.learnedErrors = new Map(); // Store learned error corrections
  }

  /**
   * Epic intro animation
   */
  async showIntro() {
    console.clear();
    
    // ASCII art title (simplified without figlet)
    const title = `
███████╗████████╗██████╗ ██╗   ██╗██████╗ ███████╗██╗      ██████╗ ██████╗ ██╗   ██╗███████╗██████╗ 
██╔════╝╚══██╔══╝██╔══██╗██║   ██║██╔══██╗██╔════╝██║     ██╔════╝██╔═══██╗██║   ██║██╔════╝██╔══██╗
███████╗   ██║   ██████╔╝██║   ██║██║  ██║█████╗  ██║     ██║     ██║   ██║██║   ██║█████╗  ██████╔╝
╚════██║   ██║   ██╔══██╗██║   ██║██║  ██║██╔══╝  ██║     ██║     ██║   ██║╚██╗ ██╔╝██╔══╝  ██╔══██╗
███████║   ██║   ██║  ██║╚██████╔╝██████╔╝███████╗███████╗╚██████╗╚██████╔╝ ╚████╔╝ ███████╗██║  ██║
╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚══════╝ ╚═════╝ ╚═════╝   ╚═══╝  ╚══════╝╚═╝  ╚═╝`;
    
    console.log(chalk.cyan(title));
    console.log('\n');
    
    // Matrix rain effect
    await this.matrixRain(5, 50);
    
    // Cyber text
    const cyberText = [
      '[INITIALIZING NEURAL AUDIO SYNTHESIS ENGINE]',
      '[LOADING QUANTUM PATTERN GENERATORS]',
      '[ESTABLISHING LLM NEURAL LINK]',
      '[ACTIVATING SPECTRAL ANALYZERS]',
      '[ENGAGING HYPERDIMENSIONAL AUDIO PIPELINE]'
    ];
    
    for (const text of cyberText) {
      await this.typewriterEffect(chalk.green(text), 30);
      await this.sleep(200);
    }
    
    console.log('\n');
  }

  /**
   * Matrix rain effect
   */
  async matrixRain(rows = 10, cols = 80) {
    const matrix = Array(rows).fill(null).map(() => 
      Array(cols).fill(null).map(() => ({
        char: ' ',
        brightness: 0
      }))
    );
    
    // Animation frames
    for (let frame = 0; frame < 20; frame++) {
      // Update matrix
      for (let col = 0; col < cols; col++) {
        if (Math.random() < 0.1) {
          // Start new drop
          matrix[0][col] = {
            char: this.matrixChars[Math.floor(Math.random() * this.matrixChars.length)],
            brightness: 1
          };
        }
      }
      
      // Move drops down
      for (let row = rows - 1; row > 0; row--) {
        for (let col = 0; col < cols; col++) {
          matrix[row][col] = {
            char: matrix[row - 1][col].char,
            brightness: matrix[row - 1][col].brightness * 0.9
          };
        }
      }
      
      // Clear and render
      process.stdout.write('\x1b[2J\x1b[H');
      for (let row = 0; row < rows; row++) {
        let line = '';
        for (let col = 0; col < cols; col++) {
          const cell = matrix[row][col];
          if (cell.brightness > 0.1) {
            const green = Math.floor(255 * cell.brightness);
            line += chalk.rgb(0, green, 0)(cell.char);
          } else {
            line += ' ';
          }
        }
        console.log(line);
      }
      
      await this.sleep(50);
    }
  }

  /**
   * Typewriter effect
   */
  async typewriterEffect(text, delay = 50) {
    for (const char of text) {
      process.stdout.write(char);
      await this.sleep(delay);
    }
    console.log();
  }

  /**
   * Show audio analysis visualization
   */
  async showAnalysisVisualization(analysis) {
    // Simple box without boxen
    console.log('\n' + chalk.cyan('╔═══════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + chalk.bold.yellow('   🎵 AUDIO ANALYSIS MATRIX 🎵   ') + chalk.cyan('║'));
    console.log(chalk.cyan('╚═══════════════════════════════════════╝'));
    
    // Tempo visualization
    const tempoBars = '█'.repeat(Math.floor(analysis.tempo / 10));
    console.log(chalk.cyan(`TEMPO   : ${tempoBars} ${analysis.tempo} BPM`));
    
    // Energy meter
    const energyLevel = Math.floor(analysis.features.energy * 20);
    const energyBar = chalk.green('▓'.repeat(energyLevel)) + chalk.gray('░'.repeat(20 - energyLevel));
    console.log(chalk.yellow(`ENERGY  : [${energyBar}] ${(analysis.features.energy * 100).toFixed(1)}%`));
    
    // Frequency spectrum
    console.log(chalk.magenta(`\nFREQUENCY SPECTRUM:`));
    this.drawSpectrum(analysis.features.spectralCentroid);
    
    // Rhythm pattern matrix
    console.log(chalk.blue(`\nRHYTHM MATRIX:`));
    this.drawRhythmMatrix(analysis.rhythm);
    
    // Random cyber data
    this.showCyberData();
  }

  /**
   * Draw frequency spectrum
   */
  drawSpectrum(centroid) {
    const width = 60;
    const frequencies = [100, 200, 500, 1000, 2000, 5000, 10000];
    
    frequencies.forEach(freq => {
      const intensity = Math.max(0, 1 - Math.abs(freq - centroid) / 10000);
      const barLength = Math.floor(intensity * width);
      const bar = '█'.repeat(barLength) + '░'.repeat(width - barLength);
      const color = intensity > 0.7 ? chalk.red : intensity > 0.4 ? chalk.yellow : chalk.green;
      console.log(`${String(freq).padStart(5)}Hz ${color(bar)}`);
    });
  }

  /**
   * Draw rhythm matrix
   */
  drawRhythmMatrix(rhythm) {
    const patterns = {
      'KICK ': rhythm.kick || [],
      'SNARE': rhythm.snare || [],
      'HIHAT': rhythm.hihat || []
    };
    
    Object.entries(patterns).forEach(([name, beats]) => {
      let pattern = name + ' |';
      for (let i = 0; i < 16; i++) {
        const beat = i / 4;
        if (beats.some(b => Math.abs(b - beat) < 0.1)) {
          pattern += chalk.green('█');
        } else {
          pattern += chalk.gray('·');
        }
        if (i % 4 === 3) pattern += '|';
      }
      console.log(pattern);
    });
  }

  /**
   * Show cyber data streams
   */
  showCyberData() {
    console.log(chalk.dim('\n[QUANTUM HARMONICS]'));
    for (let i = 0; i < 3; i++) {
      const data = Array(40).fill(null).map(() => 
        Math.random() > 0.5 ? '1' : '0'
      ).join('');
      console.log(chalk.dim.green(data));
    }
  }

  /**
   * Show LLM thinking animation
   */
  async showLLMThinking(prompt) {
    // Simple box
    console.log('\n' + chalk.magenta('╔═══════════════════════════════════════╗'));
    console.log(chalk.magenta('║') + chalk.bold.cyan('  🤖 NEURAL PATTERN SYNTHESIS 🤖  ') + chalk.magenta('║'));
    console.log(chalk.magenta('╚═══════════════════════════════════════╝'));
    
    // Show prompt preview
    console.log(chalk.cyan('PROMPT INJECTION:'));
    const promptText = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
    console.log(chalk.dim(promptText.substring(0, 200) + '...'));
    
    // Neural network animation with ora
    const spinner = ora('Activating neural pathways...').start();
    
    // Simulate neural activity
    const neurons = ['⚡', '🧠', '💫', '🌟', '✨'];
    for (let i = 0; i < 20; i++) {
      const activity = neurons.map(n => 
        Math.random() > 0.5 ? chalk.yellow(n) : chalk.dim(n)
      ).join(' ');
      spinner.text = `Neural activity: ${activity}`;
      await this.sleep(100);
    }
    
    spinner.succeed('Pattern synthesis complete!');
  }

  /**
   * Show generated code with syntax highlighting
   */
  showGeneratedCode(code) {
    // Simple box
    console.log('\n' + chalk.green('╔═══════════════════════════════════════╗'));
    console.log(chalk.green('║') + chalk.bold.yellow(' 📝 GENERATED STRUDEL PATTERN 📝 ') + chalk.green('║'));
    console.log(chalk.green('╚═══════════════════════════════════════╝'));
    
    // Syntax highlight the code
    const highlighted = code
      .replace(/setcps/g, chalk.magenta('setcps'))
      .replace(/stack/g, chalk.blue('stack'))
      .replace(/s\(/g, chalk.green('s('))
      .replace(/n\(/g, chalk.yellow('n('))
      .replace(/\d+/g, match => chalk.cyan(match))
      .replace(/"[^"]+"/g, match => chalk.red(match));
    
    console.log(highlighted);
    
    // Code metrics
    const lines = code.split('\n').length;
    const chars = code.length;
    console.log(chalk.dim(`\n[METRICS] Lines: ${lines} | Characters: ${chars} | Complexity: ${Math.floor(Math.random() * 100)}%`));
  }

  /**
   * Show comparison visualization
   */
  showComparison(comparison) {
    // Simple box
    console.log('\n' + chalk.blue('╔═══════════════════════════════════════╗'));
    console.log(chalk.blue('║') + chalk.bold.magenta(' 🔬 PATTERN COMPARISON MATRIX 🔬 ') + chalk.blue('║'));
    console.log(chalk.blue('╚═══════════════════════════════════════╝'));
    
    const metrics = [
      { name: 'TEMPO SYNC', value: 100 - comparison.tempoDiff, unit: '%' },
      { name: 'HARMONIC MATCH', value: comparison.keyMatch ? 100 : 0, unit: '%' },
      { name: 'ENERGY DELTA', value: (1 - comparison.energyDiff) * 100, unit: '%' },
      { name: 'SPECTRAL ALIGN', value: (1 - comparison.brightnessDiff) * 100, unit: '%' },
      { name: 'KICK PATTERN', value: comparison.kickSimilarity * 100, unit: '%' },
      { name: 'SNARE PATTERN', value: comparison.snareSimilarity * 100, unit: '%' }
    ];
    
    metrics.forEach(metric => {
      const barLength = Math.floor(metric.value / 5);
      const bar = '▓'.repeat(barLength) + '░'.repeat(20 - barLength);
      const color = metric.value > 80 ? chalk.green : metric.value > 60 ? chalk.yellow : chalk.red;
      console.log(`${metric.name.padEnd(15)} ${color(bar)} ${metric.value.toFixed(1)}${metric.unit}`);
    });
    
    // Overall score with animation
    const score = comparison.score;
    console.log('\n' + chalk.bold('SIMILARITY SCORE:'));
    this.drawBigNumber(score);
  }

  /**
   * Draw big number display
   */
  drawBigNumber(number) {
    const digits = String(number).split('');
    const digitArt = {
      '0': ['███', '█ █', '███'],
      '1': [' █ ', ' █ ', ' █ '],
      '2': ['███', ' ██', '███'],
      '3': ['███', ' ██', '███'],
      '4': ['█ █', '███', '  █'],
      '5': ['███', '██ ', '███'],
      '6': ['███', '██ ', '███'],
      '7': ['███', '  █', '  █'],
      '8': ['███', '███', '███'],
      '9': ['███', '███', ' ██']
    };
    
    for (let row = 0; row < 3; row++) {
      let line = '';
      digits.forEach(digit => {
        const colors = [chalk.red, chalk.yellow, chalk.green, chalk.cyan, chalk.magenta];
        const color = colors[Math.floor(Math.random() * colors.length)];
        line += color(digitArt[digit][row]) + '  ';
      });
      console.log(line);
    }
  }

  /**
   * Show export progress
   */
  async showExportProgress(duration) {
    console.log('\n' + chalk.bold.cyan('🎧 AUDIO SYNTHESIS IN PROGRESS 🎧'));
    
    const width = 50;
    for (let i = 0; i <= duration; i++) {
      const progress = i / duration;
      const filled = Math.floor(progress * width);
      const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
      
      // Waveform visualization
      const wave = Array(20).fill(null).map(() => 
        '▁▂▃▄▅▆▇█'[Math.floor(Math.random() * 8)]
      ).join('');
      
      process.stdout.write(`\r[${chalk.cyan(bar)}] ${(progress * 100).toFixed(0)}% ${chalk.dim(wave)}`);
      await this.sleep(1000);
    }
    console.log('\n✅ Audio synthesis complete!');
  }

  /**
   * Random glitch effect
   */
  async glitchEffect() {
    const glitchChars = '█▓▒░╔╗╚╝║═╬╣╠';
    const width = 80;
    const height = 5;
    
    for (let frame = 0; frame < 10; frame++) {
      let output = '';
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (Math.random() < 0.1) {
            output += chalk.rgb(
              Math.floor(Math.random() * 255),
              Math.floor(Math.random() * 255),
              Math.floor(Math.random() * 255)
            )(glitchChars[Math.floor(Math.random() * glitchChars.length)]);
          } else {
            output += ' ';
          }
        }
        output += '\n';
      }
      process.stdout.write('\x1b[2J\x1b[H' + output);
      await this.sleep(50);
    }
  }

  /**
   * Show runtime error with visual effects
   */
  async showRuntimeError(error, pattern) {
    console.log('\n');
    console.log(chalk.red('╔═══════════════════════════════════════╗'));
    console.log(chalk.red('║   💀 RUNTIME ERROR DETECTED 💀   ║'));
    console.log(chalk.red('╚═══════════════════════════════════════╝'));
    
    // Glitch effect
    for (let i = 0; i < 3; i++) {
      process.stdout.write('\r' + chalk.red.bold('ERROR: ') + this.generateGlitchText(error.substring(0, 50)));
      await this.sleep(100);
    }
    console.log('\n');
    
    // Show error details
    console.log(chalk.red('ERROR MESSAGE:'));
    console.log(chalk.yellow(error));
    
    // Learn from error
    if (error.includes('is not defined') || error.includes('is not a function')) {
      const match = error.match(/(\w+)\s+is not (defined|a function)/);
      if (match) {
        const invalidName = match[1];
        console.log(chalk.cyan(`\n🧠 LEARNING: "${invalidName}" is not valid`));
        
        // Common corrections
        const corrections = {
          'triangle': 'tri',
          'sawtooth': 'saw'
        };
        
        if (corrections[invalidName]) {
          this.learnedErrors.set(invalidName, corrections[invalidName]);
          console.log(chalk.green(`✓ CORRECTION: Use "${corrections[invalidName]}" instead`));
        }
      }
    }
    
    await this.sleep(1000);
  }

  /**
   * Generate glitch text effect
   */
  generateGlitchText(text) {
    const glitchChars = '█▓▒░╬═║╔╗╚╝';
    return text.split('').map(char => 
      Math.random() > 0.7 ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : char
    ).join('');
  }

  /**
   * Show learned corrections
   */
  showLearnedCorrections() {
    if (this.learnedErrors.size > 0) {
      console.log(chalk.cyan('\n╔═══════════════════════════════════════╗'));
      console.log(chalk.cyan('║   🧠 LEARNED CORRECTIONS 🧠   ║'));
      console.log(chalk.cyan('╚═══════════════════════════════════════╝'));
      
      this.learnedErrors.forEach((correct, wrong) => {
        console.log(chalk.gray(`  "${wrong}" → "${correct}"`));
      });
    }
  }

  /**
   * Extract layers from a stack pattern for individual testing
   */
  extractLayers(pattern) {
    const stackMatch = pattern.match(/stack\s*\(([\s\S]*?)\)/);
    if (!stackMatch) return [];
    
    const stackContent = stackMatch[1];
    const layers = [];
    let currentLayer = '';
    let depth = 0;
    let inString = false;
    let stringChar = null;
    
    for (let i = 0; i < stackContent.length; i++) {
      const char = stackContent[i];
      const prevChar = i > 0 ? stackContent[i - 1] : '';
      
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = null;
        }
      }
      
      if (!inString) {
        if (char === '(') depth++;
        if (char === ')') depth--;
        
        if (char === ',' && depth === 0) {
          if (currentLayer.trim()) {
            layers.push(currentLayer.trim());
          }
          currentLayer = '';
          continue;
        }
      }
      
      currentLayer += char;
    }
    
    if (currentLayer.trim()) {
      layers.push(currentLayer.trim());
    }
    
    return layers;
  }

  /**
   * Show layer-by-layer error analysis with visual effects
   */
  async showLayerAnalysis(pattern, errorDetails) {
    console.log(chalk.magenta('\n╔═══════════════════════════════════════╗'));
    console.log(chalk.magenta('║   🔬 LAYER ANALYSIS MODE 🔬   ║'));
    console.log(chalk.magenta('╚═══════════════════════════════════════╝'));
    
    const layers = this.extractLayers(pattern);
    console.log(chalk.cyan(`\nFound ${layers.length} layers in stack:`));
    
    layers.forEach((layer, i) => {
      const preview = layer.substring(0, 50).replace(/\n/g, ' ');
      console.log(chalk.dim(`  Layer ${i + 1}: ${preview}${layer.length > 50 ? '...' : ''}`));
    });
    
    // Show which layer might have the error
    if (errorDetails?.consoleErrors?.length > 0) {
      const errorText = errorDetails.consoleErrors[0];
      layers.forEach((layer, i) => {
        if (errorText.includes('saw') && layer.includes('.s("saw")')) {
          console.log(chalk.red(`\n⚠️  Layer ${i + 1} might have the error!`));
          console.log(chalk.yellow(`   Suggestion: Check if "saw" sound is available`));
        }
      });
    }
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up spinners
   */
  cleanup() {
    this.spinners.forEach(spinner => spinner.stop());
  }
}