/**
 * Section detail window for showing instrument mappings and build progress
 */
import { createServer } from 'http';
import open from 'open';

export class SectionDetailWindow {
  constructor(sectionName, port = 8889) {
    this.sectionName = sectionName;
    this.port = port;
    this.server = null;
    this.state = {
      section: sectionName,
      instruments: {},
      currentLayer: null,
      buildProgress: [],
      previewMeasures: 8,
      fullMeasures: 32,
      patterns: {},
      tempo: 120,
      beatPattern: null,
      hasError: false,
      errorMessage: null,
      isComplete: false
    };
  }

  async start() {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => {
        if (req.url === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(this.getHTML());
        } else if (req.url === '/state') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.state));
        } else if (req.url?.startsWith('/update')) {
          // Handle updates via query params
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const update = JSON.parse(body);
              Object.assign(this.state, update);
              res.writeHead(200);
              res.end('OK');
            } catch (e) {
              res.writeHead(400);
              res.end('Bad Request');
            }
          });
        }
      });

      this.server.listen(this.port, () => {
        console.log(`🎹 Section Detail Window for ${this.sectionName} at http://localhost:${this.port}`);
        // Force new window
        open(`http://localhost:${this.port}`, {
          newInstance: true,
          wait: false
        });
        resolve();
      });
    });
  }

  updateInstruments(instruments) {
    this.state.instruments = instruments;
    this.broadcastUpdate();
  }

  updateCurrentLayer(layer) {
    this.state.currentLayer = layer;
    this.broadcastUpdate();
  }

  addBuildStep(step) {
    this.state.buildProgress.push({
      ...step,
      timestamp: Date.now()
    });
    this.broadcastUpdate();
  }

  updatePattern(layer, pattern) {
    this.state.patterns[layer] = pattern;
    
    // Extract beat pattern for drums
    if (layer === 'drums') {
      this.state.beatPattern = this.extractBeatPattern(pattern);
    }
    
    this.broadcastUpdate();
  }
  
  setTempo(tempo) {
    this.state.tempo = tempo;
    this.broadcastUpdate();
  }
  
  extractBeatPattern(pattern) {
    // Simple pattern extraction - look for kick (bd) and snare (sd/cp) patterns
    const kickMatch = pattern.match(/s\("([^"]*bd[^"]*)"\)/);
    const snareMatch = pattern.match(/s\("([^"]*(?:sd|cp)[^"]*)"\)/);
    
    return {
      kick: kickMatch ? kickMatch[1] : null,
      snare: snareMatch ? snareMatch[1] : null,
      full: pattern
    };
  }
  
  setError(hasError, message = null) {
    this.state.hasError = hasError;
    this.state.errorMessage = message;
    this.broadcastUpdate();
  }
  
  setComplete() {
    this.state.isComplete = true;
    this.state.currentLayer = null;
    this.broadcastUpdate();
  }

  broadcastUpdate() {
    // In a real implementation, we'd use WebSockets
    // For now, the client will poll /state
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
  }

  getHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.sectionName.toUpperCase()} - Instrument Mapping</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      background: #000;
      color: #fff;
      overflow: hidden;
      background-image: 
        radial-gradient(circle at 20% 50%, #1a0033 0%, transparent 50%),
        radial-gradient(circle at 80% 80%, #001a33 0%, transparent 50%),
        radial-gradient(circle at 40% 20%, #0a001a 0%, transparent 50%);
    }

    .container {
      display: grid;
      grid-template-rows: auto 1fr auto;
      height: 100vh;
      padding: 20px;
      gap: 20px;
    }

    .header {
      text-align: center;
      border: 2px solid #f0f;
      padding: 20px;
      background: rgba(255, 0, 255, 0.1);
      box-shadow: 0 0 30px rgba(255, 0, 255, 0.5);
      animation: pulse-border 2s infinite;
    }

    @keyframes pulse-border {
      0%, 100% { box-shadow: 0 0 30px rgba(255, 0, 255, 0.5); }
      50% { box-shadow: 0 0 50px rgba(255, 0, 255, 0.8); }
    }

    .header h1 {
      font-size: 2.5em;
      background: linear-gradient(45deg, #f0f, #0ff, #f0f);
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: gradient-shift 3s infinite;
    }

    @keyframes gradient-shift {
      0%, 100% { filter: hue-rotate(0deg); }
      50% { filter: hue-rotate(180deg); }
    }

    .main {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      overflow: hidden;
    }

    .panel {
      border: 1px solid #0ff;
      background: rgba(0, 255, 255, 0.05);
      padding: 20px;
      overflow-y: auto;
      position: relative;
    }

    .panel::before {
      content: '';
      position: absolute;
      top: -2px;
      left: -2px;
      right: -2px;
      bottom: -2px;
      background: linear-gradient(45deg, #f0f, #0ff, #f0f, #0ff);
      border-radius: 4px;
      opacity: 0.5;
      z-index: -1;
      animation: rotate-gradient 4s linear infinite;
    }

    @keyframes rotate-gradient {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .panel-title {
      font-size: 1.5em;
      margin-bottom: 20px;
      color: #0ff;
      text-shadow: 0 0 10px #0ff;
    }

    .instrument-mapping {
      display: grid;
      gap: 15px;
    }

    .instrument-category {
      border: 1px solid #666;
      padding: 15px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 5px;
    }

    .category-name {
      font-size: 1.2em;
      color: #f0f;
      margin-bottom: 10px;
      text-transform: uppercase;
    }

    .instrument-item {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 10px;
      padding: 8px;
      background: rgba(0, 255, 255, 0.1);
      border: 1px solid rgba(0, 255, 255, 0.3);
      border-radius: 3px;
      margin-bottom: 5px;
    }

    .detected-inst {
      color: #ff0;
    }

    .arrow {
      color: #0ff;
      font-size: 1.5em;
    }

    .strudel-inst {
      color: #0f0;
      font-family: monospace;
    }

    .build-timeline {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .timeline-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.05);
      border-left: 3px solid #0ff;
      transition: all 0.3s;
    }

    .timeline-item.active {
      background: rgba(0, 255, 255, 0.2);
      border-left-color: #f0f;
      transform: translateX(10px);
    }

    .time {
      color: #666;
      font-size: 0.8em;
    }

    .measure-preview {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid #0ff;
      padding: 15px 30px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      gap: 20px;
      box-shadow: 0 0 30px rgba(0, 255, 255, 0.5);
    }

    .measure-display {
      font-size: 2em;
      color: #0ff;
      font-weight: bold;
    }

    .progress-ring {
      width: 60px;
      height: 60px;
      position: relative;
    }

    .progress-ring svg {
      transform: rotate(-90deg);
    }

    .progress-ring circle {
      fill: none;
      stroke-width: 4;
    }

    .progress-bg {
      stroke: #333;
    }

    .progress-fill {
      stroke: #0ff;
      stroke-dasharray: 188.5;
      stroke-dashoffset: 188.5;
      transition: stroke-dashoffset 0.5s;
      filter: drop-shadow(0 0 5px #0ff);
    }

    .visualizer {
      height: 100px;
      background: #000;
      border: 1px solid #0ff;
      display: flex;
      align-items: flex-end;
      gap: 2px;
      padding: 5px;
      overflow: hidden;
    }

    .freq-bar {
      flex: 1;
      background: linear-gradient(to top, #f0f, #0ff);
      min-height: 5px;
      animation: freq-pulse 0.5s infinite alternate;
    }

    @keyframes freq-pulse {
      to { transform: scaleY(0.5); }
    }
    
    /* Error state styles */
    .error-state .freq-bar {
      background: linear-gradient(to top, #800, #f00) !important;
      animation: error-flicker 0.2s infinite;
    }
    
    @keyframes error-flicker {
      0%, 100% { opacity: 0.3; height: 10% !important; }
      50% { opacity: 0.8; height: 15% !important; }
    }
    
    .error-message {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #f00;
      font-size: 1.2em;
      text-align: center;
      background: rgba(0, 0, 0, 0.8);
      padding: 20px;
      border: 2px solid #f00;
      display: none;
    }
    
    .error-state .error-message {
      display: block;
    }
    
    /* Completed state */
    .completed-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 255, 0, 0.1);
      display: none;
      pointer-events: none;
    }
    
    .completed .completed-overlay {
      display: block;
    }
    
    .completed .header {
      border-color: #0f0;
      animation: complete-pulse 2s ease-in-out infinite;
    }
    
    @keyframes complete-pulse {
      0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 0, 0.5); }
      50% { box-shadow: 0 0 40px rgba(0, 255, 0, 0.8); }
    }
    
    .completed .visualizer .freq-bar {
      background: linear-gradient(to top, #0a0, #0f0) !important;
      animation: complete-wave 2s ease-in-out infinite;
    }
    
    @keyframes complete-wave {
      0%, 100% { transform: scaleY(0.3); }
      50% { transform: scaleY(0.6); }
    }
  </style>
</head>
<body>
  <div class="container" id="mainContainer">
    <div class="header">
      <h1>${(this.sectionName || 'SECTION').toUpperCase()} CONSTRUCTION</h1>
      <div class="visualizer" id="visualizer">
        ${Array(32).fill(0).map(() => '<div class="freq-bar" style="height: ' + (Math.random() * 100) + '%"></div>').join('')}
        <div class="error-message" id="errorMessage">Pattern Error Detected</div>
        <div class="completed-overlay"></div>
      </div>
    </div>

    <div class="main">
      <div class="panel">
        <div class="panel-title">INSTRUMENT MAPPING</div>
        <div class="instrument-mapping" id="mappings">
          <!-- Mappings will be inserted here -->
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">BUILD TIMELINE</div>
        <div class="build-timeline" id="timeline">
          <!-- Timeline items will be inserted here -->
        </div>
      </div>
    </div>

    <div class="measure-preview">
      <div class="progress-ring">
        <svg width="60" height="60">
          <circle class="progress-bg" cx="30" cy="30" r="28"></circle>
          <circle class="progress-fill" id="progress" cx="30" cy="30" r="28"></circle>
        </svg>
      </div>
      <div class="measure-display">
        <span id="currentMeasure">0</span> / <span id="totalMeasures">32</span> measures
      </div>
    </div>
  </div>

  <script>
    let state = {};
    
    // Poll for state updates
    async function updateState() {
      try {
        const response = await fetch('/state');
        state = await response.json();
        renderUI();
      } catch (e) {
        console.error('Failed to fetch state:', e);
      }
    }

    function renderUI() {
      // Render instrument mappings
      const mappingsEl = document.getElementById('mappings');
      if (state.instruments && state.instruments.mappings) {
        mappingsEl.innerHTML = Object.entries(state.instruments.mappings).map(([category, instruments]) => \`
          <div class="instrument-category">
            <div class="category-name">\${(category || '').toUpperCase()}</div>
            \${(instruments || []).map(inst => \`
              <div class="instrument-item">
                <span class="detected-inst">\${inst.name || ''}</span>
                <span class="arrow">→</span>
                <span class="strudel-inst">\${inst.strudel || ''}\${inst.effects ? '.' + inst.effects : ''}</span>
              </div>
            \`).join('')}
          </div>
        \`).join('');
      }

      // Render build timeline
      const timelineEl = document.getElementById('timeline');
      if (state.buildProgress) {
        timelineEl.innerHTML = state.buildProgress.map(step => \`
          <div class="timeline-item \${step.layer === state.currentLayer ? 'active' : ''}">
            <span class="time">\${new Date(step.timestamp).toLocaleTimeString()}</span>
            <span>\${step.action}</span>
          </div>
        \`).join('');
        timelineEl.scrollTop = timelineEl.scrollHeight;
      }

      // Update progress
      if (state.currentMeasure !== undefined) {
        document.getElementById('currentMeasure').textContent = state.currentMeasure;
        document.getElementById('totalMeasures').textContent = state.fullMeasures || 32;
        
        const progress = (state.currentMeasure / (state.fullMeasures || 32)) * 188.5;
        document.getElementById('progress').style.strokeDashoffset = 188.5 - progress;
      }

      // Animate visualizer
      const bars = document.querySelectorAll('.freq-bar');
      bars.forEach(bar => {
        if (state.currentLayer) {
          bar.style.height = (Math.random() * 100) + '%';
          bar.style.animationDelay = Math.random() + 's';
        }
      });
    }

    // Initial load and start polling
    updateState();
    setInterval(updateState, 500);

    // Beat-synchronized visualizer
    let beatIndex = 0;
    const msPerBeat = 60000 / (state.tempo || 120);
    
    function animateBeat() {
      const bars = document.querySelectorAll('.freq-bar');
      const numBars = bars.length;
      const visualizer = document.getElementById('visualizer');
      const container = document.getElementById('mainContainer');
      
      // Handle completed state
      if (state.isComplete) {
        container.classList.add('completed');
        // Gentle wave animation for completed state
        bars.forEach((bar, i) => {
          const wave = Math.sin((i / numBars + Date.now() / 2000) * Math.PI * 2);
          const height = 30 + wave * 20;
          bar.style.height = height + '%';
        });
        return;
      } else {
        container.classList.remove('completed');
      }
      
      // Handle error state
      if (state.hasError) {
        visualizer.classList.add('error-state');
        document.getElementById('errorMessage').textContent = state.errorMessage || 'Pattern Error Detected';
        
        // Dead/broken animation
        bars.forEach((bar, i) => {
          // Sporadic flickering at low heights
          if (Math.random() > 0.8) {
            bar.style.height = (Math.random() * 20) + '%';
          } else {
            bar.style.height = '5%';
          }
        });
        return;
      } else {
        visualizer.classList.remove('error-state');
      }
      
      if (state.beatPattern && state.beatPattern.kick) {
        // Parse kick pattern (e.g., "bd*4" means 4 kicks per measure)
        const kickPattern = state.beatPattern.kick;
        const isKick = kickPattern.includes('*') ? 
          (beatIndex % 4 === 0) : // Simple 4/4 kick
          kickPattern.includes('~') ? 
          !kickPattern.split(' ')[beatIndex % kickPattern.split(' ').length].includes('~') :
          true;
        
        if (isKick) {
          // Big pulse for kick
          bars.forEach((bar, i) => {
            const centerDist = Math.abs(i - numBars/2) / (numBars/2);
            bar.style.height = (80 - centerDist * 60) + '%';
            bar.style.background = 'linear-gradient(to top, #f0f, #ff0)';
          });
        } else {
          // Normal visualization
          bars.forEach((bar, i) => {
            const wave = Math.sin((i / numBars + beatIndex / 16) * Math.PI * 2);
            bar.style.height = (40 + wave * 30) + '%';
            bar.style.background = 'linear-gradient(to top, #f0f, #0ff)';
          });
        }
      } else {
        // Default animation when no pattern
        bars.forEach((bar, i) => {
          const wave = Math.sin((i / numBars + Date.now() / 1000) * Math.PI * 2);
          bar.style.height = (30 + wave * 20 + Math.random() * 20) + '%';
        });
      }
      
      beatIndex++;
    }
    
    // Sync to tempo
    setInterval(animateBeat, msPerBeat / 4); // 16th notes
  </script>
</body>
</html>`;
  }
}