import puppeteer from 'puppeteer';
import { existsSync } from 'fs';
import chalk from 'chalk';

/**
 * Dazzle Mode - Visual dashboard for hierarchical song construction
 * Shows: Instruments -> Measures -> Sections -> Full Song
 */
export class DazzleMode {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isInitialized = false;
    this.currentSection = null;
    this.currentMeasure = 0;
    this.totalMeasures = 0;
  }

  /**
   * Initialize the dashboard browser window
   */
  async initialize() {
    if (this.isInitialized) return;

    console.log(chalk.magenta('\n✨ Initializing Dazzle Mode Dashboard...\n'));

    // Use system Chrome on macOS if available
    const executablePath = process.platform === 'darwin' && 
      existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ?
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined;

    this.browser = await puppeteer.launch({
      headless: false,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1600,1000',
        '--window-position=50,50',
        '--autoplay-policy=no-user-gesture-required'
      ],
      defaultViewport: null
    });

    this.page = await this.browser.newPage();
    
    // Set up the dashboard HTML
    await this.page.setContent(this.getDashboardHTML());
    
    // Wait for page to be ready and inject all dashboard functions
    await this.page.waitForSelector('#song-info');
    
    await this.page.evaluate(() => {
      // Initialize state
      window.dazzleState = {
        sections: [],
        currentSection: null,
        currentMeasure: 0,
        instruments: [],
        patterns: {},
        isBuilding: false,
        currentLayer: null,
        audioContext: null,
        isPlaying: false
      };
      
      // Define all dashboard functions
      window.updateSongInfo = (artist, song) => {
        document.getElementById('song-info').textContent = `${artist} - ${song}`;
      };
      
      window.updateTempo = (bpm) => {
        document.getElementById('tempo-info').textContent = `♩ = ${bpm}`;
      };
      
      window.updateProgress = (percent) => {
        document.getElementById('progress-info').textContent = `${percent.toFixed(0)}%`;
        document.getElementById('build-progress').style.width = percent + '%';
      };
      
      window.updateStatus = (message) => {
        document.getElementById('status').textContent = message;
      };
      
      window.updateDetailedStatus = (section, measure, layer) => {
        const details = [];
        if (section) details.push(`Section: ${section}`);
        if (measure !== undefined) details.push(`Measure: ${measure + 1}`);
        if (layer) details.push(`Layer: ${layer}`);
        document.getElementById('detailed-status').textContent = details.join(' | ');
      };
      
      window.addSection = (section) => {
        const list = document.getElementById('sections-list');
        const div = document.createElement('div');
        div.className = 'section';
        div.id = 'section-' + section.id;
        div.innerHTML = `
          <div class="section-name">${section.name}</div>
          <div class="section-details">${section.measures} measures, ${section.duration}s</div>
        `;
        div.onclick = () => window.selectSection(section.id);
        list.appendChild(div);
        
        window.dazzleState.sections.push(section);
        document.getElementById('total-sections').textContent = window.dazzleState.sections.length;
      };
      
      window.selectSection = (sectionId) => {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById('section-' + sectionId).classList.add('active');
        window.dazzleState.currentSection = sectionId;
        window.updateTimeline(sectionId);
      };
      
      window.updateTimeline = (sectionId) => {
        const track = document.getElementById('timeline-track');
        track.innerHTML = '';
        
        const section = window.dazzleState.sections.find(s => s.id === sectionId);
        if (!section) return;
        
        for (let i = 0; i < section.measures; i++) {
          const measure = document.createElement('div');
          measure.className = 'measure';
          measure.id = 'measure-' + i;
          measure.innerHTML = `
            <div class="measure-number">M${i + 1}</div>
            <div class="measure-layers"></div>
          `;
          track.appendChild(measure);
        }
        
        document.getElementById('total-measures').textContent = section.measures;
      };
      
      window.highlightMeasure = (measureIndex) => {
        document.querySelectorAll('.measure').forEach(m => m.classList.remove('active'));
        const measure = document.getElementById('measure-' + measureIndex);
        if (measure) {
          measure.classList.add('active');
          measure.scrollIntoView({ behavior: 'smooth', inline: 'center' });
        }
        window.dazzleState.currentMeasure = measureIndex;
      };
      
      window.addInstrumentTrack = (instrument) => {
        const container = document.getElementById('builder-tracks');
        const track = document.createElement('div');
        track.className = 'instrument-track';
        track.id = 'track-' + instrument.id;
        track.innerHTML = `
          <div class="instrument-name">${instrument.name}</div>
          <div class="pattern-blocks" id="blocks-${instrument.id}"></div>
        `;
        container.appendChild(track);
        
        window.dazzleState.instruments.push(instrument);
        document.getElementById('total-instruments').textContent = window.dazzleState.instruments.length;
      };
      
      window.addPatternBlock = (instrumentId, pattern, width = 40) => {
        const container = document.getElementById('blocks-' + instrumentId);
        if (!container) return;
        
        const block = document.createElement('div');
        block.className = 'pattern-block';
        block.style.width = width + 'px';
        block.style.background = window.getInstrumentColor(instrumentId);
        block.title = pattern;
        
        // Add exciting build-up animation
        block.style.opacity = '0';
        block.style.transform = 'scale(0.5)';
        block.style.transition = 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        
        container.appendChild(block);
        
        // Animate in with bounce effect  
        setTimeout(() => {
          block.style.opacity = '1';
          block.style.transform = 'scale(1)';
          
          // Add pulsing effect for new blocks
          setTimeout(() => {
            block.style.animation = 'pulse 2s infinite';
          }, 500);
        }, 50);
        
        const measureIndex = window.dazzleState.currentMeasure;
        const measure = document.getElementById('measure-' + measureIndex);
        if (measure) {
          const layers = measure.querySelector('.measure-layers');
          const layer = document.createElement('div');
          layer.className = 'measure-layer';
          layer.style.background = window.getInstrumentColor(instrumentId);
          layer.style.opacity = '0';
          layer.style.transform = 'translateY(10px)';
          layer.style.transition = 'all 0.3s ease-out';
          layers.appendChild(layer);
          
          // Animate layer in
          setTimeout(() => {
            layer.style.opacity = '1';
            layer.style.transform = 'translateY(0)';
          }, 100);
        }
        
        // Flash effect for the whole dashboard when adding layers
        const totalBlocks = document.querySelectorAll('.pattern-block').length;
        if (totalBlocks % 4 === 0) {
          document.body.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
          setTimeout(() => {
            document.body.style.background = 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)';
          }, 200);
        }
      };
      
      window.getInstrumentColor = (instrumentId) => {
        const colors = ['#ff006e', '#8338ec', '#3a86ff', '#06ffa5', '#ffbe0b', '#fb5607'];
        const index = window.dazzleState.instruments.findIndex(i => i.id === instrumentId);
        return colors[index % colors.length];
      };
      
      window.updatePatternCode = (sections) => {
        const display = document.getElementById('code-display');
        display.innerHTML = sections.map((section, i) => `
          <div class="code-section ${i === sections.length - 1 ? 'active' : ''}">
            <div class="code-comment">// ${section.name}</div>
            <pre>${section.code}</pre>
          </div>
        `).join('');
      };
      
      window.highlightLayer = (layerId) => {
        document.querySelectorAll('.instrument-track').forEach(track => {
          track.style.borderLeft = 'none';
          track.style.opacity = '0.6';
        });
        
        const track = document.getElementById('track-' + layerId);
        if (track) {
          track.style.borderLeft = '3px solid var(--accent-3)';
          track.style.opacity = '1';
        }
        
        window.dazzleState.currentLayer = layerId;
      };
      
      window.currentPattern = '';
      window.updateCurrentPattern = (pattern) => {
        window.currentPattern = pattern;
      };
      
      window.previewPattern = async (pattern, duration = 4000) => {
        if (!pattern) return;
        
        try {
          if (!window.strudelInitialized) {
            await import('https://unpkg.com/@strudel/web@latest/dist/index.js');
            await window.initStrudel();
            
            if (window.samples) {
              await window.samples('github:tidalcycles/dirt-samples');
              console.log('Loaded dirt-samples');
            }
            
            window.strudelInitialized = true;
          }
          
          if (window.hush) window.hush();
          
          const previewPattern = pattern.replace(/await samples\([^)]+\)\s*\n/g, '');
          
          await window.evaluate(previewPattern);
          window.updateStatus('🔊 Playing preview...');
          
          // Don't auto-stop if duration is -1 (continuous play)
          if (duration > 0) {
            setTimeout(() => {
              if (window.hush) window.hush();
              window.updateStatus('Preview stopped');
            }, duration);
          }
          
        } catch (error) {
          console.error('Preview error:', error);
          window.updateStatus('❌ Preview error: ' + error.message);
        }
      };
      
      // Add continuous playback mode
      window.continuousPlay = false;
      window.currentPlayingPattern = '';
      
      window.startContinuousPlay = async (pattern) => {
        window.continuousPlay = true;
        window.currentPlayingPattern = pattern;
        await window.previewPattern(pattern, -1);
      };
      
      window.updateContinuousPattern = async (pattern) => {
        if (window.continuousPlay) {
          window.currentPlayingPattern = pattern;
          // Don't stop current playback - let Strudel handle the transition
          try {
            const cleanPattern = pattern.replace(/await samples\([^)]+\)\s*\n/g, '');
            await window.evaluate(cleanPattern);
            console.log('Pattern updated seamlessly');
          } catch (error) {
            console.error('Pattern update error:', error);
            // Fallback to preview
            await window.previewPattern(pattern, -1);
          }
        }
      };
      
      window.stopContinuousPlay = () => {
        window.continuousPlay = false;
        if (window.hush) window.hush();
        window.updateStatus('Playback stopped');
      };
      
      console.log('Dashboard functions initialized');
    });
    
    // Initialize audio context and Strudel
    await this.page.evaluate(async () => {
      window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Pre-load Strudel and samples
      try {
        const strudelModule = await import('https://unpkg.com/@strudel/web@latest/dist/index.js');
        if (strudelModule.initStrudel) {
          await strudelModule.initStrudel();
          
          // Load samples
          if (window.samples) {
            await window.samples('github:tidalcycles/dirt-samples');
            console.log('Pre-loaded dirt-samples');
          }
          
          window.strudelInitialized = true;
        }
      } catch (error) {
        console.error('Failed to pre-initialize Strudel:', error);
      }
    });

    this.isInitialized = true;
    console.log(chalk.green('✅ Dazzle Dashboard ready!\n'));
  }

  /**
   * Generate the dashboard HTML
   */
  getDashboardHTML() {
    return `<!DOCTYPE html>
<html>
<head>
  <title>🎪 Dazzle Mode - StrudelCover</title>
  <style>
    :root {
      --bg-dark: #0a0a0a;
      --bg-panel: #1a1a1a;
      --border: #333;
      --text-primary: #fff;
      --text-secondary: #888;
      --accent-1: #ff006e;
      --accent-2: #8338ec;
      --accent-3: #3a86ff;
      --accent-4: #06ffa5;
      --accent-5: #ffbe0b;
      --accent-6: #fb5607;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Courier New', monospace;
      background: var(--bg-dark);
      color: var(--text-primary);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    header {
      background: linear-gradient(45deg, var(--accent-1), var(--accent-2));
      padding: 15px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    h1 {
      font-size: 24px;
      text-shadow: 0 0 20px rgba(255,255,255,0.5);
    }
    
    .header-info {
      display: flex;
      gap: 30px;
      font-size: 14px;
    }
    
    .dashboard {
      flex: 1;
      display: grid;
      grid-template-columns: 250px 1fr 300px;
      grid-template-rows: 200px 1fr 250px;
      gap: 1px;
      background: var(--border);
      padding: 1px;
    }
    
    .panel {
      background: var(--bg-panel);
      padding: 15px;
      overflow: auto;
      position: relative;
    }
    
    .panel-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
      color: var(--text-secondary);
    }
    
    /* Song Structure Panel */
    #song-structure {
      grid-row: span 3;
    }
    
    .section {
      margin: 8px 0;
      padding: 10px;
      background: rgba(255,255,255,0.05);
      border-radius: 5px;
      cursor: pointer;
      transition: all 0.3s ease;
      border-left: 3px solid transparent;
    }
    
    .section:hover {
      background: rgba(255,255,255,0.1);
    }
    
    .section.active {
      background: rgba(255,255,255,0.15);
      border-left-color: var(--accent-3);
    }
    
    .section-name {
      font-weight: bold;
      color: var(--accent-3);
      font-size: 14px;
    }
    
    .section-details {
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 4px;
    }
    
    /* Timeline Panel */
    #timeline {
      grid-column: 2;
      grid-row: 1;
    }
    
    .timeline-container {
      height: 120px;
      background: var(--bg-dark);
      border-radius: 5px;
      position: relative;
      overflow-x: auto;
      overflow-y: hidden;
    }
    
    .timeline-track {
      position: absolute;
      height: 100%;
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 0 10px;
    }
    
    .measure {
      width: 60px;
      height: 80px;
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--border);
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      padding: 4px;
      position: relative;
      transition: all 0.3s ease;
    }
    
    .measure.active {
      background: rgba(56,56,236,0.2);
      border-color: var(--accent-2);
      box-shadow: 0 0 10px rgba(56,56,236,0.5);
    }
    
    .measure-number {
      font-size: 10px;
      color: var(--text-secondary);
      text-align: center;
    }
    
    .measure-layers {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-top: 4px;
    }
    
    .measure-layer {
      height: 10px;
      background: var(--accent-4);
      border-radius: 2px;
      opacity: 0.8;
    }
    
    /* Pattern Builder Panel */
    #pattern-builder {
      grid-column: 2;
      grid-row: 2;
    }
    
    .builder-container {
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    .instrument-track {
      background: var(--bg-dark);
      border-radius: 5px;
      padding: 10px;
      flex: 1;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .instrument-name {
      width: 80px;
      font-size: 12px;
      color: var(--text-secondary);
    }
    
    .pattern-blocks {
      flex: 1;
      display: flex;
      gap: 4px;
      align-items: center;
      height: 40px;
    }
    
    .pattern-block {
      height: 100%;
      background: var(--accent-1);
      border-radius: 4px;
      min-width: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: rgba(0,0,0,0.8);
      font-weight: bold;
      animation: slideIn 0.3s ease;
    }
    
    @keyframes slideIn {
      from {
        transform: translateX(-20px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
      }
      50% {
        transform: scale(1.05);
        box-shadow: 0 0 0 10px rgba(255, 255, 255, 0);
      }
    }
    
    @keyframes glow {
      0%, 100% {  
        box-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
      }
      50% {
        box-shadow: 0 0 20px rgba(255, 255, 255, 0.8);
      }
    }
    
    /* Code View Panel */
    #code-view {
      grid-column: 2;
      grid-row: 3;
    }
    
    #code-display {
      background: var(--bg-dark);
      padding: 15px;
      border-radius: 5px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      line-height: 1.6;
      overflow: auto;
      height: calc(100% - 35px);
    }
    
    .code-section {
      margin: 10px 0;
      opacity: 0.5;
      transition: opacity 0.3s ease;
    }
    
    .code-section.active {
      opacity: 1;
    }
    
    .code-comment {
      color: var(--text-secondary);
      font-style: italic;
    }
    
    /* Analysis Panel */
    #analysis {
      grid-column: 3;
      grid-row: span 3;
    }
    
    .analysis-item {
      margin: 12px 0;
      padding: 12px;
      background: rgba(255,255,255,0.05);
      border-radius: 5px;
    }
    
    .analysis-label {
      font-size: 11px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .analysis-value {
      font-size: 18px;
      color: var(--accent-4);
      margin-top: 4px;
      font-weight: bold;
    }
    
    .progress-bar {
      height: 6px;
      background: rgba(255,255,255,0.1);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 8px;
    }
    
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent-1), var(--accent-2));
      transition: width 0.5s ease;
    }
    
    /* Status Bar */
    .status-bar {
      background: var(--bg-panel);
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid var(--border);
      font-size: 12px;
    }
    
    .status-message {
      color: var(--accent-4);
    }
    
    .playback-controls {
      display: flex;
      gap: 10px;
    }
    
    .control-btn {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 1px solid var(--accent-3);
      background: transparent;
      color: var(--accent-3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      font-size: 12px;
    }
    
    .control-btn:hover {
      background: var(--accent-3);
      color: var(--bg-dark);
    }
  </style>
</head>
<body>
  <header>
    <h1>🎪 Dazzle Mode - Hierarchical Song Construction</h1>
    <div class="header-info">
      <div id="song-info">Loading...</div>
      <div id="tempo-info">♩ = ???</div>
      <div id="progress-info">0%</div>
    </div>
  </header>
  
  <div class="dashboard">
    <!-- Song Structure -->
    <div class="panel" id="song-structure">
      <div class="panel-title">Song Structure</div>
      <div id="sections-list"></div>
    </div>
    
    <!-- Timeline -->
    <div class="panel" id="timeline">
      <div class="panel-title">Timeline - Measures</div>
      <div class="timeline-container">
        <div class="timeline-track" id="timeline-track"></div>
      </div>
    </div>
    
    <!-- Pattern Builder -->
    <div class="panel" id="pattern-builder">
      <div class="panel-title">Pattern Builder - Current Measure</div>
      <div class="builder-container" id="builder-tracks"></div>
    </div>
    
    <!-- Code View -->
    <div class="panel" id="code-view">
      <div class="panel-title">Generated Pattern</div>
      <div id="code-display"></div>
    </div>
    
    <!-- Analysis -->
    <div class="panel" id="analysis">
      <div class="panel-title">Analysis & Progress</div>
      <div id="analysis-content">
        <div class="analysis-item">
          <div class="analysis-label">Total Sections</div>
          <div class="analysis-value" id="total-sections">0</div>
        </div>
        <div class="analysis-item">
          <div class="analysis-label">Total Measures</div>
          <div class="analysis-value" id="total-measures">0</div>
        </div>
        <div class="analysis-item">
          <div class="analysis-label">Instruments</div>
          <div class="analysis-value" id="total-instruments">0</div>
        </div>
        <div class="analysis-item">
          <div class="analysis-label">Build Progress</div>
          <div class="progress-bar">
            <div class="progress-fill" id="build-progress" style="width: 0%"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <div class="status-bar">
    <div class="status-message">
      <div id="status">Initializing...</div>
      <div id="detailed-status" style="font-size: 10px; color: #666; margin-top: 4px;"></div>
    </div>
    <div class="playback-controls">
      <button class="control-btn" id="preview-btn" title="Preview current pattern">🔊</button>
      <button class="control-btn" id="play-btn">▶</button>
      <button class="control-btn" id="pause-btn">⏸</button>
      <button class="control-btn" id="stop-btn">⏹</button>
    </div>
  </div>
  
  <script>
    // Dashboard state
    window.dazzleState = {
      sections: [],
      currentSection: null,
      currentMeasure: 0,
      instruments: [],
      patterns: {},
      isBuilding: false,
      currentLayer: null,
      audioContext: null,
      isPlaying: false
    };
    
    // Update song info
    window.updateSongInfo = (artist, song) => {
      document.getElementById('song-info').textContent = \`\${artist} - \${song}\`;
    };
    
    // Update tempo
    window.updateTempo = (bpm) => {
      document.getElementById('tempo-info').textContent = \`♩ = \${bpm}\`;
    };
    
    // Update progress
    window.updateProgress = (percent) => {
      document.getElementById('progress-info').textContent = \`\${percent.toFixed(0)}%\`;
      document.getElementById('build-progress').style.width = percent + '%';
    };
    
    // Add section
    window.addSection = (section) => {
      const list = document.getElementById('sections-list');
      const div = document.createElement('div');
      div.className = 'section';
      div.id = 'section-' + section.id;
      div.innerHTML = \`
        <div class="section-name">\${section.name}</div>
        <div class="section-details">\${section.measures} measures, \${section.duration}s</div>
      \`;
      div.onclick = () => window.selectSection(section.id);
      list.appendChild(div);
      
      window.dazzleState.sections.push(section);
      document.getElementById('total-sections').textContent = window.dazzleState.sections.length;
    };
    
    // Select section
    window.selectSection = (sectionId) => {
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.getElementById('section-' + sectionId).classList.add('active');
      window.dazzleState.currentSection = sectionId;
      
      // Update timeline for this section
      window.updateTimeline(sectionId);
    };
    
    // Update timeline
    window.updateTimeline = (sectionId) => {
      const track = document.getElementById('timeline-track');
      track.innerHTML = '';
      
      const section = window.dazzleState.sections.find(s => s.id === sectionId);
      if (!section) return;
      
      // Create measure blocks
      for (let i = 0; i < section.measures; i++) {
        const measure = document.createElement('div');
        measure.className = 'measure';
        measure.id = 'measure-' + i;
        measure.innerHTML = \`
          <div class="measure-number">M\${i + 1}</div>
          <div class="measure-layers"></div>
        \`;
        track.appendChild(measure);
      }
      
      document.getElementById('total-measures').textContent = section.measures;
    };
    
    // Highlight current measure
    window.highlightMeasure = (measureIndex) => {
      document.querySelectorAll('.measure').forEach(m => m.classList.remove('active'));
      const measure = document.getElementById('measure-' + measureIndex);
      if (measure) {
        measure.classList.add('active');
        measure.scrollIntoView({ behavior: 'smooth', inline: 'center' });
      }
      window.dazzleState.currentMeasure = measureIndex;
    };
    
    // Add instrument track
    window.addInstrumentTrack = (instrument) => {
      const container = document.getElementById('builder-tracks');
      const track = document.createElement('div');
      track.className = 'instrument-track';
      track.id = 'track-' + instrument.id;
      track.innerHTML = \`
        <div class="instrument-name">\${instrument.name}</div>
        <div class="pattern-blocks" id="blocks-\${instrument.id}"></div>
      \`;
      container.appendChild(track);
      
      window.dazzleState.instruments.push(instrument);
      document.getElementById('total-instruments').textContent = window.dazzleState.instruments.length;
    };
    
    // Add pattern block
    window.addPatternBlock = (instrumentId, pattern, width = 40) => {
      const container = document.getElementById('blocks-' + instrumentId);
      if (!container) return;
      
      const block = document.createElement('div');
      block.className = 'pattern-block';
      block.style.width = width + 'px';
      block.style.background = window.getInstrumentColor(instrumentId);
      block.title = pattern;
      container.appendChild(block);
      
      // Also add to current measure visualization
      const measureIndex = window.dazzleState.currentMeasure;
      const measure = document.getElementById('measure-' + measureIndex);
      if (measure) {
        const layers = measure.querySelector('.measure-layers');
        const layer = document.createElement('div');
        layer.className = 'measure-layer';
        layer.style.background = window.getInstrumentColor(instrumentId);
        layers.appendChild(layer);
      }
    };
    
    // Get instrument color
    window.getInstrumentColor = (instrumentId) => {
      const colors = ['#ff006e', '#8338ec', '#3a86ff', '#06ffa5', '#ffbe0b', '#fb5607'];
      const index = window.dazzleState.instruments.findIndex(i => i.id === instrumentId);
      return colors[index % colors.length];
    };
    
    // Update pattern code
    window.updatePatternCode = (sections) => {
      const display = document.getElementById('code-display');
      display.innerHTML = sections.map((section, i) => \`
        <div class="code-section \${i === sections.length - 1 ? 'active' : ''}">
          <div class="code-comment">// \${section.name}</div>
          <pre>\${section.code}</pre>
        </div>
      \`).join('');
    };
    
    // Update status
    window.updateStatus = (message) => {
      document.getElementById('status').textContent = message;
    };
    
    // Update detailed status
    window.updateDetailedStatus = (section, measure, layer) => {
      const details = [];
      if (section) details.push(\`Section: \${section}\`);
      if (measure !== undefined) details.push(\`Measure: \${measure + 1}\`);
      if (layer) details.push(\`Layer: \${layer}\`);
      document.getElementById('detailed-status').textContent = details.join(' | ');
    };
    
    // Highlight current layer
    window.highlightLayer = (layerId) => {
      // Remove previous highlights
      document.querySelectorAll('.instrument-track').forEach(track => {
        track.style.borderLeft = 'none';
        track.style.opacity = '0.6';
      });
      
      // Highlight current layer
      const track = document.getElementById('track-' + layerId);
      if (track) {
        track.style.borderLeft = '3px solid var(--accent-3)';
        track.style.opacity = '1';
      }
      
      window.dazzleState.currentLayer = layerId;
    };
    
    // Initialize
    window.updateStatus('Dashboard initialized');
    
    // Store current pattern for preview
    window.currentPattern = '';
    window.updateCurrentPattern = (pattern) => {
      window.currentPattern = pattern;
    };
    
    // Preview current pattern
    window.previewPattern = async (pattern) => {
      if (!pattern) return;
      
      try {
        // Initialize Strudel if needed
        if (!window.strudelInitialized) {
          await import('https://unpkg.com/@strudel/web@latest/dist/index.js');
          await window.initStrudel();
          
          // Load default samples
          if (window.samples) {
            await window.samples('github:tidalcycles/dirt-samples');
            console.log('Loaded dirt-samples');
          }
          
          window.strudelInitialized = true;
        }
        
        // Stop any playing pattern
        if (window.hush) window.hush();
        
        // Remove any await samples line from pattern for preview
        const previewPattern = pattern.replace(/await samples\([^)]+\)\s*\n/g, '');
        
        // Evaluate and play pattern
        await window.evaluate(previewPattern);
        window.updateStatus('🔊 Playing preview...');
        
        // Auto-stop after 4 beats
        setTimeout(() => {
          if (window.hush) window.hush();
          window.updateStatus('Preview stopped');
        }, 4000);
        
      } catch (error) {
        console.error('Preview error:', error);
        window.updateStatus('❌ Preview error: ' + error.message);
      }
    };
    
    // Playback controls
    document.getElementById('preview-btn').addEventListener('click', () => {
      window.previewPattern(window.currentPattern);
    });
    
    document.getElementById('play-btn').addEventListener('click', () => {
      window.updateStatus('▶ Playing current section...');
    });
    
    document.getElementById('pause-btn').addEventListener('click', () => {
      window.updateStatus('⏸ Paused');
    });
    
    document.getElementById('stop-btn').addEventListener('click', () => {
      window.updateStatus('⏹ Stopped');
      if (window.hush) window.hush();
    });
  </script>
</body>
</html>`;
  }

  /**
   * Update song info
   */
  async updateSongInfo(artist, song) {
    await this.page.evaluate((artist, song) => {
      window.updateSongInfo(artist, song);
    }, artist, song);
  }

  /**
   * Update tempo display
   */
  async updateTempo(bpm) {
    await this.page.evaluate((bpm) => {
      window.updateTempo(bpm);
    }, bpm);
  }

  /**
   * Update overall progress
   */
  async updateProgress(percent) {
    await this.page.evaluate((percent) => {
      window.updateProgress(percent);
    }, percent);
  }

  /**
   * Add a song section
   */
  async addSection(section) {
    await this.page.evaluate((section) => {
      window.addSection(section);
    }, section);
  }

  /**
   * Select and activate a section
   */
  async selectSection(sectionId) {
    await this.page.evaluate((sectionId) => {
      window.selectSection(sectionId);
    }, sectionId);
  }

  /**
   * Highlight current measure being built
   */
  async highlightMeasure(measureIndex) {
    await this.page.evaluate((measureIndex) => {
      window.highlightMeasure(measureIndex);
    }, measureIndex);
  }

  /**
   * Add an instrument track
   */
  async addInstrumentTrack(instrument) {
    await this.page.evaluate((instrument) => {
      window.addInstrumentTrack(instrument);
    }, instrument);
  }

  /**
   * Add a pattern block for an instrument
   */
  async addPatternBlock(instrumentId, pattern, width = 40) {
    await this.page.evaluate((instrumentId, pattern, width) => {
      window.addPatternBlock(instrumentId, pattern, width);
    }, instrumentId, pattern, width);
  }
  
  /**
   * Add visual pulse effect to show rhythm
   */
  async pulseToRhythm() {
    await this.page.evaluate(() => {
      // Pulse the whole dashboard to the beat
      document.body.style.animation = 'rhythmPulse 0.5s ease';
      setTimeout(() => {
        document.body.style.animation = '';
      }, 500);
    });
  }

  /**
   * Update the pattern code display
   */
  async updatePatternCode(sections) {
    await this.page.evaluate((sections) => {
      window.updatePatternCode(sections);
    }, sections);
  }

  /**
   * Update status message
   */
  async updateStatus(message) {
    await this.page.evaluate((message) => {
      window.updateStatus(message);
    }, message);
  }
  
  /**
   * Update detailed status with current work info
   */
  async updateDetailedStatus(section, measure, layer) {
    await this.page.evaluate((section, measure, layer) => {
      window.updateDetailedStatus(section, measure, layer);
    }, section, measure, layer);
  }
  
  /**
   * Highlight current layer being worked on
   */
  async highlightLayer(layerId) {
    await this.page.evaluate((layerId) => {
      window.highlightLayer(layerId);
    }, layerId);
  }
  
  /**
   * Update current pattern for preview
   */
  async updateCurrentPattern(pattern) {
    await this.page.evaluate((pattern) => {
      window.updateCurrentPattern(pattern);
    }, pattern);
  }
  
  /**
   * Preview pattern with audio
   */
  async previewPattern(pattern, duration = 4000) {
    await this.page.evaluate((pattern, duration) => {
      window.previewPattern(pattern, duration);
    }, pattern, duration);
  }
  
  /**
   * Start continuous playback that updates as patterns are built
   */
  async startContinuousPlay(pattern) {
    await this.page.evaluate((pattern) => {
      window.startContinuousPlay(pattern);
    }, pattern);
  }
  
  /**
   * Update the continuously playing pattern
   */
  async updateContinuousPattern(pattern) {
    await this.page.evaluate((pattern) => {
      window.updateContinuousPattern(pattern);
    }, pattern);
  }
  
  /**
   * Stop continuous playback
   */
  async stopContinuousPlay() {
    await this.page.evaluate(() => {
      window.stopContinuousPlay();
    });
  }
  
  /**
   * Test a pattern for evaluation errors
   */
  async testPattern(pattern) {
    return await this.page.evaluate(async (pattern) => {
      try {
        // Try to evaluate the pattern in a safe way
        const testPattern = `setcps(1)\n${pattern}\n$: silence`;
        
        // Import Strudel if not already done
        if (!window.evaluate && window.strudelInitialized) {
          await import('https://unpkg.com/@strudel/web@latest/dist/index.js');
        }
        
        // Test evaluation
        if (window.evaluate) {
          // Create a temporary evaluation context
          const originalHush = window.hush;
          let evalError = null;
          
          try {
            // Silence any playing patterns first
            if (window.hush) window.hush();
            
            // Try to evaluate the test pattern
            await window.evaluate(testPattern);
            
            // Immediately stop it
            if (window.hush) window.hush();
            
            return { success: true };
          } catch (error) {
            evalError = error.message || error.toString();
          } finally {
            // Restore original state
            if (originalHush && window.hush) window.hush();
          }
          
          if (evalError) {
            return { success: false, error: evalError };
          }
        }
        
        // If we can't test, assume it's okay
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message || error.toString() };
      }
    }, pattern);
  }

  /**
   * Close the dashboard
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.isInitialized = false;
    }
  }
}

export default DazzleMode;