import puppeteer from 'puppeteer';
import { writeFileSync, statSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { browserManager } from './browser-manager.js';

const execAsync = promisify(spawn);

/**
 * Export a Strudel pattern to an audio file using strudel.cc
 * This gives us access to all features including GM sounds!
 */
export async function exportPatternUsingStrudelCC(options) {
  const {
    pattern,
    output,
    duration = 8,
    format = 'webm',
    quality = 'high',
    headless = false,
    sampleRate = 44100,
    bitRate = '192k',
    prebake = null,
    dashboard = null
  } = options;

  // Record using strudel.cc
  let webmData;
  try {
    webmData = await recordWithStrudelCC({
      pattern,
      duration,
      headless,
      quality,
      output,
      dashboard
    });
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.details || {}
    };
  }

  // Convert format if needed
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

  // Save file
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
 * Record pattern using strudel.cc
 */
async function recordWithStrudelCC(options) {
  const { pattern, duration, headless, quality, output, dashboard, reuseWindow } = options;
  
  // Initialize console errors array at function scope
  const consoleErrors = [];
  const consoleMessages = [];
  
  let browser;
  let page;
  let shouldCloseBrowser = false;
  let vizInterval;

  // Use browser manager if reuseWindow is true
  if (reuseWindow) {
    browser = await browserManager.getBrowser({ headless });
    page = await browserManager.getPage({ headless });
  } else {
    // Create new browser instance
    shouldCloseBrowser = true;
    
    // Try to use system Chrome on macOS if available
    const executablePath = process.platform === 'darwin' && 
      existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ?
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined;

    browser = await puppeteer.launch({
      headless: headless ? 'new' : false,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--autoplay-policy=no-user-gesture-required',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream'
      ],
      timeout: 60000,
      protocolTimeout: 240000
    });
    
    page = await browser.newPage();
  }

  try {
    
    // Add error logging
    page.on('error', err => {
      console.error('Page error:', err);
    });
    
    page.on('pageerror', err => {
      console.error('Page error:', err);
    });
    
    // Capture console messages including errors
    page.on('console', msg => {
      const text = msg.text();
      console.log('Browser console:', text);
      consoleMessages.push(text);
      
      // Capture errors specifically
      if (msg.type() === 'error' || text.includes('[eval] error:')) {
        consoleErrors.push(text);
      }
    });

    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });

    // Navigate to strudel.cc with retries
    console.log('🌐 Navigating to strudel.cc...');
    let retries = 3;
    while (retries > 0) {
      try {
        await page.goto('https://strudel.cc/', { 
          waitUntil: 'domcontentloaded', // Less strict than networkidle2
          timeout: 45000 
        });
        break;
      } catch (e) {
        retries--;
        if (retries === 0) throw e;
        console.log(`Navigation failed, retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Wait for the REPL to load with retries
    console.log('⏳ Waiting for Strudel REPL to load...');
    let replLoaded = false;
    for (let i = 0; i < 5; i++) {
      try {
        await page.waitForSelector('.cm-content', { timeout: 10000 });
        replLoaded = true;
        break;
      } catch (e) {
        console.log(`REPL not ready yet, waiting... (attempt ${i + 1}/5)`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    if (!replLoaded) {
      throw new Error('Could not load Strudel REPL after multiple attempts');
    }
    
    // Give it time to fully initialize
    console.log('Waiting for full initialization...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Clear the editor and insert our pattern
    console.log('📝 Inserting pattern...');
    await page.evaluate((patternCode) => {
      // Find the CodeMirror editor
      const editor = document.querySelector('.cm-content');
      if (!editor) throw new Error('Could not find CodeMirror editor');
      
      // Get the CodeMirror view
      const cmView = editor.cmView || editor._cmView;
      if (!cmView) {
        // Try to find it through the React component
        const keys = Object.keys(editor);
        const viewKey = keys.find(k => k.startsWith('__reactInternalInstance') || k.startsWith('__reactFiber'));
        if (viewKey && editor[viewKey]) {
          const fiber = editor[viewKey];
          // Navigate through React fiber to find CodeMirror view
          let current = fiber;
          while (current) {
            if (current.memoizedProps && current.memoizedProps.view) {
              cmView = current.memoizedProps.view;
              break;
            }
            current = current.return;
          }
        }
      }
      
      if (cmView && cmView.view) {
        // Clear and set new content
        cmView.view.dispatch({
          changes: {
            from: 0,
            to: cmView.view.state.doc.length,
            insert: patternCode
          }
        });
      } else {
        // Fallback: try to trigger input directly
        editor.textContent = patternCode;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, pattern);

    // First set up audio recording infrastructure
    console.log('🎙️ Setting up audio recording...');
    
    const recordingSetup = await page.evaluate(() => {
      try {
        // Wait for audio context to be available
        let audioContext = null;
        let attempts = 0;
        
        while (!audioContext && attempts < 10) {
          audioContext = window.getAudioContext ? window.getAudioContext() : 
                        window.audioContext || 
                        (window.AudioContext && new AudioContext());
          
          if (!audioContext) {
            attempts++;
            // Wait a bit and try again
            const waitTime = 500;
            const start = Date.now();
            while (Date.now() - start < waitTime) {
              // Busy wait
            }
          }
        }
        
        if (!audioContext) {
          return { success: false, error: 'No audio context found after multiple attempts' };
        }
        
        // Create recorder destination
        const dest = audioContext.createMediaStreamDestination();
        window.__recordingDest = dest;
        window.__audioContext = audioContext;
        
        // Create analyzer right away
        const analyzer = audioContext.createAnalyser();
        analyzer.fftSize = 256;
        analyzer.smoothingTimeConstant = 0.8;
        
        window.__audioAnalyzer = analyzer;
        window.__waveformData = new Uint8Array(analyzer.frequencyBinCount);
        window.__frequencyData = new Uint8Array(analyzer.frequencyBinCount);
        
        // Create a gain node to sit in the middle
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 1;
        
        // Connect gain to analyzer, recorder, and destination
        gainNode.connect(analyzer);
        gainNode.connect(dest);
        gainNode.connect(audioContext.destination);
        
        // Intercept ALL audio connections right from the start
        const originalConnect = AudioNode.prototype.connect;
        const connectedNodes = new Set();
        
        AudioNode.prototype.connect = function(target, ...args) {
          // If connecting to destination, redirect to our gain node
          if (target === audioContext.destination) {
            console.log(`Audio routing: ${this.constructor.name} -> gain -> analyzer/recorder/destination`);
            
            // Connect to gain node instead
            return originalConnect.call(this, gainNode, ...args);
          }
          
          // Normal connection for non-destination targets
          return originalConnect.call(this, target, ...args);
        };
        
        console.log('Audio recording and analysis infrastructure ready');
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    
    if (!recordingSetup.success) {
      console.log('Warning: Audio recording setup failed:', recordingSetup.error);
      console.log('Will retry after starting playback...');
    }
    
    // Now start playback
    console.log('▶️  Starting playback...');
    
    // Try multiple methods to start playback
    const playStarted = await page.evaluate(async () => {
      // First check if audio is already playing
      if (window.getCyclist && window.getCyclist()) {
        const cyclist = window.getCyclist();
        if (cyclist.started) {
          console.log('Audio is already playing');
          return true;
        }
      }
      
      // Method 1: Wait a moment then look for the play button more carefully
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Find all buttons and look for the play button
      const buttons = Array.from(document.querySelectorAll('button'));
      console.log(`Found ${buttons.length} buttons`);
      
      // Look for play button by various methods
      const playButton = buttons.find(btn => {
        const title = btn.getAttribute('title');
        const ariaLabel = btn.getAttribute('aria-label');
        const svg = btn.querySelector('svg');
        const path = svg ? svg.querySelector('path') : null;
        
        // Check various ways to identify play button
        return (title && title.toLowerCase().includes('play')) ||
               (ariaLabel && ariaLabel.toLowerCase().includes('play')) ||
               (path && path.getAttribute('d') && path.getAttribute('d').includes('M8 5v14l11-7z')); // Play icon path
      });
      
      if (playButton) {
        console.log('Found play button, clicking it');
        playButton.click();
        return true;
      }
      
      // Method 2: Try using the evaluate function if available
      if (window.evaluate && typeof window.evaluate === 'function') {
        console.log('Using evaluate() function');
        window.evaluate();
        return true;
      }
      
      
      // Method 3: Use keyboard shortcut - try on the editor
      const editor = document.querySelector('.cm-content');
      if (editor) {
        console.log('Trying keyboard shortcut on editor');
        editor.focus();
        editor.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          ctrlKey: true,
          bubbles: true,
          cancelable: true
        }));
        return true;
      }
      
      return false;
    });

    if (!playStarted) {
      throw new Error('Could not start playback');
    }

    // Wait for audio to start
    console.log('⏳ Waiting for audio to start...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start streaming visualization data
    let vizInterval;
    if (dashboard && dashboard.sendAudioData) {
      console.log('📊 Starting audio visualization streaming...');
      
      vizInterval = setInterval(async () => {
        try {
          const vizData = await page.evaluate(() => {
            if (window.__audioAnalyzer && window.__waveformData && window.__frequencyData) {
              // Get fresh data
              window.__audioAnalyzer.getByteTimeDomainData(window.__waveformData);
              window.__audioAnalyzer.getByteFrequencyData(window.__frequencyData);
              
              // Debug: Check if we're getting real data
              const hasWaveform = Array.from(window.__waveformData).some(v => v !== 128);
              const hasFrequency = Array.from(window.__frequencyData).some(v => v > 0);
              
              if (!hasWaveform && !hasFrequency) {
                // Only log occasionally to reduce spam
                if (Math.random() < 0.05) {
                  console.log('Warning: No audio data in analyzer');
                }
              } else {
                console.log('SUCCESS: Audio data detected!',
                  'waveform:', Math.min(...window.__waveformData), '-', Math.max(...window.__waveformData),
                  'frequency max:', Math.max(...window.__frequencyData)
                );
              }
              
              return {
                waveform: Array.from(window.__waveformData.slice(0, 128)),
                frequency: Array.from(window.__frequencyData.slice(0, 64))
              };
            }
            return null;
          });
          
          if (vizData && vizData.waveform && vizData.frequency) {
            // Log that we're sending data
            const hasData = vizData.waveform.some(v => v !== 128) || vizData.frequency.some(v => v > 0);
            if (hasData) {
              console.log('Sending audio data to dashboard');
            }
            dashboard.sendAudioData(
              new Uint8Array(vizData.waveform),
              new Uint8Array(vizData.frequency)
            );
          }
        } catch (e) {
          // Silently ignore errors
        }
      }, 50);
    }
    
    // Now start recording using the pre-setup destination
    console.log('🔴 Starting recording...');
    
    const recordingData = await page.evaluate(async (durationMs, qualityStr) => {
      // Get the pre-setup recording destination
      const dest = window.__recordingDest;
      if (!dest) {
        throw new Error('Recording destination not found - setup failed');
      }
      
      console.log('Using pre-configured recording destination');

      // Set up MediaRecorder
      const mimeType = 'audio/webm;codecs=opus';
      const audioBitsPerSecond = qualityStr === 'high' ? 256000 : 
                                qualityStr === 'medium' ? 128000 : 64000;

      const mediaRecorder = new MediaRecorder(dest.stream, {
        mimeType,
        audioBitsPerSecond
      });
      
      const chunks = [];
      let chunkCount = 0;
      let totalSize = 0;
      
      return new Promise((resolve) => {
        mediaRecorder.ondataavailable = (e) => {
          console.log(`Received chunk ${++chunkCount}: ${e.data.size} bytes`);
          if (e.data.size > 0) {
            chunks.push(e.data);
            totalSize += e.data.size;
          }
        };
        
        mediaRecorder.onstop = async () => {
          console.log(`Recording stopped. Total chunks: ${chunks.length}, Total size: ${totalSize} bytes`);
          const blob = new Blob(chunks, { type: mimeType });
          
          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve({
              success: true,
              data: reader.result.split(',')[1],
              mimeType,
              totalSize
            });
          };
          reader.readAsDataURL(blob);
        };

        // Start recording
        mediaRecorder.start(100); // Capture in 100ms chunks
        console.log('Recording started');
        
        // Monitor audio level
        if (dest.stream.getAudioTracks().length > 0) {
          console.log('Audio tracks available:', dest.stream.getAudioTracks().length);
        }
        
        // Log analyzer status
        if (window.__audioAnalyzer) {
          console.log('Audio analyzer is available for visualization');
        } else {
          console.log('Warning: Audio analyzer not available');
        }
        
        // Stop after duration
        setTimeout(() => {
          console.log('Stopping recording...');
          
          // Stop playback first - try multiple methods
          if (window.hush && typeof window.hush === 'function') {
            window.hush();
            console.log('Called hush() to stop playback');
          } else {
            const stopButton = document.querySelector('button[title="Stop"]') || 
                             document.querySelector('button:has(svg[data-icon="stop"])') ||
                             Array.from(document.querySelectorAll('button')).find(btn => 
                               btn.innerHTML.includes('stop') || 
                               btn.textContent.includes('⏹'));
            if (stopButton) {
              stopButton.click();
              console.log('Clicked stop button');
            }
          }
          
          // Then stop recording
          setTimeout(() => {
            mediaRecorder.stop();
          }, 500); // Small delay to capture tail
        }, durationMs);
      });
    }, duration * 1000, quality);

    if (!recordingData.success) {
      throw new Error(recordingData.error || 'Recording failed');
    }
    
    // Check if we got any data
    if (!recordingData.totalSize || recordingData.totalSize === 0) {
      const error = new Error('No audio data recorded - pattern may have errors');
      error.details = {
        consoleErrors: consoleErrors,
        consoleMessages: consoleMessages
      };
      throw error;
    }

    console.log('✅ Recording complete!');
    return Buffer.from(recordingData.data, 'base64');

  } catch (error) {
    // Add console errors to error details
    if (consoleErrors.length > 0 && !error.details) {
      error.details = {
        consoleErrors: consoleErrors,
        consoleMessages: consoleMessages
      };
    }
    throw error;
  } finally {
    // Clean up visualization interval if it exists
    if (vizInterval) {
      clearInterval(vizInterval);
    }
    // Only close browser if we created it (not reusing)
    if (shouldCloseBrowser && browser) {
      await browser.close();
    }
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