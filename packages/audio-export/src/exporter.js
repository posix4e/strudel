import puppeteer from 'puppeteer';
import { writeFileSync, statSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(spawn);

/**
 * Export a Strudel pattern to an audio file
 * @param {Object} options - Export options
 * @param {string} options.pattern - The Strudel pattern code
 * @param {string} options.output - Output file path
 * @param {number} options.duration - Duration in seconds
 * @param {string} options.format - Output format (webm, wav, mp3, etc.)
 * @param {string} options.quality - Quality setting (low, medium, high)
 * @param {boolean} options.headless - Run browser in headless mode
 * @param {number} options.sampleRate - Sample rate for WAV output
 * @param {string} options.bitRate - Bit rate for MP3 output
 * @param {string} options.prebake - Custom prebake code
 * @returns {Promise<Object>} Export result with file info
 */
export async function exportPattern(options) {
  const {
    pattern,
    output,
    duration = 8,
    format = 'webm',
    quality = 'high',
    headless = false,
    sampleRate = 44100,
    bitRate = '192k',
    prebake = "samples('github:tidalcycles/dirt-samples')"
  } = options;

  // Step 1: Record to WebM using browser
  let webmData;
  try {
    webmData = await recordWithBrowser({
      pattern,
      duration,
      headless,
      quality,
      prebake,
      output
    });
  } catch (error) {
    // Return error result
    return {
      success: false,
      error: error.message,
      details: error.details || {}
    };
  }

  // Step 2: Convert format if needed
  let finalData = webmData;
  let finalFormat = 'webm';

  if (format !== 'webm') {
    finalData = await convertAudio(webmData, format, {
      sampleRate,
      bitRate,
      quality
    });
    finalFormat = format;
  }

  // Step 3: Save file
  writeFileSync(output, finalData);
  
  // Get file info
  const stats = statSync(output);

  return {
    success: true,
    path: output,
    size: stats.size,
    duration: duration,
    format: finalFormat
  };
}

/**
 * Record pattern using Puppeteer and MediaRecorder
 */
async function recordWithBrowser(options) {
  const { pattern, duration, headless, quality, prebake, output } = options;

  // Try to use system Chrome on macOS if available
  const executablePath = process.platform === 'darwin' && 
    existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ?
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined;

  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ],
    timeout: 60000, // 60 second timeout
    protocolTimeout: 240000 // 4 minute protocol timeout
  });

  try {
    const page = await browser.newPage();
    
    // Add error logging
    page.on('error', err => {
      console.error('Page error:', err);
    });
    
    page.on('pageerror', err => {
      console.error('Page error:', err);
    });
    
    // Capture all console messages including errors
    const consoleErrors = [];
    page.on('console', msg => {
      const text = msg.text();
      console.log('Browser console:', text);
      
      // Capture errors for later use
      if (msg.type() === 'error' || text.includes('error') || text.includes('Error')) {
        consoleErrors.push(text);
      }
    });

    // Set viewport for consistency
    await page.setViewport({ width: 1280, height: 720 });

    // Create recording page
    await page.setContent(`<!DOCTYPE html>
<html>
<head>
  <title>Strudel Audio Export</title>
  <style>
    :root {
      --bg-primary: #0a0a0a;
      --bg-secondary: #1a1a1a;
      --text-primary: #0ff;
      --text-secondary: #088;
      --accent: #ff0;
      --border: #333;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body { 
      font-family: 'Courier New', monospace; 
      background: var(--bg-primary);
      color: var(--text-primary);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    
    header {
      background: var(--bg-secondary);
      padding: 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 20px;
    }
    
    h1 {
      font-size: 24px;
      font-weight: normal;
      color: var(--accent);
    }
    
    .recording-indicator {
      width: 12px;
      height: 12px;
      background: #f00;
      border-radius: 50%;
      animation: pulse 1s infinite;
      display: none;
    }
    
    .recording-indicator.active {
      display: block;
    }
    
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
    
    main {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 1px;
      background: var(--border);
      overflow: hidden;
    }
    
    .panel {
      background: var(--bg-secondary);
      padding: 15px;
      overflow: auto;
      position: relative;
    }
    
    .panel-title {
      color: var(--text-secondary);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid var(--border);
    }
    
    #pattern-display {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-wrap: break-word;
      background: var(--bg-primary);
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
    }
    
    #status {
      white-space: pre-wrap;
      line-height: 1.4;
      font-size: 12px;
      color: #0f8;
    }
    
    #waveform-container {
      width: 100%;
      height: calc(100% - 30px);
      background: var(--bg-primary);
      border-radius: 4px;
      position: relative;
      overflow: hidden;
    }
    
    #waveform {
      width: 100%;
      height: 100%;
    }
    
    #pattern-viz {
      width: 100%;
      height: calc(100% - 30px);
      background: var(--bg-primary);
      border-radius: 4px;
      position: relative;
      overflow: hidden;
    }
    
    .viz-note {
      position: absolute;
      background: var(--accent);
      border-radius: 2px;
      opacity: 0.8;
      transition: all 0.1s ease;
    }
    
    .viz-note:hover {
      opacity: 1;
      box-shadow: 0 0 10px var(--accent);
    }
    
    .time-marker {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--text-primary);
      opacity: 0.5;
      pointer-events: none;
    }
    
  </style>
</head>
<body>
  <header>
    <h1>🎵 Strudel Audio Export</h1>
    <div class="recording-indicator" id="recording-indicator"></div>
    <div id="duration-display" style="color: var(--text-secondary); font-size: 14px;"></div>
  </header>
  
  <main>
    <div class="panel">
      <div class="panel-title">Pattern Code</div>
      <pre id="pattern-display"></pre>
    </div>
    
    <div class="panel">
      <div class="panel-title">Export Log</div>
      <pre id="status">Initializing...</pre>
    </div>
    
    <div class="panel">
      <div class="panel-title">Waveform Visualization</div>
      <div id="waveform-container">
        <canvas id="waveform"></canvas>
      </div>
    </div>
    
    <div class="panel">
      <div class="panel-title">Pattern Timeline</div>
      <div id="pattern-viz"></div>
    </div>
  </main>
</body>
</html>`);

    // Run recording in page context
    const recordingData = await page.evaluate(async (pattern, durationMs, quality, prebake, outputPath) => {
      // Track console errors inside page context
      const pageConsoleErrors = [];
      const originalError = console.error;
      console.error = function(...args) {
        pageConsoleErrors.push(args.join(' '));
        return originalError.apply(console, args);
      };
      const status = document.getElementById('status');
      const patternDisplay = document.getElementById('pattern-display');
      const recordingIndicator = document.getElementById('recording-indicator');
      const durationDisplay = document.getElementById('duration-display');
      const waveformCanvas = document.getElementById('waveform');
      const waveformCtx = waveformCanvas.getContext('2d');
      const patternViz = document.getElementById('pattern-viz');
      
      // Display pattern - no HTML highlighting for security/simplicity
      patternDisplay.textContent = pattern;
      durationDisplay.innerHTML = `Duration: ${(durationMs/1000).toFixed(1)}s<br>Output: ${outputPath || 'temp.webm'}`;
      
      // Set up waveform canvas
      waveformCanvas.width = waveformCanvas.offsetWidth;
      waveformCanvas.height = waveformCanvas.offsetHeight;
      
      let analyser;
      let waveformAnimationId;
      let startTime = Date.now();
      
      // Draw waveform
      function drawWaveform() {
        if (!analyser) return;
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);
        
        waveformCtx.fillStyle = '#0a0a0a';
        waveformCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
        
        waveformCtx.lineWidth = 2;
        waveformCtx.strokeStyle = '#0ff';
        waveformCtx.beginPath();
        
        const sliceWidth = waveformCanvas.width * 1.0 / bufferLength;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = v * waveformCanvas.height / 2;
          
          if (i === 0) {
            waveformCtx.moveTo(x, y);
          } else {
            waveformCtx.lineTo(x, y);
          }
          
          x += sliceWidth;
        }
        
        waveformCtx.lineTo(waveformCanvas.width, waveformCanvas.height / 2);
        waveformCtx.stroke();
        
        // Draw time progress
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        const progressX = progress * waveformCanvas.width;
        
        waveformCtx.strokeStyle = '#ff0';
        waveformCtx.lineWidth = 2;
        waveformCtx.beginPath();
        waveformCtx.moveTo(progressX, 0);
        waveformCtx.lineTo(progressX, waveformCanvas.height);
        waveformCtx.stroke();
        
        waveformAnimationId = requestAnimationFrame(drawWaveform);
      }
      
      const log = (msg) => {
        status.textContent += '\\n' + msg;
        console.log(msg);
      };

      try {
        log('📦 Loading Strudel with full capabilities...');
        
        // First, load the web bundle as usual
        const strudelModule = await import('https://unpkg.com/@strudel/web@latest/dist/index.js');
        const exports = strudelModule.default || strudelModule;
        
        // Try to find the functions we need
        const initStrudel = exports.initStrudel || window.initStrudel;
        const initAudioOnFirstClick = exports.initAudioOnFirstClick || window.initAudioOnFirstClick;
        const getAudioContext = exports.getAudioContext || window.getAudioContext;
        
        if (!initStrudel) {
          throw new Error('Could not find initStrudel function');
        }

        // Initialize Strudel
        await initStrudel();
        
        // Now try to load GM soundfonts using strudel.cc's approach
        // Check if pattern needs GM sounds
        const needsGMSounds = prebake && prebake.includes('gm_') || 
                             pattern.includes('gm_');
        
        if (needsGMSounds) {
          log('⚠️  Pattern uses GM sounds (gm_piano, gm_harmonica, etc.)');
          log('');
          log('GM sounds are not included in the default Strudel web bundle.');
          log('');
          log('Options:');
          log('1. Use --use-strudelcc flag to export via strudel.cc (full GM support)');
          log('2. The exporter will attempt to use similar alternative sounds');
          log('3. Build a custom Strudel bundle with soundfonts included');
          log('');
          
          // Offer to replace with alternatives
          log('Attempting to use alternative sounds...');
          
          // Import and use GM sound alternatives
          const { replaceGMSounds, logGMReplacements } = await import('../gm-sound-alternatives.js');
          
          // Log which sounds will be replaced
          const replacements = logGMReplacements(pattern);
          if (replacements.length > 0) {
            log('Sound replacements:');
            replacements.forEach(r => log(`  ${r}`));
            
            // Update the pattern with alternatives
            pattern = replaceGMSounds(pattern);
            log('✅ Pattern updated with alternative sounds');
          }
        }
        
        // Now samples should be available on window
        const samplesFunc = window.samples;
        
        // Load samples and prebake
        if (prebake) {
          log('Loading prebake code...');
          try {
            // Create an async function to properly handle imports in prebake
            const prebakeFunc = new Function('samples', 'setDefaultVoicings', `
              return (async () => {
                ${prebake}
              })();
            `);
            await prebakeFunc(window.samples, window.setDefaultVoicings);
            log('Prebake loaded successfully');
          } catch (e) {
            log('Error loading prebake: ' + e.message);
          }
        } else if (window.samples) {
          // Default minimal prebake
          log('Loading default samples...');
          await window.samples('github:tidalcycles/dirt-samples');
          
          // Set default voicings for patterns that use it
          if (window.setDefaultVoicings) {
            window.setDefaultVoicings('legacy');
          }
        } else {
          log('Warning: samples function not found, continuing without preloading samples');
        }

        log('🎤 Initializing audio...');
        
        
        // Initialize audio - simulate user click for audio context
        log('Simulating user interaction for audio context...');
        
        // Create a button and click it to trigger audio init
        const button = document.createElement('button');
        button.id = 'audio-init-btn';
        document.body.appendChild(button);
        
        // Set up click handler
        button.onclick = async () => {
          await window.initAudioOnFirstClick();
          log('Audio initialized via click');
        };
        
        // Simulate click
        button.click();
        
        // Wait a bit for audio to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const audioContext = window.getAudioContext();
        log('Got audio context, state: ' + audioContext.state);

        log('🔌 Setting up recording...');
        
        // Create destination for recording
        const dest = audioContext.createMediaStreamDestination();
        log('Created MediaStreamDestination');
        
        // Create analyser for visualization
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        
        
        // Try to find the actual audio output node
        // webaudioOutput is a function, we need the actual node
        let connected = false;
        
        // Method 1: Try to get the destination from superdough
        if (window.getDestination) {
          const destination = window.getDestination();
          if (destination && destination.connect) {
            log('Found destination via getDestination()');
            destination.connect(dest);
            connected = true;
          }
        }
        
        // Method 2: Hook into the audio context destination
        if (!connected) {
          log('Intercepting audio context destination connections');
          
          // Create a gain node to split the signal
          const splitter = audioContext.createGain();
          splitter.gain.value = 1;
          
          // Connect splitter to analyser, speaker and recording destination
          splitter.connect(analyser);
          analyser.connect(audioContext.destination);
          splitter.connect(dest);
          
          // Intercept all connections to destination
          const originalConnect = GainNode.prototype.connect;
          const originalDestination = audioContext.destination;
          
          GainNode.prototype.connect = function(target, ...args) {
            if (target === originalDestination) {
              log('Intercepted connection to destination, routing through splitter');
              return originalConnect.call(this, splitter, ...args);
            }
            return originalConnect.call(this, target, ...args);
          };
        }

        // Set up MediaRecorder with quality settings
        const mimeType = 'audio/webm;codecs=opus';
        const audioBitsPerSecond = quality === 'high' ? 256000 : 
                                   quality === 'medium' ? 128000 : 64000;

        
        const mediaRecorder = new MediaRecorder(dest.stream, {
          mimeType,
          audioBitsPerSecond
        });
        
        const chunks = [];
        let silenceCheckInterval;
        let lastChunkTime = Date.now();
        let totalDataSize = 0;
        let chunkCount = 0;
        let smallChunkStreak = 0;

        return new Promise((resolve) => {
          // Set up silence detection
          silenceCheckInterval = setInterval(() => {
            const timeSinceLastChunk = Date.now() - lastChunkTime;
            const avgChunkSize = chunkCount > 0 ? totalDataSize / chunkCount : 0;
            
            // Check for no data or very small chunks
            if (timeSinceLastChunk > 5000 && chunkCount < 5) {
              log('❌ No audio data received in 5 seconds - aborting');
              clearInterval(silenceCheckInterval);
              mediaRecorder.stop();
              resolve({
                success: false,
                error: 'No audio generated - pattern likely has errors or uses invalid sounds'
              });
            } else if (chunkCount > 30 && avgChunkSize < 50) {
              log('❌ Only receiving tiny chunks - audio is likely silent');
              clearInterval(silenceCheckInterval);
              mediaRecorder.stop();
              resolve({
                success: false,
                error: 'Generated audio appears to be silent - check pattern for errors'
              });
            }
          }, 1000);
          
          mediaRecorder.ondataavailable = (e) => {
            log(`📦 Data event: size=${e.data.size}`);
            if (e.data.size > 0) {
              chunks.push(e.data);
              totalDataSize += e.data.size;
              chunkCount++;
              lastChunkTime = Date.now();
              
              // Track small chunks
              if (e.data.size < 50) {
                smallChunkStreak++;
                log(`⚠️  Small chunk: ${e.data.size} bytes (streak: ${smallChunkStreak})`);
                
                // Only consider it silence if we've been recording for a while
                const recordingTime = Date.now() - (lastChunkTime - chunkCount * 100);
                if (smallChunkStreak > 30 && recordingTime > 3000) {
                  log('❌ Too many small chunks after 3s - likely generating silence');
                  clearInterval(silenceCheckInterval);
                  mediaRecorder.stop();
                  
                  // Collect any console errors
                  const errors = [];
                  const logs = document.querySelectorAll('#status').length > 0 
                    ? document.getElementById('status').textContent.split('\n').filter(line => 
                        line.toLowerCase().includes('error') || 
                        line.includes('not found') ||
                        line.includes('Failed to execute'))
                    : [];
                  
                  resolve({
                    success: false,
                    error: 'Pattern is generating silence - check for invalid sounds or syntax errors',
                    details: {
                      smallChunkStreak,
                      recordingTime,
                      consoleErrors: [...logs, ...pageConsoleErrors]
                    }
                  });
                }
              } else {
                smallChunkStreak = 0;
                log(`📊 Received chunk: ${e.data.size} bytes`);
              }
            }
          };
          
          mediaRecorder.onstop = async () => {
            clearInterval(silenceCheckInterval);
            log('💾 Processing recording...');
            log(`📊 Total chunks: ${chunks.length}, Total size: ${totalDataSize} bytes`);
            const blob = new Blob(chunks, { type: mimeType });
            
            // Convert to base64
            const reader = new FileReader();
            reader.onloadend = () => {
              log('✅ Recording complete!');
              resolve({
                success: true,
                data: reader.result.split(',')[1],
                mimeType
              });
            };
            reader.readAsDataURL(blob);
          };

          // Start pattern
          log('🎹 Evaluating pattern...');
          
          // Pattern timeline visualization
          let eventCount = 0;
          let patternStartTime = null;
          
          // Add simple visual feedback for pattern activity
          const addPatternEvent = (name, value) => {
            if (!patternStartTime || !patternViz) return;
            
            const elapsed = Date.now() - patternStartTime;
            const progress = Math.min((elapsed / durationMs) * 100, 100);
            
            const eventEl = document.createElement('div');
            eventEl.className = 'viz-note';
            eventEl.style.left = `${progress}%`;
            eventEl.style.top = `${(eventCount % 8) * 12}%`;
            eventEl.style.width = '10px';
            eventEl.style.height = '10px';
            eventEl.style.background = name === 'bd' ? '#f00' : 
                                     name === 'sd' ? '#0f0' : 
                                     name === 'hh' ? '#ff0' : '#0ff';
            eventEl.title = `${name}: ${value || ''}`;
            
            patternViz.appendChild(eventEl);
            eventCount++;
            
            // Clean up old events
            if (eventCount > 200) {
              const oldEvents = patternViz.querySelectorAll('.viz-note');
              if (oldEvents.length > 0) {
                oldEvents[0].remove();
              }
            }
          };
          
          // Hook into console to detect sound loading (simple visualization)
          const originalConsoleLog = console.log;
          console.log = function(...args) {
            const msg = args[0];
            if (typeof msg === 'string' && msg.includes('[sampler] load sound')) {
              const match = msg.match(/load sound "(\w+):/);
              if (match && patternStartTime) {
                addPatternEvent(match[1], 'loaded');
              }
            }
            return originalConsoleLog.apply(console, args);
          };
          
          window.evaluate(pattern).then(() => {
            // Give audio time to initialize
            setTimeout(() => {
              log('🔴 Recording started...');
              recordingIndicator.classList.add('active');
              startTime = Date.now();
              patternStartTime = Date.now();
              drawWaveform(); // Start waveform animation
              
              // Add some visual pattern events based on the pattern
              // This is a simple visualization - in reality you'd hook into Strudel's event system
              if (pattern.includes('bd')) {
                let beatTime = 0;
                const beatInterval = setInterval(() => {
                  if (beatTime > durationMs) {
                    clearInterval(beatInterval);
                    return;
                  }
                  addPatternEvent('bd', '1');
                  beatTime += 500; // Approximate beat timing
                }, 500);
              }
              
              if (pattern.includes('hh')) {
                let hhTime = 0;
                const hhInterval = setInterval(() => {
                  if (hhTime > durationMs) {
                    clearInterval(hhInterval);
                    return;
                  }
                  addPatternEvent('hh', '1');
                  hhTime += 250; // Hi-hats typically faster
                }, 250);
              }
              
              if (pattern.includes('sd')) {
                let sdTime = 1000;
                const sdInterval = setInterval(() => {
                  if (sdTime > durationMs) {
                    clearInterval(sdInterval);
                    return;
                  }
                  addPatternEvent('sd', '1');
                  sdTime += 1000; // Snare on 2 and 4
                }, 1000);
              }
              
              mediaRecorder.start(100); // Capture in 100ms chunks
            }, 500);
            
            // Stop after duration (plus the 500ms startup delay)
            setTimeout(() => {
              log('⏹️  Stopping...');
              recordingIndicator.classList.remove('active');
              if (waveformAnimationId) {
                cancelAnimationFrame(waveformAnimationId);
              }
              window.hush();
              setTimeout(() => {
                mediaRecorder.stop();
              }, 500); // Small delay to capture tail
            }, durationMs + 500);
          }).catch(error => {
            log('❌ Pattern error: ' + error.message);
            resolve({ 
              success: false, 
              error: error.message,
              details: {
                consoleErrors: pageConsoleErrors
              }
            });
          });
        });

      } catch (error) {
        log('❌ Error: ' + error.message);
        return { success: false, error: error.message };
      }
    }, pattern, duration * 1000, quality, prebake, output);

    if (!recordingData.success) {
      const error = new Error(recordingData.error || 'Recording failed');
      // Pass console errors through the error object
      if (recordingData.details) {
        error.details = recordingData.details;
        
        // Also add console errors from outside page context
        if (consoleErrors.length > 0) {
          error.details.consoleErrors = [
            ...(error.details.consoleErrors || []),
            ...consoleErrors
          ];
        }
      }
      throw error;
    }

    return Buffer.from(recordingData.data, 'base64');

  } finally {
    await browser.close();
  }
}

