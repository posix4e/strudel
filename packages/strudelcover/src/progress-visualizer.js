import chalk from 'chalk';
import boxen from 'boxen';
import gradient from 'gradient-string';
import ora from 'ora';

/**
 * Multi-track progress visualization system
 */
export class ProgressVisualizer {
  constructor() {
    this.tracks = {
      overall: { name: 'Overall Progress', progress: 0, status: 'pending' },
      analysis: { name: 'Audio Analysis', progress: 0, status: 'pending' },
      drums: { name: 'Drum Track', progress: 0, status: 'pending' },
      bass: { name: 'Bass Track', progress: 0, status: 'pending' },
      chords: { name: 'Harmony Track', progress: 0, status: 'pending' },
      melody: { name: 'Melody Track', progress: 0, status: 'pending' },
      atmosphere: { name: 'Atmosphere', progress: 0, status: 'pending' },
      mixing: { name: 'Final Mix', progress: 0, status: 'pending' }
    };
    
    this.sections = [];
    this.currentSection = null;
    this.spinners = {};
    this.startTime = Date.now();
    this.displayMode = 'detailed'; // 'simple' or 'detailed'
  }

  /**
   * Initialize progress display
   */
  init(songName, totalSections = 0) {
    console.clear();
    
    const title = gradient.rainbow.multiline(`
╔═══════════════════════════════════════════╗
║          STRUDELCOVER PROGRESS            ║
║        Multi-Track Generation             ║
╚═══════════════════════════════════════════╝
    `);
    
    console.log(title);
    console.log(chalk.cyan(`🎵 Processing: ${chalk.bold(songName)}\n`));
    
    if (totalSections > 0) {
      this.initializeSections(totalSections);
    }
    
    this.updateDisplay();
  }

  /**
   * Initialize section tracking
   */
  initializeSections(totalSections) {
    const sectionTypes = ['intro', 'verse', 'chorus', 'bridge', 'outro'];
    
    for (let i = 0; i < totalSections; i++) {
      this.sections.push({
        index: i,
        type: sectionTypes[i % sectionTypes.length],
        progress: 0,
        status: 'pending'
      });
    }
  }

  /**
   * Update track progress
   */
  updateTrackProgress(trackName, progress, status = 'processing') {
    if (this.tracks[trackName]) {
      this.tracks[trackName].progress = Math.min(100, Math.max(0, progress));
      this.tracks[trackName].status = status;
      
      // Update overall progress
      this.updateOverallProgress();
      
      // Redraw display
      this.updateDisplay();
    }
  }

  /**
   * Update section progress
   */
  updateSectionProgress(sectionIndex, progress) {
    if (this.sections[sectionIndex]) {
      this.sections[sectionIndex].progress = Math.min(100, Math.max(0, progress));
      
      if (progress >= 100) {
        this.sections[sectionIndex].status = 'completed';
      } else if (progress > 0) {
        this.sections[sectionIndex].status = 'processing';
      }
      
      this.updateDisplay();
    }
  }

  /**
   * Calculate overall progress
   */
  updateOverallProgress() {
    const trackProgress = Object.values(this.tracks)
      .filter(t => t.name !== 'Overall Progress')
      .reduce((sum, track) => sum + track.progress, 0);
    
    const trackCount = Object.keys(this.tracks).length - 1;
    this.tracks.overall.progress = Math.round(trackProgress / trackCount);
    
    if (this.tracks.overall.progress >= 100) {
      this.tracks.overall.status = 'completed';
    } else if (this.tracks.overall.progress > 0) {
      this.tracks.overall.status = 'processing';
    }
  }

  /**
   * Update the display
   */
  updateDisplay() {
    if (this.displayMode === 'simple') {
      this.updateSimpleDisplay();
    } else {
      this.updateDetailedDisplay();
    }
  }

  /**
   * Simple progress display
   */
  updateSimpleDisplay() {
    console.clear();
    
    const overall = this.tracks.overall;
    const progressBar = this.createProgressBar(overall.progress, 40);
    
    console.log(chalk.cyan.bold('\n🎼 StrudelCover Progress\n'));
    console.log(`${progressBar} ${overall.progress}%`);
    console.log(chalk.gray(`Time elapsed: ${this.getElapsedTime()}`));
  }

  /**
   * Detailed multi-track display
   */
  updateDetailedDisplay() {
    // Move cursor to home position (don't clear to avoid flicker)
    process.stdout.write('\x1B[H');
    
    // Header
    const header = gradient.rainbow(`
╔═══════════════════════════════════════════════════════════════╗
║                    STRUDELCOVER PROGRESS                      ║
╚═══════════════════════════════════════════════════════════════╝
    `);
    
    console.log(header);
    
    // Overall progress
    const overall = this.tracks.overall;
    const overallBar = this.createColoredProgressBar(overall.progress, 50);
    console.log(chalk.white.bold('\n📊 Overall Progress'));
    console.log(`${overallBar} ${chalk.cyan.bold(`${overall.progress}%`)}`);
    
    // Track progress
    console.log(chalk.white.bold('\n🎹 Track Generation'));
    Object.entries(this.tracks).forEach(([key, track]) => {
      if (key !== 'overall') {
        this.displayTrack(track);
      }
    });
    
    // Section progress (if available)
    if (this.sections.length > 0) {
      console.log(chalk.white.bold('\n📍 Song Sections'));
      this.displaySections();
    }
    
    // Stats
    console.log(chalk.white.bold('\n⏱️  Statistics'));
    console.log(chalk.gray(`   Time elapsed: ${this.getElapsedTime()}`));
    console.log(chalk.gray(`   Status: ${this.getStatus()}`));
    
    // Clear remaining lines
    console.log('\n\n\n');
  }

