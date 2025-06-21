import chalk from 'chalk';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { chromium } from 'playwright';
import { LLMProviderFactory } from './llm/index.js';

export class SimpleDazzle {
  constructor(options = {}) {
    this.llmProvider = options.llmProvider;
    this.port = options.port || 8888;
    this.server = null;
    this.wss = null;
    this.browser = null;
    this.page = null;
    this.pattern = null;
  }

  async start() {
    // Initialize LLM if needed
    if (!this.llmProvider) {
      throw new Error('LLM provider required');
    }

    // Start web server
    await this.startServer();
    
    // Launch browser
    await this.launchBrowser();
  }

  async startServer() {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => {
        if (req.url === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(this.getHTML());
        }
      });

      this.wss = new WebSocketServer({ server: this.server });
      
      this.wss.on('connection', (ws) => {
        // Send current pattern if we have one
        if (this.pattern) {
          ws.send(JSON.stringify({
            type: 'pattern',
            data: this.pattern
          }));
        }

        ws.on('message', (message) => {
          const data = JSON.parse(message);
          if (data.type === 'ready') {
            console.log(chalk.green('✓ Dashboard connected'));
          }
        });
      });

      this.server.listen(this.port, () => {
        console.log(chalk.cyan(`🌟 Dazzle running at http://localhost:${this.port}`));
        resolve();
      });
    });
  }

  async launchBrowser() {
    try {
      this.browser = await chromium.launch({ 
        headless: false,
        args: ['--autoplay-policy=no-user-gesture-required']
      });
      this.page = await this.browser.newPage();
      await this.page.goto(`http://localhost:${this.port}`);
    } catch (error) {
      console.log(chalk.yellow('Could not launch browser:', error.message));
    }
  }

  async generatePattern(audioFile, artist, song) {
    console.log(chalk.blue(`\n🎵 Generating pattern for "${song}" by ${artist}\n`));

    // Simple prompt - let the LLM figure out the details
    const prompt = `Create a complete Strudel pattern for "${song}" by ${artist}".

Important requirements:
- Use stack() to layer different parts (drums, bass, chords, melody)
- Make it sound recognizable as the original song
- Use appropriate tempo and key
- Include comments marking song sections
- Keep it under 50 lines
- Use simple sound names without bank numbers (bd, sd, hh, piano, bass, etc.)

Return ONLY the Strudel code, no explanation.`;

    console.log(chalk.yellow('🤖 Asking LLM to generate pattern...'));
    
    const response = await this.llmProvider.generateCompletion([
      { role: 'user', content: prompt }
    ]);

    // Extract code from response
    this.pattern = this.extractCode(response);
    
    console.log(chalk.green('✓ Pattern generated'));
    
    // Send to dashboard
    this.broadcast({ type: 'pattern', data: this.pattern });
    
    // Wait a bit then try autoplay
    setTimeout(() => this.autoplay(), 3000);
    
    return this.pattern;
  }

  extractCode(response) {
    // Try to find code block
    const codeMatch = response.match(/```(?:javascript|js|strudel)?\n([\s\S]*?)```/);
    if (codeMatch) {
      return codeMatch[1].trim();
    }
    
    // Otherwise assume the whole response is code
    return response.trim();
  }

  broadcast(message) {
    if (!this.wss) return;
    
    const data = JSON.stringify(message);
    this.wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(data);
      }
    });
  }

  async autoplay() {
    if (!this.page) return;
    
    console.log(chalk.yellow('🎵 Attempting autoplay...'));
    
    try {
      // Wait for iframe
      await this.page.waitForSelector('iframe#strudel', { timeout: 5000 });
      
      // Get the iframe
      const frame = this.page.frames().find(f => f.url().includes('strudel.cc'));
      if (!frame) {
        console.log(chalk.red('Could not find Strudel frame'));
        return;
      }

      // Wait for it to load
      await frame.waitForLoadState('networkidle');
      await this.page.waitForTimeout(2000);
      
      // Try to click play
      const playButton = await frame.$('button[title="play"]');
      if (playButton) {
        await playButton.click();
        console.log(chalk.green('✅ Autoplay successful!'));
      } else {
        // Try spacebar as fallback
        await frame.press('body', 'Space');
      }
    } catch (error) {
      console.log(chalk.yellow('Autoplay failed:', error.message));
    }
  }

  getHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dazzle</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: #0a0a0a;
      color: #0ff;
      font-family: monospace;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    
    h1 {
      margin: 0 0 20px 0;
      text-align: center;
    }
    
    #status {
      margin-bottom: 20px;
      padding: 10px;
      border: 1px solid #0ff;
      background: rgba(0,255,255,0.1);
    }
    
    #strudel-container {
      flex: 1;
      border: 2px solid #0ff;
      background: #000;
    }
    
    iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
  </style>
</head>
<body>
  <h1>🌟 DAZZLE</h1>
  <div id="status">Waiting for pattern...</div>
  <div id="strudel-container">
    <iframe id="strudel" src="https://strudel.cc"></iframe>
  </div>
  
  <script>
    const ws = new WebSocket('ws://localhost:${this.port}');
    const status = document.getElementById('status');
    const iframe = document.getElementById('strudel');
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'ready' }));
      status.textContent = 'Connected - waiting for pattern...';
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'pattern') {
        status.textContent = 'Pattern received - loading in Strudel...';
        
        // Wait for Strudel to load
        iframe.addEventListener('load', () => {
          setTimeout(() => {
            // Try to set the pattern in Strudel
            try {
              const strudelWindow = iframe.contentWindow;
              if (strudelWindow && strudelWindow.setCode) {
                strudelWindow.setCode(message.data);
                status.textContent = 'Pattern loaded - click play to hear it!';
              }
            } catch (e) {
              // Cross-origin restrictions, but pattern might still work
              console.log('Could not directly set code:', e);
              status.innerHTML = 'Pattern ready - paste this in Strudel:<br><pre>' + 
                message.data.substring(0, 100) + '...</pre>';
            }
          }, 2000);
        });
      }
    };
    
    ws.onerror = () => {
      status.textContent = 'Connection error';
    };
  </script>
</body>
</html>`;
  }

  async stop() {
    if (this.browser) {
      await this.browser.close();
    }
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }
  }
}

// Standalone function for easy use
export async function dazzle(audioFile, artist, song, options = {}) {
  // Initialize LLM provider
  const provider = options.provider || 'anthropic';
  const llmProvider = await LLMProviderFactory.create(
    provider,
    {
      apiKey: options.apiKey || process.env[`${provider.toUpperCase()}_API_KEY`],
      model: options.model || (provider === 'anthropic' ? 'claude-3-opus-20240229' : 'gpt-4')
    }
  );

  const dazzler = new SimpleDazzle({ llmProvider });
  await dazzler.start();
  
  const pattern = await dazzler.generatePattern(audioFile, artist, song);
  
  console.log(chalk.cyan('\n📝 Generated pattern:'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(pattern);
  console.log(chalk.gray('─'.repeat(50)));
  
  // Keep running
  return new Promise(() => {
    console.log(chalk.yellow('\nPress Ctrl+C to exit\n'));
  });
}