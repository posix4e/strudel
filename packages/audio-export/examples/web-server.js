import express from 'express';
import StrudelAudioExport from '../src/index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Create Express app and exporter
const app = express();
const exporter = new StrudelAudioExport({ headless: true });

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Main export endpoint
app.post('/api/export', async (req, res) => {
  const { 
    pattern, 
    format = 'mp3', 
    duration = 8,
    quality = 'high',
    filename = 'pattern'
  } = req.body;

  if (!pattern) {
    return res.status(400).json({ error: 'Pattern is required' });
  }

  try {
    console.log(`📥 Export request: "${pattern.substring(0, 50)}..." (${format}, ${duration}s)`);
    
    const buffer = await exporter.exportToBuffer(pattern, {
      format,
      duration,
      quality
    });

    // Set appropriate headers
    const contentTypes = {
      'webm': 'audio/webm',
      'wav': 'audio/wav',
      'mp3': 'audio/mpeg',
      'ogg': 'audio/ogg',
      'flac': 'audio/flac'
    };

    res.setHeader('Content-Type', contentTypes[format] || 'audio/webm');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.${format}"`);
    res.setHeader('Content-Length', buffer.length);

    console.log(`✅ Export complete: ${(buffer.length / 1024).toFixed(1)} KB`);
    res.send(buffer);

  } catch (error) {
    console.error('❌ Export error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'strudel-audio-export',
    formats: ['webm', 'wav', 'mp3', 'ogg', 'flac']
  });
});

// Create simple web interface
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Strudel Audio Export Service</title>
  <style>
    body { 
      font-family: system-ui, -apple-system, sans-serif; 
      max-width: 800px; 
      margin: 0 auto; 
      padding: 20px;
      background: #f5f5f5;
    }
    h1 { color: #333; }
    .container { 
      background: white; 
      padding: 20px; 
      border-radius: 8px; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    textarea { 
      width: 100%; 
      min-height: 100px; 
      font-family: monospace;
      font-size: 14px;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    input, select, button { 
      padding: 8px 12px; 
      margin: 5px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    button {
      background: #007bff;
      color: white;
      border: none;
      cursor: pointer;
    }
    button:hover {
      background: #0056b3;
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .status { 
      margin-top: 10px; 
      padding: 10px; 
      border-radius: 4px;
      display: none;
    }
    .status.success { 
      background: #d4edda; 
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .status.error { 
      background: #f8d7da; 
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .examples {
      margin-top: 20px;
      font-size: 14px;
    }
    .example {
      background: #f8f9fa;
      padding: 8px;
      margin: 5px 0;
      border-radius: 4px;
      cursor: pointer;
      font-family: monospace;
    }
    .example:hover {
      background: #e9ecef;
    }
  </style>
</head>
<body>
  <h1>🎵 Strudel Audio Export Service</h1>
  
  <div class="container">
    <h2>Export Pattern to Audio</h2>
    
    <div>
      <label>Pattern:</label><br>
      <textarea id="pattern" placeholder="s('bd*4, hh*8')"></textarea>
    </div>
    
    <div>
      <label>Format:</label>
      <select id="format">
        <option value="mp3">MP3</option>
        <option value="wav">WAV</option>
        <option value="webm">WebM</option>
        <option value="ogg">OGG</option>
        <option value="flac">FLAC</option>
      </select>
      
      <label>Duration (seconds):</label>
      <input type="number" id="duration" value="8" min="1" max="300">
      
      <label>Quality:</label>
      <select id="quality">
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </div>
    
    <div>
      <button id="exportBtn" onclick="exportPattern()">Export Audio</button>
      <button onclick="playPattern()">▶️ Preview</button>
    </div>
    
    <div id="status" class="status"></div>
    
    <div class="examples">
      <h3>Example Patterns (click to use):</h3>
      <div class="example" onclick="useExample(this)">s('bd*4, hh*8')</div>
      <div class="example" onclick="useExample(this)">note('c3 e3 g3 b3').s('sawtooth')</div>
      <div class="example" onclick="useExample(this)">s('jazz').chop(8).rev()</div>
      <div class="example" onclick="useExample(this)">stack(s('bd*4'), note('c2 eb2').s('bass'))</div>
      <div class="example" onclick="useExample(this)">s('cp').every(4, rev).room(0.5)</div>
    </div>
  </div>
  
  <script>
    async function exportPattern() {
      const pattern = document.getElementById('pattern').value;
      const format = document.getElementById('format').value;
      const duration = document.getElementById('duration').value;
      const quality = document.getElementById('quality').value;
      const button = document.getElementById('exportBtn');
      const status = document.getElementById('status');
      
      if (!pattern) {
        showStatus('Please enter a pattern', 'error');
        return;
      }
      
      button.disabled = true;
      button.textContent = 'Exporting...';
      showStatus('Processing...', 'success');
      
      try {
        const response = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pattern,
            format,
            duration: parseInt(duration),
            quality,
            filename: 'strudel-export'
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error);
        }
        
        // Download the file
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = \`strudel-export.\${format}\`;
        a.click();
        URL.revokeObjectURL(url);
        
        showStatus('Export complete! Check your downloads.', 'success');
        
      } catch (error) {
        showStatus('Error: ' + error.message, 'error');
      } finally {
        button.disabled = false;
        button.textContent = 'Export Audio';
      }
    }
    
    function showStatus(message, type) {
      const status = document.getElementById('status');
      status.textContent = message;
      status.className = 'status ' + type;
      status.style.display = 'block';
      
      if (type === 'success') {
        setTimeout(() => {
          status.style.display = 'none';
        }, 5000);
      }
    }
    
    function useExample(element) {
      document.getElementById('pattern').value = element.textContent;
    }
    
    async function playPattern() {
      // This is a placeholder - in a real implementation,
      // you might embed the Strudel player here
      alert('Preview functionality would require embedding Strudel player');
    }
  </script>
</body>
</html>`);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
🎵 Strudel Audio Export Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Server running at: http://localhost:${PORT}
API endpoint: POST http://localhost:${PORT}/api/export

Example request:
curl -X POST http://localhost:${PORT}/api/export \\
  -H "Content-Type: application/json" \\
  -d '{"pattern": "s('bd*4')", "format": "mp3", "duration": 8}' \\
  --output pattern.mp3

Press Ctrl+C to stop
`);
});