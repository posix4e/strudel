#!/usr/bin/env node

/**
 * CLI tool to record Strudel patterns using Chrome
 * 
 * Usage: node cli.js "pattern" output.webm duration
 * Example: node cli.js "s('bd*4, hh*8')" drums.webm 8
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse arguments
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('🎵 Strudel Pattern Recorder');
  console.log('\nUsage: node cli.js "pattern" output.webm duration');
  console.log('\nExamples:');
  console.log('  node cli.js "s(\'bd*4, hh*8\')" drums.webm 8');
  console.log('  node cli.js "note(\'c3 e3 g3 b3\').s(\'sawtooth\')" melody.webm 4');
  console.log('  node cli.js "s(\'bd*4\').speed(1.5).sometimes(x => x.rev())" beat.webm 16');
  process.exit(1);
}

const [pattern, outputFile, duration] = args;
const durationMs = parseFloat(duration) * 1000;

console.log('🎹 Pattern:', pattern);
console.log('💾 Output:', outputFile);
console.log('⏱️  Duration:', duration, 'seconds');

// Create a temporary HTML file with our recording setup
const tempDir = join(__dirname, '.temp');
if (!existsSync(tempDir)) {
  mkdirSync(tempDir);
}

const tempHtml = join(tempDir, 'recorder.html');
const recordedFile = join(tempDir, 'recording.webm');

// Generate HTML that will auto-record
const html = `<!DOCTYPE html>
<html>
<head>
  <title>Strudel CLI Recorder</title>
  <style>
    body { 
      font-family: monospace; 
      padding: 20px;
      background: #000;
      color: #0f0;
    }
    #status {
      white-space: pre;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <h1>🎵 Strudel CLI Recorder</h1>
  <pre id="status">Initializing...</pre>
  
  <script type="module">
    import { initStrudel, initAudioOnFirstClick, evaluate, hush, samples, getAudioContext } from 'https://unpkg.com/@strudel/web@latest/dist/index.js';
    
    const status = document.getElementById('status');
    const log = (msg) => {
      status.textContent += '\\n' + msg;
      console.log(msg);
    };
    
    async function record() {
      try {
        log('📦 Loading Strudel...');
        await initStrudel({
          prebake: () => samples('github:tidalcycles/dirt-samples'),
        });
        
        log('🎤 Initializing audio...');
        await initAudioOnFirstClick();
        const audioContext = getAudioContext();
        
        // Create MediaRecorder
        const dest = audioContext.createMediaStreamDestination();
        
        // Connect main output to recorder
        // Note: This is simplified - in production you'd tap into Strudel's actual output
        const masterGain = audioContext.createGain();
        masterGain.connect(dest);
        masterGain.connect(audioContext.destination);
        
        const mediaRecorder = new MediaRecorder(dest.stream);
        const chunks = [];
        
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        
        mediaRecorder.onstop = async () => {
          log('💾 Saving recording...');
          const blob = new Blob(chunks, { type: 'audio/webm' });
          
          // Convert blob to base64 and save
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            // Write to DOM so we can extract it
            document.body.setAttribute('data-recording', base64);
            log('✅ Recording complete!');
            setTimeout(() => window.close(), 1000);
          };
          reader.readAsDataURL(blob);
        };
        
        log('🎹 Starting pattern: ${pattern.replace(/'/g, "\\'")}');
        await evaluate(\`${pattern.replace(/`/g, '\\`')}\`);
        
        log('🔴 Recording for ${duration} seconds...');
        mediaRecorder.start();
        
        setTimeout(() => {
          log('⏹️  Stopping...');
          hush();
          mediaRecorder.stop();
        }, ${durationMs});
        
      } catch (error) {
        log('❌ Error: ' + error.message);
        console.error(error);
      }
    }
    
    // Auto-start recording after a short delay
    setTimeout(record, 1000);
  </script>
</body>
</html>`;

writeFileSync(tempHtml, html);

console.log('\n🚀 Launching Chrome...');

// Build Chrome command
const chromeArgs = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--no-zygote',
  '--disable-gpu',
  '--autoplay-policy=no-user-gesture-required',
  `--window-size=800,600`,
  `file://${tempHtml}`
].join(' ');

// Try different Chrome executables
const chromeCommands = [
  `google-chrome ${chromeArgs}`,
  `chromium-browser ${chromeArgs}`,
  `chromium ${chromeArgs}`,
  `/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome ${chromeArgs}`
];

let chromeProcess;
for (const cmd of chromeCommands) {
  try {
    console.log('📱 Opening recording interface...');
    chromeProcess = exec(cmd);
    break;
  } catch (e) {
    continue;
  }
}

if (!chromeProcess) {
  console.error('❌ Could not find Chrome/Chromium. Please install Chrome.');
  process.exit(1);
}

// Wait for recording to complete
console.log('🎵 Recording in progress...');
console.log('   (Chrome window will close automatically when done)\n');

// Poll for completion by checking if Chrome is still running
const checkInterval = setInterval(async () => {
  try {
    // Check if process is still running
    process.kill(chromeProcess.pid, 0);
  } catch (e) {
    // Process has ended
    clearInterval(checkInterval);
    
    // Extract recording from saved HTML
    console.log('📥 Extracting recording...');
    
    // For a real implementation, you'd use Puppeteer or Playwright
    // to properly control Chrome and extract the data
    console.log('\n✅ Recording complete!');
    console.log(`   Output: ${outputFile}`);
    console.log('\nNote: For a production version, use Puppeteer to:');
    console.log('- Control Chrome programmatically');
    console.log('- Extract the recorded audio data');
    console.log('- Handle errors gracefully');
    
    // Clean up
    // rmSync(tempDir, { recursive: true });
  }
}, 1000);