  /**
   * Display individual track progress
   */
  displayTrack(track) {
    const icon = this.getTrackIcon(track.name);
    const statusIcon = this.getStatusIcon(track.status);
    const bar = this.createProgressBar(track.progress, 30);
    const color = this.getStatusColor(track.status);
    
    console.log(
      `${icon} ${chalk[color](track.name.padEnd(15))} ${bar} ${chalk[color](`${track.progress}%`)} ${statusIcon}`
    );
  }

  /**
   * Display section progress
   */
  displaySections() {
    const sectionsPerLine = 8;
    const lines = Math.ceil(this.sections.length / sectionsPerLine);
    
    for (let line = 0; line < lines; line++) {
      let lineStr = '   ';
      
      for (let i = 0; i < sectionsPerLine; i++) {
        const index = line * sectionsPerLine + i;
        if (index < this.sections.length) {
          const section = this.sections[index];
          const icon = this.getSectionIcon(section);
          lineStr += `${icon} `;
        }
      }
      
      console.log(lineStr);
    }
  }

  /**
   * Create a progress bar
   */
  createProgressBar(progress, width = 30) {
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    
    const filledChar = '█';
    const emptyChar = '░';
    
    return chalk.green(filledChar.repeat(filled)) + chalk.gray(emptyChar.repeat(empty));
  }

  /**
   * Create a colored gradient progress bar
   */
  createColoredProgressBar(progress, width = 30) {
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    
    const filledBar = '█'.repeat(filled);
    const emptyBar = '░'.repeat(empty);
    
    const gradientBar = gradient(['#ff0000', '#ffff00', '#00ff00'])(filledBar);
    
    return gradientBar + chalk.gray(emptyBar);
  }

  /**
   * Get track icon
   */
  getTrackIcon(trackName) {
    const icons = {
      'Audio Analysis': '🔍',
      'Drum Track': '🥁',
      'Bass Track': '🎸',
      'Harmony Track': '🎹',
      'Melody Track': '🎵',
      'Atmosphere': '🌊',
      'Final Mix': '🎛️'
    };
    
    return icons[trackName] || '🎼';
  }

  /**
   * Get status icon
   */
  getStatusIcon(status) {
    const icons = {
      'pending': chalk.gray('⏸'),
      'processing': chalk.yellow('⚡'),
      'completed': chalk.green('✓'),
      'error': chalk.red('✗')
    };
    
    return icons[status] || '';
  }

  /**
   * Get status color
   */
  getStatusColor(status) {
    const colors = {
      'pending': 'gray',
      'processing': 'yellow',
      'completed': 'green',
      'error': 'red'
    };
    
    return colors[status] || 'white';
  }

  /**
   * Get section icon
   */
  getSectionIcon(section) {
    if (section.status === 'completed') {
      return chalk.green('●');
    } else if (section.status === 'processing') {
      return chalk.yellow('◐');
    } else {
      return chalk.gray('○');
    }
  }

  /**
   * Get elapsed time
   */
  getElapsedTime() {
    const elapsed = Date.now() - this.startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Get current status
   */
  getStatus() {
    const processing = Object.values(this.tracks).filter(t => t.status === 'processing').length;
    const completed = Object.values(this.tracks).filter(t => t.status === 'completed').length;
    
    if (completed === Object.keys(this.tracks).length) {
      return chalk.green('Complete!');
    } else if (processing > 0) {
      return chalk.yellow(`Processing ${processing} tracks...`);
    } else {
      return chalk.gray('Initializing...');
    }
  }

  /**
   * Show completion message
   */
  showCompletion(outputPath) {
    console.clear();
    
    const message = boxen(
      chalk.green.bold('✨ Generation Complete! ✨\n\n') +
      chalk.white(`Output saved to:\n${chalk.cyan(outputPath)}\n\n`) +
      chalk.gray(`Total time: ${this.getElapsedTime()}`),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'green',
        align: 'center'
      }
    );
    
    console.log(message);
  }

  /**
   * Show error message
   */
  showError(error) {
    const message = boxen(
      chalk.red.bold('❌ Error Occurred ❌\n\n') +
      chalk.white(error.message),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'red'
      }
    );
    
    console.log(message);
  }

  /**
   * Create a spinner for async operations
   */
  createSpinner(text, trackName = null) {
    const spinner = ora({
      text,
      spinner: 'dots',
      color: 'cyan'
    });
    
    if (trackName) {
      this.spinners[trackName] = spinner;
    }
    
    return spinner;
  }

  /**
   * Update spinner text
   */
  updateSpinner(trackName, text) {
    if (this.spinners[trackName]) {
      this.spinners[trackName].text = text;
    }
  }

  /**
   * Success spinner
   */
  succeedSpinner(trackName, text) {
    if (this.spinners[trackName]) {
      this.spinners[trackName].succeed(text);
      delete this.spinners[trackName];
    }
  }

  /**
   * Fail spinner
   */
  failSpinner(trackName, text) {
    if (this.spinners[trackName]) {
      this.spinners[trackName].fail(text);
      delete this.spinners[trackName];
    }
  }
}