/**
 * Convert audio from WebM to other formats using FFmpeg
 */
async function convertAudio(inputBuffer, outputFormat, options) {
  const { sampleRate, bitRate, quality } = options;

  // Create temp files
  const tempInput = join(tmpdir(), `strudel-temp-${Date.now()}.webm`);
  const tempOutput = join(tmpdir(), `strudel-temp-${Date.now()}.${outputFormat}`);

  try {
    // Write input buffer to temp file
    writeFileSync(tempInput, inputBuffer);

    // Build FFmpeg command
    const args = ['-i', tempInput, '-y'];

    switch (outputFormat) {
      case 'wav':
        args.push('-acodec', 'pcm_s16le');
        args.push('-ar', sampleRate.toString());
        break;
      
      case 'mp3':
        args.push('-acodec', 'libmp3lame');
        args.push('-b:a', bitRate);
        if (quality === 'high') {
          args.push('-q:a', '0');
        } else if (quality === 'medium') {
          args.push('-q:a', '4');
        } else {
          args.push('-q:a', '7');
        }
        break;
      
      case 'ogg':
        args.push('-acodec', 'libvorbis');
        if (quality === 'high') {
          args.push('-q:a', '8');
        } else if (quality === 'medium') {
          args.push('-q:a', '5');
        } else {
          args.push('-q:a', '2');
        }
        break;
      
      case 'flac':
        args.push('-acodec', 'flac');
        args.push('-ar', sampleRate.toString());
        if (quality === 'high') {
          args.push('-compression_level', '8');
        } else if (quality === 'medium') {
          args.push('-compression_level', '5');
        } else {
          args.push('-compression_level', '0');
        }
        break;
      
      default:
        throw new Error(`Unsupported format: ${outputFormat}`);
    }

    args.push(tempOutput);

    // Run FFmpeg
    await runFFmpeg(args);

    // Read output file
    const { readFileSync } = await import('fs');
    const outputBuffer = Buffer.from(readFileSync(tempOutput));

    return outputBuffer;

  } finally {
    // Clean up temp files
    try { await unlink(tempInput); } catch {}
    try { await unlink(tempOutput); } catch {}
  }
}

/**
 * Run FFmpeg command
 */
function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);
    
    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(new Error('FFmpeg not found. Please install FFmpeg to convert audio formats.'));
      } else {
        reject(error);
      }
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
      } else {
        resolve();
      }
    });
  });
}