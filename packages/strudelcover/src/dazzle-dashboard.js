import { createServer } from 'http';
import { readFileSync } from 'fs';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DazzleDashboard {
  constructor() {
    this.server = null;
    this.wss = null;
    this.clients = new Set();
    this.state = {
      phase: 'initializing',
      structure: null,
      currentSection: null,
      currentLayer: null,
      currentMeasure: 0,
      totalMeasures: 0,
      sections: {},
      patterns: {},
      instruments: {} // Add instruments for each section
    };
  }

  async start(port = 8888) {
    return new Promise((resolve) => {
      // Create HTTP server
      this.server = createServer((req, res) => {
        if (req.url === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(this.getHTML());
        } else if (req.url === '/state') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.state));
        }
      });

      // Create WebSocket server
      this.wss = new WebSocketServer({ server: this.server });
      
      this.wss.on('connection', (ws) => {
        this.clients.add(ws);
        
        // Send current state to new client
        ws.send(JSON.stringify({
          type: 'state',
          data: this.state
        }));

        ws.on('close', () => {
          this.clients.delete(ws);
        });
      });

      this.server.listen(port, () => {
        console.log(`🌟 Dazzle Dashboard running at http://localhost:${port}`);
        // Force new window, not tab
        open(`http://localhost:${port}`, {
          newInstance: true,
          wait: false
        });
        resolve();
      });
    });
  }

  updateState(updates) {
    Object.assign(this.state, updates);
    this.broadcast({
      type: 'update',
      data: updates
    });
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === 1) { // OPEN
        client.send(data);
      }
    });
  }

  setPhase(phase) {
    this.updateState({ phase });
  }

  setStructure(structure) {
    this.updateState({ 
      structure,
      totalMeasures: structure.sections.reduce((sum, s) => sum + s.measures, 0)
    });
  }

  setCurrentSection(section) {
    this.updateState({ currentSection: section });
  }

  setCurrentLayer(layer) {
    this.updateState({ currentLayer: layer });
  }

  updateProgress(measure) {
    this.updateState({ currentMeasure: measure });
  }

  addPattern(sectionId, layerId, pattern) {
    if (!this.state.patterns[sectionId]) {
      this.state.patterns[sectionId] = {};
    }
    this.state.patterns[sectionId][layerId] = pattern;
    this.broadcast({
      type: 'pattern',
      data: { sectionId, layerId, pattern }
    });
  }
  
  addLLMInteraction(layer, prompt, response, extracted) {
    this.broadcast({
      type: 'llm_interaction',
      data: { 
        layer, 
        prompt, 
        response,
        extracted,
        timestamp: new Date().toISOString()
      }
    });
  }

  setInstruments(sectionId, instruments) {
    this.state.instruments[sectionId] = instruments;
    this.broadcast({
      type: 'instruments',
      data: { sectionId, instruments }
    });
  }
  
  sendAudioData(waveform, frequency) {
    this.broadcast({
      type: 'audio_data',
      data: { waveform, frequency }
    });
  }
  
  updateConversationStep(step, status = 'active') {
    this.broadcast({
      type: 'conversation_step',
      data: { step, status }
    });
  }

  stop() {
    if (this.wss) {
      this.wss.close();
    }
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
  <title>DAZZLE Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Courier New', monospace;
      background: #0a0a0a;
      color: #0ff;
      overflow: hidden;
      position: relative;
    }

    .dashboard {
      display: grid;
      grid-template-rows: auto 1fr auto;
      height: 100vh;
      padding: 20px;
      gap: 20px;
    }

    .header {
      text-align: center;
      border: 2px solid #0ff;
      padding: 20px;
      background: rgba(0, 255, 255, 0.05);
      position: relative;
      overflow: hidden;
    }

    .header h1 {
      font-size: 3em;
      text-shadow: 0 0 20px #0ff;
      animation: glow 2s ease-in-out infinite;
    }

    @keyframes glow {
      0%, 100% { text-shadow: 0 0 20px #0ff; }
      50% { text-shadow: 0 0 40px #0ff, 0 0 60px #0ff; }
    }

    .main-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .panel {
      border: 1px solid #0ff;
      padding: 20px;
      background: rgba(0, 255, 255, 0.02);
      position: relative;
    }

    .panel-header {
      font-size: 1.5em;
      margin-bottom: 15px;
      border-bottom: 1px solid #0ff;
      padding-bottom: 10px;
    }

    .structure-view {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .section {
      border: 1px solid #088;
      padding: 10px;
      background: rgba(0, 255, 255, 0.05);
      transition: all 0.3s;
    }

    .section.active {
      border-color: #0ff;
      background: rgba(0, 255, 255, 0.2);
      box-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
    }

    .section-name {
      font-weight: bold;
      color: #0ff;
    }

    .layers {
      display: flex;
      gap: 5px;
      margin-top: 10px;
      flex-wrap: wrap;
    }

    .layer {
      padding: 5px 10px;
      border: 1px solid #066;
      background: rgba(0, 255, 255, 0.1);
      font-size: 0.8em;
      transition: all 0.3s;
    }

    .layer.active {
      background: rgba(0, 255, 255, 0.4);
      border-color: #0ff;
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    .progress-bar {
      height: 40px;
      border: 1px solid #0ff;
      background: rgba(0, 255, 255, 0.05);
      position: relative;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #088, #0ff);
      width: 0%;
      transition: width 0.3s;
      position: relative;
    }

    .progress-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 1.2em;
      z-index: 1;
    }

    .pattern-preview {
      font-family: 'Courier New', monospace;
      background: #000;
      border: 1px solid #0ff;
      padding: 15px;
      overflow-y: auto;
      max-height: 300px;
      white-space: pre-wrap;
      color: #0f0;
      font-size: 0.9em;
    }

    .status {
      text-align: center;
      font-size: 1.2em;
      padding: 10px;
      background: rgba(0, 255, 255, 0.1);
      border: 1px solid #0ff;
    }

    .particles {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: hidden;
    }

    .particle {
      position: absolute;
      width: 2px;
      height: 2px;
      background: #0ff;
      animation: float 10s infinite linear;
    }

    @keyframes float {
      from {
        transform: translateY(100vh) rotate(0deg);
        opacity: 0;
      }
      10% {
        opacity: 1;
      }
      90% {
        opacity: 1;
      }
      to {
        transform: translateY(-100vh) rotate(360deg);
        opacity: 0;
      }
    }
    
    .llm-log {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 600px;
      height: 400px;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #0ff;
      display: flex;
      flex-direction: column;
      font-size: 0.8em;
    }
    
    .llm-header {
      padding: 10px;
      background: #000;
      border-bottom: 1px solid #0ff;
      color: #ff0;
    }
    
    .llm-content {
      flex: 1;
      overflow-y: auto;
      padding: 10px;
    }
    
    .llm-entry {
      margin-bottom: 20px;
      border-bottom: 1px solid #044;
      padding-bottom: 10px;
    }
    
    .llm-layer {
      color: #ff0;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .llm-section {
      margin: 5px 0;
      padding: 5px;
      background: rgba(0, 255, 255, 0.05);
      white-space: pre-wrap;
      font-family: monospace;
      max-height: 150px;
      overflow-y: auto;
    }
    
    .conversation-flow {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      max-height: 400px;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #0ff;
      padding: 15px;
      overflow-y: auto;
    }
    
    .conversation-step {
      margin-bottom: 10px;
      padding: 8px;
      background: rgba(0, 255, 255, 0.05);
      border-left: 3px solid #088;
      font-size: 0.9em;
    }
    
    .conversation-step.active {
      border-left-color: #0ff;
      background: rgba(0, 255, 255, 0.1);
    }
    
    .conversation-step.complete {
      border-left-color: #0f0;
      opacity: 0.7;
    }
    
    .visualizer-container {
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #0ff;
      padding: 15px;
    }
    
    .visualizer-label {
      color: #ff0;
      font-size: 0.9em;
      margin-top: 10px;
      text-align: center;
    }
    
    #visualizer {
      display: block;
      background: #000;
      border: 1px solid #088;
    }
    
    .viz-controls {
      display: flex;
      gap: 10px;
      margin-top: 10px;
      justify-content: center;
    }
    
    .viz-button {
      background: rgba(0, 255, 255, 0.1);
      border: 1px solid #088;
      color: #0ff;
      padding: 5px 10px;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      font-size: 0.8em;
      transition: all 0.3s;
    }
    
    .viz-button:hover {
      background: rgba(0, 255, 255, 0.2);
      border-color: #0ff;
    }
    
    .viz-button.active {
      background: rgba(0, 255, 255, 0.3);
      border-color: #0ff;
      box-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
    }
  </style>
</head>
<body>
  <div class="particles" id="particles"></div>
  
  <div class="dashboard">
    <div class="header">
      <h1>DAZZLE DASHBOARD</h1>
      <div class="status" id="status">Initializing...</div>
    </div>

    <div class="main-content">
      <div class="panel">
        <div class="panel-header">SONG STRUCTURE</div>
        <div class="structure-view" id="structure">
          <div class="loading">Analyzing structure...</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">PATTERN PREVIEW</div>
        <div class="pattern-preview" id="pattern">
          // Waiting for patterns...
        </div>
      </div>
    </div>

    <div class="progress-bar">
      <div class="progress-fill" id="progress"></div>
      <div class="progress-text" id="progressText">0 / 0 measures</div>
    </div>
  </div>
  
  <div class="llm-log">
    <div class="llm-header">LLM Interactions</div>
    <div class="llm-content" id="llm-content"></div>
  </div>
  
  <div class="conversation-flow">
    <div class="llm-header">Conversation Progress</div>
    <div id="conversation-steps">
      <div class="conversation-step" data-step="start">🎵 Starting conversation...</div>
      <div class="conversation-step" data-step="drums">🥁 Building drums</div>
      <div class="conversation-step" data-step="bass">🎸 Adding bass</div>
      <div class="conversation-step" data-step="atmosphere">🌊 Creating atmosphere</div>
      <div class="conversation-step" data-step="chords">🎹 Adding chords</div>
      <div class="conversation-step" data-step="lead">🎵 Creating lead melody</div>
      <div class="conversation-step" data-step="combination">🎛️ Combining elements</div>
      <div class="conversation-step" data-step="sections">📍 Building sections</div>
    </div>
  </div>
  
  <div class="visualizer-container">
    <canvas id="visualizer" width="400" height="100"></canvas>
    <div class="visualizer-label">Audio Output Visualization</div>
    <div class="viz-controls">
      <button class="viz-button active" data-mode="waveform">Waveform</button>
      <button class="viz-button" data-mode="frequency">Frequency</button>
      <button class="viz-button" data-mode="circular">Circular</button>
      <button class="viz-button" data-mode="bars">Bars</button>
    </div>
  </div>

  <script>
    // Create particles
    const particlesContainer = document.getElementById('particles');
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 10 + 's';
      particle.style.animationDuration = (10 + Math.random() * 10) + 's';
      particlesContainer.appendChild(particle);
    }

    // WebSocket connection
    const ws = new WebSocket('ws://localhost:8888');
    let state = {};

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'state' || message.type === 'update') {
        Object.assign(state, message.data);
        updateUI();
      } else if (message.type === 'pattern') {
        updatePattern(message.data);
      } else if (message.type === 'llm_interaction') {
        addLLMInteraction(message.data);
      } else if (message.type === 'conversation_step') {
        updateConversationStep(message.data);
      }
    };
    
    function updateConversationStep(data) {
      const steps = document.querySelectorAll('.conversation-step');
      steps.forEach(step => {
        if (step.dataset.step === data.step) {
          step.classList.remove('active', 'complete');
          step.classList.add(data.status);
        } else if (data.status === 'active') {
          // Mark previous steps as complete
          const currentIndex = Array.from(steps).findIndex(s => s.dataset.step === data.step);
          const stepIndex = Array.from(steps).indexOf(step);
          if (stepIndex < currentIndex) {
            step.classList.add('complete');
          }
        }
      });
    }

    function updateUI() {
      // Update status
      const statusEl = document.getElementById('status');
      statusEl.textContent = (state.phase || '').toUpperCase().replace(/_/g, ' ');

      // Update structure view
      if (state.structure) {
        const structureEl = document.getElementById('structure');
        structureEl.innerHTML = state.structure.sections.map(section => {
          const instruments = state.instruments[section.name];
          return \`
          <div class="section \${state.currentSection === section.name ? 'active' : ''}">
            <div class="section-name">\${(section.name || '').toUpperCase()}</div>
            <div>Start: \${section.start}s | Duration: \${section.duration}s | Measures: \${section.measures}</div>
            \${instruments ? \`
              <div style="margin: 10px 0; font-size: 0.9em; color: #ff0;">
                Instruments: \${Object.entries(instruments.mappings || {}).map(([cat, insts]) => 
                  insts.map(i => i.name).join(', ')
                ).join(' | ')}
              </div>
            \` : ''}
            <div class="layers">
              \${['drums', 'bass', 'chords', 'lead', 'atmosphere'].map(layer => \`
                <div class="layer \${state.currentSection === section.name && state.currentLayer === layer ? 'active' : ''}">\${layer}</div>
              \`).join('')}
            </div>
          </div>
        \`;}).join('');
      }

      // Update progress
      const progress = state.totalMeasures > 0 ? (state.currentMeasure / state.totalMeasures) * 100 : 0;
      document.getElementById('progress').style.width = progress + '%';
      document.getElementById('progressText').textContent = \`\${state.currentMeasure} / \${state.totalMeasures} measures\`;
    }

    function updatePattern(data) {
      const patternEl = document.getElementById('pattern');
      if (state.patterns && state.patterns[data.sectionId] && state.patterns[data.sectionId][data.layerId]) {
        patternEl.textContent = Object.entries(state.patterns)
          .map(([section, layers]) => \`// \${(section || '').toUpperCase()}\n\${Object.entries(layers).map(([layer, pattern]) => pattern).join('\\n')}\`)
          .join('\\n\\n');
      }
    }
    
    function addLLMInteraction(data) {
      const { layer, prompt, response, extracted, timestamp } = data;
      const container = document.getElementById('llm-content');
      
      const entry = document.createElement('div');
      entry.className = 'llm-entry';
      
      entry.innerHTML = \`
        <div class="llm-layer">\${layer} - \${new Date(timestamp).toLocaleTimeString()}</div>
        <details>
          <summary>Prompt (\${prompt.length} chars)</summary>
          <div class="llm-section">\${prompt}</div>
        </details>
        <details>
          <summary>Response (\${response.length} chars)</summary>
          <div class="llm-section">\${response}</div>
        </details>
        <details open>
          <summary>Extracted (\${extracted.length} chars)</summary>
          <div class="llm-section">\${extracted}</div>
        </details>
      \`;
      
      container.insertBefore(entry, container.firstChild);
      
      // Keep only last 20 entries
      while (container.children.length > 20) {
        container.removeChild(container.lastChild);
      }
    }

    // Initial update
    updateUI();
    
    // Audio Visualizer with Real Audio Data
    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');
    let animationId;
    let audioContext = null;
    let analyser = null;
    let dataArray = null;
    let currentMode = 'waveform';
    
    // Add audio data to state for real visualization
    state.audioData = {
      waveform: new Uint8Array(128),
      frequency: new Uint8Array(64)
    };
    
    // Handle visualization mode changes
    document.querySelectorAll('.viz-button').forEach(button => {
      button.addEventListener('click', (e) => {
        document.querySelectorAll('.viz-button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentMode = e.target.dataset.mode;
      });
    });
    
    // Visualization drawing functions
    const visualizers = {
      waveform: () => {
        const width = canvas.width;
        const height = canvas.height;
        const data = state.audioData.waveform;
        
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const sliceWidth = width / data.length;
        let x = 0;
        
        for (let i = 0; i < data.length; i++) {
          const v = data[i] / 128.0;
          const y = v * height / 2;
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          
          x += sliceWidth;
        }
        
        ctx.stroke();
      },
      
      frequency: () => {
        const width = canvas.width;
        const height = canvas.height;
        const data = state.audioData.frequency;
        
        const barWidth = (width / data.length) * 2.5;
        let x = 0;
        
        for (let i = 0; i < data.length; i++) {
          const barHeight = (data[i] / 255) * height;
          
          const hue = (i / data.length) * 180 + 180;
          ctx.fillStyle = \`hsl(\${hue}, 100%, 50%)\`;
          
          ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
          x += barWidth;
        }
      },
      
      circular: () => {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;
        const data = state.audioData.frequency;
        
        ctx.beginPath();
        
        for (let i = 0; i < data.length; i++) {
          const angle = (i / data.length) * Math.PI * 2;
          const amplitude = (data[i] / 255) * radius * 0.5;
          const x = centerX + Math.cos(angle) * (radius - amplitude);
          const y = centerY + Math.sin(angle) * (radius - amplitude);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.closePath();
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.fill();
      },
      
      bars: () => {
        const width = canvas.width;
        const height = canvas.height;
        const data = state.audioData.frequency;
        const barCount = 32;
        const barWidth = width / barCount;
        
        for (let i = 0; i < barCount; i++) {
          const dataIndex = Math.floor(i * data.length / barCount);
          const barHeight = (data[dataIndex] / 255) * height * 0.8;
          
          // Create gradient
          const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
          gradient.addColorStop(0, '#0ff');
          gradient.addColorStop(1, '#088');
          
          ctx.fillStyle = gradient;
          ctx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);
        }
      }
    };
    
    function drawVisualizer() {
      const width = canvas.width;
      const height = canvas.height;
      
      // Clear canvas
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, width, height);
      
      // Draw based on current mode
      if (visualizers[currentMode]) {
        visualizers[currentMode]();
      }
      
      animationId = requestAnimationFrame(drawVisualizer);
    }
    
    // Start visualizer
    drawVisualizer();
    
    // Listen for audio data updates from the server
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'audio_data') {
        state.audioData = message.data;
      }
    });
    
    // Simulate audio data for now (until we connect to real audio)
    setInterval(() => {
      // Simulate waveform data
      for (let i = 0; i < state.audioData.waveform.length; i++) {
        state.audioData.waveform[i] = 128 + Math.sin(i * 0.1 + Date.now() * 0.001) * 64 * Math.random();
      }
      
      // Simulate frequency data
      for (let i = 0; i < state.audioData.frequency.length; i++) {
        const bass = i < 10 ? Math.random() * 200 + 55 : 0;
        const mid = i >= 10 && i < 30 ? Math.random() * 150 : 0;
        const high = i >= 30 ? Math.random() * 100 : 0;
        state.audioData.frequency[i] = bass + mid + high;
      }
    }, 50);
    
    // Clean up on close
    window.addEventListener('beforeunload', () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    });
  </script>
</body>
</html>`;
  }
}