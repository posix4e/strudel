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
  const webmData = await recordWithBrowser({
    pattern,
    duration,
    headless,
    quality,
    prebake
  });

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
  const { pattern, duration, headless, quality, prebake } = options;

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
    
    page.on('console', msg => {
      console.log('Browser console:', msg.text());
    });

    // Set viewport for consistency
    await page.setViewport({ width: 1280, height: 720 });

    // Create recording page
    await page.setContent(`<!DOCTYPE html>
<html>
<head>
  <title>Strudel Audio Export</title>
  <style>
    body { 
      font-family: monospace; 
      padding: 20px;
      background: #000;
      color: #0ff;
    }
    #status { 
      white-space: pre-wrap; 
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <h1>🎵 Strudel Audio Export</h1>
  <pre id="status">Initializing...</pre>
</body>
</html>`);

    // Run recording in page context
    const recordingData = await page.evaluate(async (pattern, durationMs, quality, prebake) => {
      const status = document.getElementById('status');
      const log = (msg) => {
        status.textContent += '\\n' + msg;
        console.log(msg);
      };

      try {
        // Import Strudel - use same approach as cli-puppeteer.js
        const strudelModule = await import('https://unpkg.com/@strudel/web@latest/dist/index.js');
        
        // The module might export everything on default or as named exports
        const exports = strudelModule.default || strudelModule;
        
        // Try to find the functions we need
        const initStrudel = exports.initStrudel || window.initStrudel;
        const initAudioOnFirstClick = exports.initAudioOnFirstClick || window.initAudioOnFirstClick;
        const getAudioContext = exports.getAudioContext || window.getAudioContext;
        
        if (!initStrudel) {
          // Log what we got to debug
          log('Available exports: ' + Object.keys(exports).join(', '));
          throw new Error('Could not find initStrudel function');
        }

        log('📦 Loading Strudel...');
        
        // Initialize without prebake first
        await initStrudel();
        
        // Debug what's available after init
        
        // Now samples should be available on window
        const samplesFunc = window.samples;
        
        // Load samples if needed
        if (samplesFunc && prebake) {
          await eval(prebake);
        } else if (samplesFunc) {
          await samplesFunc('github:tidalcycles/dirt-samples');
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
          
          // Connect splitter to both the speaker and recording destination
          splitter.connect(audioContext.destination);
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
                  resolve({
                    success: false,
                    error: 'Pattern is generating silence - check for invalid sounds or syntax errors'
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
          window.evaluate(pattern).then(() => {
            // Give audio time to initialize
            setTimeout(() => {
              log('🔴 Recording started...');
              mediaRecorder.start(100); // Capture in 100ms chunks
            }, 500);
            
            // Stop after duration (plus the 500ms startup delay)
            setTimeout(() => {
              log('⏹️  Stopping...');
              window.hush();
              setTimeout(() => {
                mediaRecorder.stop();
              }, 500); // Small delay to capture tail
            }, durationMs + 500);
          }).catch(error => {
            log('❌ Pattern error: ' + error.message);
            resolve({ success: false, error: error.message });
          });
        });

      } catch (error) {
        log('❌ Error: ' + error.message);
        return { success: false, error: error.message };
      }
    }, pattern, duration * 1000, quality, prebake);

    if (!recordingData.success) {
      throw new Error(recordingData.error || 'Recording failed');
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